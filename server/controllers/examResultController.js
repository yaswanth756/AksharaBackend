import Exam from "../models/Exam.js";
import ExamResult from "../models/ExamResult.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";

/* ============================================
   1. BULK UPDATE MARKS (The Power Tool)
   Handles 40 students in 1 request.
   ============================================ */
export const bulkUpdateMarks = catchAsync(async (req, res, next) => {
  const { 
    examId, 
    classId, 
    sectionId, 
    academicYearId,
    subjectName, // "Mathematics"
    marksList    // Array: [{ studentId: "ID", obtainedMarks: 85, remarks: "Good" }]
  } = req.body;

  // 1. Security: Check if Exam is Locked
  const exam = await Exam.findById(examId);
  if (!exam) return next(new AppError("Exam not found", 404));
  
  if (exam.status === "COMPLETED") {
    // Only Admin can edit completed exams
    if (req.user.role !== "ADMIN") {
      return next(new AppError("Exam is locked. Only Admin can edit marks now.", 403));
    }
  }

  // 2. Validation: Get Max Marks for this Subject
  const subjectConfig = exam.subjects.find(s => s.name === subjectName);
  if (!subjectConfig) return next(new AppError("Invalid Subject", 400));
  const maxMarks = subjectConfig.maxMarks;
  const passMarks = subjectConfig.passMarks;

  // 3. Prepare Batch Operations
  // We use a loop to fetch-modify-save to ensure 'marks' array integrity
  // (Similar logic to Attendance for safety)
  
  const studentIds = marksList.map(m => m.studentId);
  
  const existingResults = await ExamResult.find({
    exam: examId,
    student: { $in: studentIds }
  });

  const bulkOps = [];

  for (const entry of marksList) {
    // Validate Input (Prevent 105/100)
    if (entry.obtainedMarks > maxMarks) {
      // Skip invalid, or throw error (We choose to throw to enforce data quality)
      return next(new AppError(`Marks for student ${entry.studentId} cannot exceed ${maxMarks}`, 400));
    }

    let doc = existingResults.find(r => r.student.toString() === entry.studentId);

    // Create if new
    if (!doc) {
      doc = new ExamResult({
        student: entry.studentId,
        exam: examId,
        academicYear: academicYearId,
        classLevel: classId,
        section: sectionId,
        marks: []
      });
    }

    // 4. Update Specific Subject
    // Remove old mark for this subject
    doc.marks = doc.marks.filter(m => m.subjectName !== subjectName);

    // Add new mark
    doc.marks.push({
      subjectName,
      obtainedMarks: entry.obtainedMarks,
      totalMarks: maxMarks,
      // Auto-Grade Logic (Simple Example)
      grade: entry.obtainedMarks >= (maxMarks * 0.9) ? "A1" : "B", 
      status: entry.obtainedMarks >= passMarks ? "PASS" : "FAIL",
      gradedBy: req.user._id, // AUDIT TRAIL: Who marked this?
      remarks: entry.remarks
    });

    // 5. Recalculate Totals (The Auto-Math)
    doc.totalObtained = doc.marks.reduce((sum, m) => sum + m.obtainedMarks + (m.graceMarks || 0), 0);
    doc.totalMaxMarks = doc.marks.reduce((sum, m) => sum + m.totalMarks, 0);
    doc.percentage = doc.totalMaxMarks > 0 ? (doc.totalObtained / doc.totalMaxMarks) * 100 : 0;
    
    // Overall Result Status
    const hasFailed = doc.marks.some(m => m.status === "FAIL");
    doc.resultStatus = hasFailed ? "FAIL" : "PASS";

    // Audit Stamp
    doc.lastModifiedBy = req.user._id;

    // 6. Add to Batch
    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id || undefined, student: entry.studentId, exam: examId },
        // Mongoose bulkWrite with 'update' pipeline or simple $set
        // Since we modified the doc object, we use $set for everything
        update: { $set: { 
            marks: doc.marks, 
            totalObtained: doc.totalObtained,
            totalMaxMarks: doc.totalMaxMarks,
            percentage: doc.percentage,
            resultStatus: doc.resultStatus,
            lastModifiedBy: doc.lastModifiedBy,
            // Context fields for upsert
            classLevel: classId, section: sectionId, academicYear: academicYearId
        }},
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await ExamResult.bulkWrite(bulkOps);
  }

  res.status(200).json({
    status: "success",
    message: `Marks updated for ${marksList.length} students`
  });
});

/* ============================================
   2. ADMIN OVERRIDE (Grace Marks / Correction)
   Handles Single Student Edit with Reason Log
   ============================================ */
export const updateSingleResult = catchAsync(async (req, res, next) => {
  const { id } = req.params; // ExamResult ID
  const { subjectName, newMarks, graceMarks, reason } = req.body;

  const result = await ExamResult.findById(id);
  if (!result) return next(new AppError("Result not found", 404));

  // Security: Only Admin can change locked results
  if (result.isLocked && req.user.role !== "ADMIN") {
    return next(new AppError("This result is locked.", 403));
  }

  // Find Subject
  const subjectIndex = result.marks.findIndex(m => m.subjectName === subjectName);
  if (subjectIndex === -1) return next(new AppError("Subject not found in this result", 404));

  // Update
  if (newMarks !== undefined) result.marks[subjectIndex].obtainedMarks = newMarks;
  if (graceMarks !== undefined) result.marks[subjectIndex].graceMarks = graceMarks;

  // Audit Log
  result.modificationReason = reason; // "Principal added grace marks"
  result.lastModifiedBy = req.user._id;

  // Recalculate Totals (Same logic as above)
  result.totalObtained = result.marks.reduce((sum, m) => sum + m.obtainedMarks + (m.graceMarks || 0), 0);
  // ... (percentage calc) ...
  result.percentage = (result.totalObtained / result.totalMaxMarks) * 100;

  await result.save();

  res.status(200).json({
    status: "success",
    message: "Result updated manually",
    data: { result }
  });
});

/* ============================================
   3. GET CLASS REPORT (The Grid)
   ============================================ */
export const getClassExamReport = catchAsync(async (req, res, next) => {
  const { examId, classId, sectionId } = req.query;

  const results = await ExamResult.find({
    exam: examId,
    classLevel: classId,
    section: sectionId
  })
  .populate("student", "firstName lastName admissionNo")
  .sort("-percentage"); // Toppers first

  res.status(200).json({
    status: "success",
    results: results.length,
    data: { results }
  });
});


// In examResultController.js
export const getMarks = catchAsync(async (req, res, next) => {
    const { examId, sectionId, subjectName } = req.query;
  
    const results = await ExamResult.find({
      exam: examId,
      section: sectionId
    }).select("student marks");
  
    const marks = [];
    results.forEach(result => {
      const subject = result.marks.find(m => m.subjectName === subjectName);
      if (subject) {
        marks.push({
          studentId: result.student,
          obtainedMarks: subject.obtainedMarks,
          remarks: subject.remarks
        });
      }
    });
  
    res.status(200).json({
      status: "success",
      data: { marks }
    });
});
  