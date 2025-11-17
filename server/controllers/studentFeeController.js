import StudentFee from "../models/StudentFee.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";

/* ============================================
   1. GET STUDENT LEDGER (The Bill)
   ============================================ */
export const getStudentFeeLedger = catchAsync(async (req, res, next) => {
  const { studentId } = req.params;
  const { yearId } = req.query;

  const ledger = await StudentFee.findOne({
    student: studentId,
    academicYear: yearId
  })
  .populate("student", "name admissionNo")
  .populate("feeStructure", "name");

  if (!ledger) {
    return next(new AppError("Fee Ledger not found for this student/year.", 404));
  }

  res.status(200).json({
    status: "success",
    data: { ledger }
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