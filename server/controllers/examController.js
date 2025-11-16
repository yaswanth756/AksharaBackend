import Exam from "../models/Exam.js";
import ExamResult from "../models/ExamResult.js"; // Needed to lock results
import ClassLevel from "../models/ClassLevel.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";

/* ============================================
   1. CREATE EXAM (Admin Only)
   ============================================ */
export const createExam = catchAsync(async (req, res, next) => {
  const { 
    name, academicYearId, classLevelId, 
    applicableSections, // Array of Section IDs (Optional)
    subjects 
  } = req.body;

  // 1. Validate Duplicates (Prevent 2 "Mid-Terms" for same class)
  const exists = await Exam.findOne({ 
    name, 
    academicYear: academicYearId, 
    classLevel: classLevelId 
  });

  if (exists) {
    return next(new AppError("Exam with this name already exists for this class.", 400));
  }

  // 2. Create Draft
  const exam = await Exam.create({
    name,
    academicYear: academicYearId,
    classLevel: classLevelId,
    applicableSections: applicableSections || [], // Empty = Global
    subjects,
    status: "DRAFT"
  });

  res.status(201).json({
    status: "success",
    message: "Exam created in DRAFT mode.",
    data: { exam }
  });
});

/* ============================================
   2. UPDATE EXAM STATUS (Publish / Lock)
   ============================================ */
export const updateExamStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body; // "PUBLISHED" or "COMPLETED"

  const exam = await Exam.findById(id);
  if (!exam) return next(new AppError("Exam not found", 404));

  // logic: If marking COMPLETED, we lock all student results
  if (status === "COMPLETED") {
    await ExamResult.updateMany(
      { exam: id },
      { $set: { isLocked: true } }
    );
  }

  exam.status = status;
  await exam.save();

  res.status(200).json({
    status: "success",
    message: `Exam status updated to ${status}`,
    data: { exam }
  });
});

/* ============================================
   3. GET EXAMS FOR TEACHER (Context Aware)
   ============================================ */
export const getExamsForTeacher = catchAsync(async (req, res, next) => {
  const { classId, sectionId } = req.query;

  // Logic: Find exams that match Class AND (Global OR Specific Section)
  // Only show PUBLISHED exams to teachers
  const exams = await Exam.find({
    classLevel: classId,
    status: { $ne: "DRAFT" }, // Hide Drafts
    $or: [
      { applicableSections: { $size: 0 } }, // Global
      { applicableSections: { $in: [sectionId] } } // Specific
    ]
  }).select("name subjects status");

  res.status(200).json({
    status: "success",
    results: exams.length,
    data: { exams }
  });
});


export const getExamsByClass = catchAsync(async (req, res, next) => {
    const { classId } = req.query;
    if (!classId) return next(new AppError("Please provide a classId", 400));
  
    const exams = await Exam.find({ classLevel: classId }).sort("-createdAt");
    res.status(200).json({
      status: "success",
      results: exams.length,
      data: { exams }
    });
  });