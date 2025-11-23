import mongoose from "mongoose";
import StudentFee from "../models/StudentFee.js";
import Student from "../models/Student.js";
import FeePayment from "../models/FeePayment.js";
import FeeStructure from "../models/FeeStructure.js";
import ClassLevel from "../models/ClassLevel.js";
import Section from "../models/Section.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";
import { shortCache } from "../utils/cache.js";

/* ============================================
   1. GET STUDENT LEDGER (The Bill)
   ============================================ */
export const getStudentFeeLedger = catchAsync(async (req, res, next) => {
  const { studentId } = req.params;
  const { yearId } = req.query;


  console.log("Fetching ledger for Student:", studentId, "Year:", yearId);
  const ledger = await StudentFee.findOne({
    student: studentId,
    academicYear: yearId,
  })
    .populate("student", "firstName lastName admissionNo")
    .populate("feeStructure", "name");

  if (!ledger) {
    return next(new AppError("Fee Ledger not found for this student/year.", 404));
  }

  // Manually add combined name in student object
  ledger.student.name = `${ledger.student.firstName} ${ledger.student.lastName}`;
  console.log("Found Ledger:", ledger);
  res.status(200).json({
    status: "success",
    data: { ledger },
  });

});

/* ============================================
   2. APPLY CONCESSION (Admin Only)
   ============================================ */
export const applyConcession = catchAsync(async (req, res, next) => {
  const { ledgerId } = req.params; // StudentFee ID
  const { concessionAmount, reason } = req.body;

  const ledger = await StudentFee.findById(ledgerId).populate("student");
  if (!ledger) {
    return next(new AppError("Ledger not found", 404));
  }

  // Recalculate the entire balance
  ledger.concessionAmount = concessionAmount;
  ledger.finalAmount = ledger.totalAmount - ledger.concessionAmount;
  ledger.dueAmount = ledger.finalAmount - ledger.paidAmount;

  if (ledger.dueAmount <= 0) {
    ledger.dueAmount = 0;
    ledger.status = "PAID";

    // Auto-mark all installments as PAID if the total due is cleared
    if (ledger.installments && ledger.installments.length > 0) {
      ledger.installments.forEach(inst => {
        if (inst.status !== "PAID") {
          inst.status = "PAID";
        }
      });
    }
  } else {
    // If still due, status is PARTIAL (if something paid) or PENDING
    ledger.status = ledger.paidAmount > 0 ? "PARTIAL" : "PENDING";
  }

  ledger.remarks = `Concession of ${concessionAmount} applied. Reason: ${reason}`;
  await ledger.save();

  // Invalidate Caches
  shortCache.del("fee_dashboard_stats");
  if (ledger.student && ledger.student.classLevel) {
    shortCache.del(`defaulters_${ledger.student.classLevel}`);
  }
  // Also invalidate 'all' defaulters just in case
  shortCache.del("defaulters_all");

  res.status(200).json({
    status: "success",
    message: "Concession applied and status updated.",
    data: { ledger }
  });
});

/* ============================================
   3. GET DEFAULTERS REPORT (Admin)
   ============================================ */
export const getDefaultersReport = catchAsync(async (req, res, next) => {
  const { classId } = req.query;

  // Check cache
  const cacheKey = `defaulters_${classId || 'all'}`;
  if (shortCache.has(cacheKey)) {
    return res.status(200).json({
      status: "success",
      source: "cache",
      data: shortCache.get(cacheKey)
    });
  }

  const today = new Date();
  console.log("Fetching defaulters for class:", classId);

  // Use aggregation to join with Student collection and filter by classLevel
  const defaulters = await StudentFee.aggregate([
    // Match pending/partial fees
    {
      $match: {
        status: { $in: ["PENDING", "PARTIAL"] }
      }
    },
    // Lookup student to get classLevel
    {
      $lookup: {
        from: "students", // MongoDB collection name (lowercase, plural)
        localField: "student",
        foreignField: "_id",
        as: "studentData"
      }
    },
    // Unwind to convert array to object
    {
      $unwind: "$studentData"
    },
    // Filter by classLevel if provided
    ...(classId ? [{
      $match: {
        "studentData.classLevel": new mongoose.Types.ObjectId(classId)
      }
    }] : []),
    // Project only needed fields
    {
      $project: {
        student: {
          _id: "$studentData._id",
          firstName: "$studentData.firstName",
          lastName: "$studentData.lastName",
          admissionNo: "$studentData.admissionNo",
          photoUrl: "$studentData.photoUrl"
        },
        finalAmount: 1,
        paidAmount: 1,
        dueAmount: 1,
        status: 1
      }
    }
  ]);

  console.log("Defaulters:", defaulters);

  const responseData = { defaulters };
  shortCache.set(cacheKey, responseData);

  res.status(200).json({
    status: "success",
    results: defaulters.length,
    data: responseData
  });
});



export const getStudentFeeLedgerByNameOrAdmission = catchAsync(async (req, res, next) => {
  const { name, admissionNo } = req.query;
  const { yearId } = req.params;

  if (!name && !admissionNo) {
    return next(new AppError('Please provide either name or admission number.', 400));
  }

  // Build query object
  const query = {};
  if (name) query.name = new RegExp(name, 'i'); // Case-insensitive search
  if (admissionNo) query.admissionNo = admissionNo;

  // Find student(s) matching the criteria
  const students = await Student.find(query);

  if (students.length === 0) {
    return next(new AppError('No student found with the provided details.', 404));
  }

  const ledgers = await Promise.all(
    students.map(async (student) => {
      const ledger = await StudentFee.findOne({
        student: student._id,
        academicYear: yearId
      })
        .populate('student', 'name admissionNo')
        .populate('feeStructure', 'name');

      return ledger;
    })
  );

  // Filter out null ledgers (if no ledger found for a student)
  const validLedgers = ledgers.filter(ledger => ledger !== null);

  if (validLedgers.length === 0) {
    return next(new AppError('No fee ledger found for the provided student(s) and year.', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { ledgers: validLedgers }
  });
});




export const getDashboardStats = catchAsync(async (req, res, next) => {
  // Check cache
  const cacheKey = "fee_dashboard_stats";
  if (shortCache.has(cacheKey)) {
    return res.status(200).json({
      status: "success",
      source: "cache",
      data: shortCache.get(cacheKey)
    });
  }

  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  // 1. Today's Collection
  const todayCollection = await FeePayment.aggregate([
    { $match: { paymentDate: { $gte: startOfDay, $lte: endOfDay } } },
    { $group: { _id: null, total: { $sum: "$amountPaid" } } }
  ]);

  // 2. Total Collection (All time)
  const totalCollection = await FeePayment.aggregate([
    { $group: { _id: null, total: { $sum: "$amountPaid" } } }
  ]);

  // 3. Total Pending Amount (All students with status PENDING or PARTIAL)
  const pendingStats = await StudentFee.aggregate([
    { $match: { status: { $in: ["PENDING", "PARTIAL"] } } },
    { $group: { _id: null, totalPending: { $sum: "$dueAmount" } } }
  ]);

  // 4. Defaulters Count
  const defaultersCount = await StudentFee.countDocuments({
    status: { $in: ["PENDING", "PARTIAL"] }
  });

  // 5. Total Concession Given
  const concessionStats = await StudentFee.aggregate([
    { $group: { _id: null, totalConcession: { $sum: "$concessionAmount" } } }
  ]);

  const responseData = {
    todayCollection: todayCollection[0]?.total || 0,
    totalCollection: totalCollection[0]?.total || 0,
    pendingAmount: pendingStats[0]?.totalPending || 0,
    defaultersCount: defaultersCount || 0,
    totalConcession: concessionStats[0]?.totalConcession || 0
  };

  shortCache.set(cacheKey, responseData);

  res.status(200).json({
    status: "success",
    data: responseData
  });
});



/* ============================================
   5. GET COMPREHENSIVE COLLECTION REPORT
   ============================================ */
 /* ============================================
   5. GET COMPREHENSIVE COLLECTION REPORT
   ============================================ */
export const getComprehensiveReport = catchAsync(async (req, res, next) => {
  const { classId, sectionId, status } = req.query;

  // Build filter for StudentFee
  const filter = {};
  if (status) filter.status = status;

  // Fetch all student fee records with populated student data
  let studentFees = await StudentFee.find(filter)
    .populate({
      path: 'student',
      select: 'firstName lastName admissionNo photoUrl classLevel section',
      populate: [
        { path: 'classLevel', select: 'name' },
        { path: 'section', select: 'name' }
      ]
    })
    .sort('-createdAt');

  // Filter by class and section (from populated student data)
  if (classId) {
    studentFees = studentFees.filter(fee => 
      fee.student?.classLevel?._id?.toString() === classId
    );
  }
  
  if (sectionId) {
    studentFees = studentFees.filter(fee => 
      fee.student?.section?._id?.toString() === sectionId
    );
  }

  // Calculate summary stats
  const summary = {
    totalStudents: studentFees.length,
    totalAmount: 0,
    totalPaid: 0,
    totalDue: 0,
    totalConcession: 0,
    paidCount: 0,
    partialCount: 0,
    pendingCount: 0
  };

  studentFees.forEach(fee => {
    summary.totalAmount += fee.totalAmount || 0;
    summary.totalPaid += fee.paidAmount || 0;
    summary.totalDue += fee.dueAmount || 0;
    summary.totalConcession += fee.concessionAmount || 0;

    if (fee.status === 'PAID') summary.paidCount++;
    else if (fee.status === 'PARTIAL') summary.partialCount++;
    else if (fee.status === 'PENDING') summary.pendingCount++;
  });

  res.status(200).json({
    status: "success",
    data: {
      summary,
      students: studentFees
    }
  });
});
