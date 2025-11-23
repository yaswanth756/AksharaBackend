import mongoose from "mongoose";
import Student from "../models/Student.js";
import Parent from "../models/Parent.js";
import StudentFee from "../models/StudentFee.js";
import Attendance from "../models/Attendance.js";
import ExamResult from "../models/ExamResult.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";
import { shortCache } from "../utils/cache.js";

// 💡 IMPORT THE FINANCE HELPER
import { generateStudentFeeLedger } from "./feeStructureController.js";

/* ============================================
   1. ADMIT STUDENT (The Big Transaction)
   ============================================ */
export const admitStudent = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      // Student Details
      firstName,
      lastName,
      dob,
      gender,
      aadharNo,
      transferceritificateUrl,
      aadharacardUrl,

      // Academic Details
      academicYearId,
      classId,
      sectionId, // Can be "" or null

      // Parent Details
      fatherName,
      motherName,
      parentPhone,
      parentEmail,
      fatherOccupation,
      motherOccupation,
      banckAccountPhoto,
      address,
    } = req.body;

    // -----------------------------------------------
    // Handle Optional Section
    // -----------------------------------------------
    const finalSectionId = sectionId && sectionId !== "" ? sectionId : null;

    // -----------------------------------------------
    // Helper: Convert DOB → Password (DDMMYYYY)
    // -----------------------------------------------
    const formatDobAsPassword = (dob) => {
      const d = new Date(dob);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}${month}${year}`;
    };

    // -----------------------------------------------
    // STEP 1: Find or Create Parent
    // -----------------------------------------------
    let parent = await Parent.findOne({ primaryPhone: parentPhone }).session(session);

    if (!parent) {
      parent = await Parent.create(
        [
          {
            primaryPhone: parentPhone,
            fatherName,
            motherName,
            email: parentEmail,
            fatherOccupation,
            motherOccupation,
            address,
            banckAccountPhoto,
            password: formatDobAsPassword(dob), // Auto-generate password
          },
        ],
        { session }
      );

      parent = parent[0]; // .create returns an array when using session
    }

    // -----------------------------------------------
    // STEP 2: Create Student
    // -----------------------------------------------
    const newStudent = await Student.create(
      [
        {
          firstName,
          lastName,
          dob,
          gender,
          aadharNo,
          transferceritificateUrl,
          aadharacardUrl,
          parent: parent._id,
          academicYear: academicYearId,
          classLevel: classId,
          section: finalSectionId, // Uses null if not provided
          status: "ACTIVE",
        },
      ],
      { session }
    );

    const studentId = newStudent[0]._id;

    // -----------------------------------------------
    // STEP 3: Link Student → Parent
    // -----------------------------------------------
    await Parent.findByIdAndUpdate(
      parent._id,
      {
        $push: {
          children: {
            student: studentId,
            relation: "FATHER", // Default, can be an input field
          },
        },
      },
      { session }
    );

    // -----------------------------------------------
    // STEP 4: Fee Ledger (Auto-Generation)
    // -----------------------------------------------
    // Call the helper from feeStructureController
    await generateStudentFeeLedger(
      newStudent[0], // Pass the new student object
      academicYearId, // Pass the Year ID
      classId, // Pass the Class ID
      session // Pass the transaction session
    );

    // -----------------------------------------------
    // COMMIT
    // -----------------------------------------------
    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      message: "Student Admitted Successfully",
      data: { student: newStudent[0] },
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

/* ============================================
   2. GET ALL STUDENTS (With Pagination)
   ============================================ */
export const getAllStudents = catchAsync(async (req, res, next) => {
  const filter = {};

  // Filters
  if (req.query.classId) filter.classLevel = req.query.classId;
  if (req.query.sectionId) filter.section = req.query.sectionId;
  if (req.query.status) filter.status = req.query.status;

  // Search
  if (req.query.search) {
    filter.$text = { $search: req.query.search };
  }

  // Pagination
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  const skip = (page - 1) * limit;

  // Get total count for pagination headers
  const total = await Student.countDocuments(filter);

  // Fetch students
  const students = await Student.find(filter)
    .select("_id admissionNo firstName lastName rollNo status classLevel section")
    .populate("classLevel", "name")
    .populate("section", "name")
    .skip(skip)
    .limit(limit);

  // Format clean response for the frontend
  const result = students.map((s) => ({
    _id: s._id,
    admissionNo: s.admissionNo,
    name: `${s.firstName} ${s.lastName || ""}`,
    class: s.classLevel?.name,
    section: s.section?.name,
    rollNo: s.rollNo || null,
    status: s.status,
  }));

  res.status(200).json({
    status: "success",
    results: result.length,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total,
    data: { students: result },
  });
});

/* ============================================
   3. SEARCH STUDENTS
   ============================================ */
export const searchStudents = catchAsync(async (req, res, next) => {
  const { query } = req.query;
  if (!query) {
    return next(new AppError("Please provide a search term", 400));
  }

  const students = await Student.find(
    { $text: { $search: query } },
    { score: { $meta: "textScore" } }
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(10)
    .populate("classLevel", "name")
    .populate("section", "name")
    .select("firstName lastName admissionNo photoUrl classLevel section status");

  console.log("Search Students Result:", students);
  res.status(200).json({
    status: "success",
    results: students.length,
    data: { students }
  });
});

/* ============================================
   4. GET DASHBOARD STATS
   ============================================ */
export const getStudentStats = catchAsync(async (req, res, next) => {
  // Check cache
  const cacheKey = "student_dashboard_stats";
  if (shortCache.has(cacheKey)) {
    return res.status(200).json({
      status: "success",
      source: "cache",
      data: shortCache.get(cacheKey)
    });
  }

  const stats = await Student.aggregate([
    { $match: { status: "ACTIVE" } },
    {
      $facet: {
        totalCount: [{ $count: "count" }],
        genderDistribution: [
          { $group: { _id: "$gender", count: { $sum: 1 } } }
        ],
        classDistribution: [
          { $group: { _id: "$classLevel", count: { $sum: 1 } } },
          {
            $lookup: {
              from: "classlevels",
              localField: "_id",
              foreignField: "_id",
              as: "classInfo"
            }
          },
          {
            $project: {
              className: { $arrayElemAt: ["$classInfo.name", 0] },
              order: { $arrayElemAt: ["$classInfo.order", 0] },
              count: 1
            }
          },
          { $sort: { order: 1 } }
        ]
      }
    }
  ]);

  const responseData = {
    totalStudents: stats[0].totalCount[0]?.count || 0,
    genderStats: stats[0].genderDistribution,
    classStats: stats[0].classDistribution
  };

  shortCache.set(cacheKey, responseData);

  res.status(200).json({
    status: "success",
    data: responseData
  });
});

/* ============================================
   5. UPDATE STUDENT (Correct/Add Details)
   ============================================ */
/* ============================================
 * UPDATE STUDENT (with Parent Details)
 * ============================================ */
export const updateStudent = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Block sensitive fields from being updated
  if (req.body.admissionNo || req.body.balance || req.body.academicYear) {
    return next(new AppError("Cannot update sensitive fields from this route", 400));
  }

  // Separate parent fields from student fields
  const parentFields = [
    'fatherName',
    'motherName',
    'email',
    'fatherOccupation',
    'motherOccupation',
    'address'
  ];

  const parentData = {};
  const studentData = { ...req.body };

  // Extract parent fields from request body
  parentFields.forEach(field => {
    if (req.body[field] !== undefined) {
      parentData[field] = req.body[field];
      delete studentData[field]; // Remove from student data
    }
  });

  // Start a MongoDB session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1️⃣ Update Student document
    const student = await Student.findByIdAndUpdate(
      id,
      studentData,
      {
        new: true,
        runValidators: true,
        session // Use transaction session
      }
    );

    if (!student) {
      await session.abortTransaction();
      return next(new AppError("No student found with that ID", 404));
    }

    // 2️⃣ Update Parent document (if parent data exists)
    let updatedParent = null;
    if (Object.keys(parentData).length > 0 && student.parent) {
      updatedParent = await Parent.findByIdAndUpdate(
        student.parent, // Parent reference from student
        parentData,
        {
          new: true,
          runValidators: true,
          session // Use same transaction session
        }
      );

      if (!updatedParent) {
        await session.abortTransaction();
        return next(new AppError("Parent record not found", 404));
      }
    }

    // Commit transaction if both updates succeed
    await session.commitTransaction();

    // Populate parent details for response
    await student.populate('parent');

    res.status(200).json({
      status: "success",
      message: "Student and parent details updated successfully",
      data: {
        student
      }
    });

  } catch (error) {
    // Rollback on any error
    await session.abortTransaction();
    return next(new AppError(`Update failed: ${error.message}`, 500));
  } finally {
    session.endSession();
  }
});


/* ============================================
   6. GET SINGLE STUDENT (For Profile/Edit Page)
   ============================================ */
export const getStudent = catchAsync(async (req, res, next) => {
  const student = await Student.findById(req.params.id)
    .populate("parent")
    .populate("classLevel")
    .populate("section")
    .populate("academicYear");

  if (!student) {
    return next(new AppError("No student found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: { student }
  });
});




export const getStudentProfile = catchAsync(async (req, res, next) => {
  const { id } = req.params; 
  const { yearId } = req.query;

  // 1. Validate ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid Student ID format", 400));
  }
  const studentObjectId = new mongoose.Types.ObjectId(id);

  // 2. Fetch Student
  const student = await Student.findById(id)
    .populate("parent")
    .populate("classLevel", "name")
    .populate("section", "name")
    .populate("academicYear", "name");

  if (!student) {
    return next(new AppError("Student not found", 404));
  }

  const currentYearId = yearId 
    ? new mongoose.Types.ObjectId(yearId) 
    : student.academicYear?._id;

  // 3. Fetch Fee Ledger
  const feePromise = StudentFee.findOne({ 
    student: id, 
    academicYear: currentYearId 
  }).sort("-createdAt");

  // 4. Fetch Attendance Stats (Aggregation)
  // 🛠️ FIX: Removed strict 'academicYear' check if yearId is not passed.
  // This ensures we find attendance even if Year ID is mismatched in DB.
  const matchStage = {
    userId: studentObjectId,
    userType: "STUDENT"
  };

  // Only filter by year if explicitly asked, OR if you want strictly current year data.
  // For profile view, showing ALL time attendance is often better if data is sparse.
  // But if you want strictly this year, uncomment the next line:
  // matchStage.academicYear = currentYearId; 

  const attendancePromise = Attendance.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$userId",
        totalPresent: { $sum: "$stats.present" },
        totalAbsent: { $sum: "$stats.absent" },
        totalLate: { $sum: "$stats.late" },
        totalLeaves: { $sum: "$stats.leaves" }
      }
    }
  ]);

  // 5. Fetch Exam Results
  const examsPromise = ExamResult.find({
    student: id,
    academicYear: currentYearId
  })
  .populate("exam", "name status")
  .sort("-createdAt");

  // 🚀 EXECUTE PARALLEL
  const [feeLedger, attendanceStats, examResults] = await Promise.all([
    feePromise,
    attendancePromise,
    examsPromise
  ]);

  // --- FORMAT RESPONSE ---
  const att = attendanceStats[0] || { totalPresent: 0, totalAbsent: 0, totalLate: 0, totalLeaves: 0 };
  const totalDays = att.totalPresent + att.totalAbsent + att.totalLate + att.totalLeaves;
  const attendancePercentage = totalDays > 0 
    ? Math.round((att.totalPresent / totalDays) * 100) 
    : 0;

  const examSummary = examResults.map(r => ({
    examId: r.exam?._id,
    examName: r.exam?.name || "Unknown Exam",
    percentage: r.percentage?.toFixed(2) || "0",
    overallResult: r.resultStatus,
    rank: r.rank || "N/A",
    subjects: r.marks.map(m => ({
      name: m.subjectName,
      obtained: m.obtainedMarks,
      max: m.totalMarks,
      grade: m.grade,
      status: m.status
    }))
  }));

  res.status(200).json({
    status: "success",
    data: {
      profile: {
        id: student._id,
        admissionNo: student.admissionNo,
        name: `${student.firstName} ${student.lastName || ""}`,
        photo: student.photoUrl,
        class: `${student.classLevel?.name || ""} - ${student.section?.name || ""}`,
        rollNo: student.rollNo,
        status: student.status,
        dob: student.dob,
        gender: student.gender
      },
      parent: {
        name: student.parent?.fatherName,
        phone: student.parent?.primaryPhone,
        email: student.parent?.email
      },
      feeSummary: {
        status: feeLedger?.status || "N/A",
        totalAmount: feeLedger?.finalAmount || 0,
        paidAmount: feeLedger?.paidAmount || 0,
        dueAmount: feeLedger?.dueAmount || 0,
        currency: "INR"
      },
      attendance: {
        percentage: attendancePercentage,
        present: att.totalPresent,
        absent: att.totalAbsent,
        late: att.totalLate,
        leaves: att.totalLeaves
      },
      exams: examSummary
    }
  });
});