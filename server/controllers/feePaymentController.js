import mongoose from "mongoose";
import FeePayment from "../models/FeePayment.js";
import StudentFee from "../models/StudentFee.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";

/* ============================================
   1. COLLECT FEE (The Transaction)
   Handles Partial and Bulk payments
   ============================================ */
   export const collectFee = catchAsync(async (req, res, next) => {
    const {
      studentId,
      studentFeeId,
      amountPaid,
      paymentMode,
      referenceNo,
      remarks,
      paymentDate
    } = req.body;
  
    const collectedBy = req.user._id;
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      // 1. Find the Student's Bill (Ledger)
      const ledger = await StudentFee.findById(studentFeeId).session(session);
      if (!ledger) {
        throw new AppError("Student Fee Ledger not found", 404);
      }
  
      // --- 🔴 FIX START: Self-Heal Bad Data ---
      // If the record exists but is missing finalAmount (legacy data issue), calculate it now.
      if (!ledger.finalAmount) {
         ledger.finalAmount = ledger.totalAmount - (ledger.concessionAmount || 0);
      }
      // --- 🔴 FIX END ---
  
      // 2. Validate payment amount
      if (amountPaid > ledger.dueAmount) {
        throw new AppError("Payment amount exceeds due amount", 400);
      }
  
      // 3. Generate a Receipt Number
      const receiptNo = `REC-${Date.now().toString().slice(-6)}`;
  
      // 4. Create the immutable Receipt
      const payment = await FeePayment.create([{
        receiptNo,
        student: studentId,
        studentFee: studentFeeId,
        academicYear: ledger.academicYear,
        amountPaid,
        paymentDate: paymentDate || new Date(),
        paymentMode,
        referenceNo,
        collectedBy,
        remarks
      }], { session });
  
      // 5. Update the Ledger's Main Balance
      ledger.paidAmount += amountPaid;
  
      // --- 🔴 LOGIC CORRECTION ---
      // OLD (Wrong): ledger.dueAmount = ledger.totalAmount - ledger.paidAmount;
      // REASON: This ignores concessions!
      
      // NEW (Correct): Due is calculated from FINAL amount (Net Payable)
      ledger.dueAmount = ledger.finalAmount - ledger.paidAmount;
      
      if (ledger.dueAmount <= 0) {
        ledger.status = "PAID";
        ledger.dueAmount = 0; // Safety clamp
      } else {
        ledger.status = "PARTIAL";
      }
  
      // 6. Apply payment to Installments
      let paymentToApply = amountPaid;
  
      for (const installment of ledger.installments) {
        if (installment.status === "PAID") continue;
  
        const dueOnInstallment = installment.amount - installment.paidAmount;
  
        if (paymentToApply >= dueOnInstallment) {
          paymentToApply -= dueOnInstallment;
          installment.paidAmount += dueOnInstallment;
          installment.status = "PAID";
        } else {
          installment.paidAmount += paymentToApply;
          installment.status = "PARTIAL";
          paymentToApply = 0;
          break;
        }
      }
  
      await ledger.save({ session }); // This will now succeed because finalAmount is set
  
      await session.commitTransaction();
  
      res.status(201).json({
        status: "success",
        message: "Payment recorded successfully",
        data: {
          payment: payment[0],
          ledgerStatus: ledger.status
        }
      });
  
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      session.endSession();
    }
  });


/* ============================================
   2. GET PAYMENT HISTORY (Student's Receipts)
   ============================================ */
export const getPaymentHistory = catchAsync(async (req, res, next) => {
  const { studentId } = req.params;
  const { yearId } = req.query;

  const filter = { student: studentId };
  if (yearId) filter.academicYear = yearId;

  const payments = await FeePayment.find(filter)
    .populate("collectedBy", "name")
    .sort("-paymentDate");

  res.status(200).json({
    status: "success",
    results: payments.length,
    data: { payments }
  });
});

/* ============================================
   3. GET COLLECTION REPORT (Admin Dashboard)
   ============================================ */
export const getCollectionReport = catchAsync(async (req, res, next) => {
  const { date } = req.query; // "YYYY-MM-DD"

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const report = await FeePayment.aggregate([
    { $match: { paymentDate: { $gte: startOfDay, $lte: endOfDay } } },
    {
      $group: {
        _id: "$paymentMode", // Group by CASH, UPI, etc.
        totalAmount: { $sum: "$amountPaid" },
        count: { $sum: 1 }
      }
    }
  ]);

  const total = report.reduce((sum, r) => sum + r.totalAmount, 0);

  res.status(200).json({
    status: "success",
    data: {
      totalCollection: total,
      breakdown: report
    }
  });
});