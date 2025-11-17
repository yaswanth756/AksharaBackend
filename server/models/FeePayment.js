import mongoose from "mongoose";

// This is the RECEIPT
// A new one is created for every single transaction (Cash, UPI, etc.)
const feePaymentSchema = new mongoose.Schema(
  {
    receiptNo: { 
      type: String, 
      required: true, 
      unique: true 
    },
    
    // Links
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    studentFee: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "StudentFee", 
      required: true 
    }, // Links to the Bill
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },

    // Transaction Details
    amountPaid: { type: Number, required: true },
    paymentDate: { type: Date, default: Date.now },
    paymentMode: { 
      type: String, 
      enum: ["CASH", "UPI", "CHEQUE", "BANK_TRANSFER"], 
      required: true 
    },
    referenceNo: String, // UPI ID or Cheque No.
    
    // Audit Trail
    collectedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Admin", // Or dynamic ref to Admin/Operator
      required: true 
    },
    remarks: String
  }, 
  { timestamps: true }
);

feePaymentSchema.index({ student: 1, academicYear: 1 });
feePaymentSchema.index({ paymentDate: 1 });

export default mongoose.model("FeePayment", feePaymentSchema);