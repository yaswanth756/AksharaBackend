import mongoose from "mongoose";

const feePaymentSchema = new mongoose.Schema(
  {
    // 🧾 Receipt Number (Auto-generated usually, e.g., "REC-1001")
    receiptNo: { 
      type: String, 
      required: true, 
      unique: true 
    },

    // 🔗 Links
    student: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Student", 
      required: true 
    },
    
    // Which "Bill" is this paying off?
    studentFee: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "StudentFee", 
      required: true 
    },
    
    academicYear: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "AcademicYear", 
      required: true 
    },

    // 💵 Payment Details
    amountPaid: { 
      type: Number, 
      required: true, 
      min: 1 
    },

    paymentDate: { 
      type: Date, 
      default: Date.now 
    },

    paymentMode: {
      type: String,
      enum: ["CASH", "UPI", "CHEQUE", "BANK_TRANSFER", "POS"],
      required: true
    },

    // Reference ID (e.g., UPI Transaction ID or Cheque No)
    referenceNo: { 
      type: String, 
      trim: true 
    },

    // 🕵️ Audit: Who took the money?
    collectedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Admin", // or 'User' depending on your auth model
      required: true 
    },

    remarks: { type: String, trim: true }
  },
  { timestamps: true }
);

// ⚡ OPTIMIZATION: Daily Collection Report
// "Show me all payments collected today sorted by time"
feePaymentSchema.index({ paymentDate: -1 });

// "Show me payment history for Student Ravi"
feePaymentSchema.index({ student: 1, paymentDate: -1 });

export default mongoose.model("FeePayment", feePaymentSchema);