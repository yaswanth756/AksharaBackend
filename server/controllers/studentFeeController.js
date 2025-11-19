import StudentFee from "../models/StudentFee.js";
import Student from "../models/Student.js";
import FeePayment from "../models/FeePayment.js";

import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";

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

  const ledger = await StudentFee.findById(ledgerId);
  if (!ledger) {
    return next(new AppError("Ledger not found", 404));
  }

  // Recalculate the entire balance
  ledger.concessionAmount = concessionAmount;
  ledger.finalAmount = ledger.totalAmount - ledger.concessionAmount;
  ledger.dueAmount = ledger.finalAmount - ledger.paidAmount;

  if (ledger.dueAmount < 0) ledger.dueAmount = 0; // Safety check

  ledger.remarks = `Concession of ${concessionAmount} applied. Reason: ${reason}`;
  await ledger.save();

  res.status(200).json({
    status: "success",
    message: "Concession applied.",
    data: { ledger }
  });
});

/* ============================================
   3. GET DEFAULTERS REPORT (Admin)
   ============================================ */
export const getDefaultersReport = catchAsync(async (req, res, next) => {
  const { classId } = req.query;
  const today = new Date();

  // Find students in a class who are NOT fully paid
  const filter = {
    status: { $in: ["PENDING", "PARTIAL"] },
    classLevel: classId
  };

  const defaulters = await StudentFee.find(filter)
    .populate("student", "firstName lastName admissionNo photoUrl")
    .select("student finalAmount paidAmount dueAmount status");

  res.status(200).json({
    status: "success",
    results: defaulters.length,
    data: { defaulters }
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

  // If multiple students found, you can return all ledgers or pick the first one
  // Here, we'll return ledgers for all matching students
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



/* ============================================
   4. GET DASHBOARD STATS (Admin Dashboard)
   ============================================ */
/* ============================================
   4. GET DASHBOARD STATS (Admin Dashboard)
   ============================================ */
   export const getDashboardStats = catchAsync(async (req, res, next) => {
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
  
    res.status(200).json({
      status: "success",
      data: {
        todayCollection: todayCollection[0]?.total || 0,
        totalCollection: totalCollection[0]?.total || 0,
        pendingAmount: pendingStats[0]?.totalPending || 0,
        defaultersCount: defaultersCount || 0,
        totalConcession: concessionStats[0]?.totalConcession || 0
      }
    });
  });
  
  