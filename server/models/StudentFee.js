// models/StudentFee.js
import mongoose from "mongoose";

const studentFeeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
    },
    classLevel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassLevel",
      required: true,
    },
    feeStructure: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeStructure",
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    dueAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"],
      default: "PENDING",
    },
    installments: [
      {
        name: String,
        amount: Number,
        dueDate: Date,
        status: {
          type: String,
          enum: ["PENDING", "PAID", "OVERDUE", "CANCELLED"],
          default: "PENDING",
        },
        paymentDate: Date,
        paymentMode: String,
        referenceNo: String,
        collectedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Admin",
        },
      },
    ],
    remarks: String,
  },
  { timestamps: true }
);

// Indexes for better query performance
studentFeeSchema.index({ student: 1, academicYear: 1 });
studentFeeSchema.index({ status: 1 });
studentFeeSchema.index({ "installments.dueDate": 1 });

export default mongoose.model("StudentFee", studentFeeSchema);