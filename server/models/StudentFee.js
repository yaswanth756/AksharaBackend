import mongoose from "mongoose";

// This is the STUDENT'S PERSONAL BILL (Ledger)
// It only tracks balances.
const studentFeeSchema = new mongoose.Schema(
  {
    student: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Student", 
      required: true 
    },
    academicYear: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "AcademicYear", 
      required: true 
    },
    feeStructure: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "FeeStructure", 
      required: true 
    },

    // --- The Main Balance Sheet ---
    totalAmount: { type: Number, required: true }, // e.g., 50,000
    concessionAmount: { type: Number, default: 0 }, // e.g., 5,000 (Scholarship)
    finalAmount: { type: Number, required: true }, // 45,000 (Total - Concession)
    
    paidAmount: { type: Number, default: 0 }, // Total paid so far
    dueAmount: { type: Number, required: true },   // (Final - Paid)
    
    status: {
      type: String,
      enum: ["PENDING", "PARTIAL", "PAID"],
      default: "PENDING",
      index: true
    },

    // --- The Installment Plan (What is Owed) ---
    installments: [
      {
        name: String,      // "Tuition Fee - April"
        amount: Number,    // 5000
        dueDate: Date,
        
        // This tracks how much of this specific installment is paid
        paidAmount: { type: Number, default: 0 },
        
        status: { 
          type: String, 
          enum: ["PENDING", "PAID", "PARTIAL"], 
          default: "PENDING" 
        }
      }
    ],
    remarks: String,
  },
  { timestamps: true }
);

studentFeeSchema.index({ student: 1, academicYear: 1 }, { unique: true });

export default mongoose.model("StudentFee", studentFeeSchema);