import mongoose from "mongoose";

const admissionInquirySchema = new mongoose.Schema(
  {
    inquiryNo: { type: String, unique: true },
    childName: { type: String, required: true, trim: true },
    parentName: { type: String, required: true, trim: true },
    parentPhone: { 
      type: String, 
      required: true, 
      index: true
    },
    parentEmail: { 
      type: String, 
      required: true,  // ✅ Make it required since frontend validates this
      lowercase: true, 
      trim: true 
    },
    
    // ✅ Support both string and ObjectId reference
    classApplyingFor: { 
      type: mongoose.Schema.Types.Mixed,  // Accepts both String and ObjectId
      required: true
    },
    
    previousSchool: { type: String, default: 'N/A' },
    address: { type: String, required: true },
    
    status: {
      type: String,
      enum: {
        values: ["pending", "contacted", "approved", "rejected"],
        message: "Status must be pending, contacted, approved, or rejected",
      },
      default: "pending",
      lowercase: true,
    },
    
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
      default: "",
    },
    
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    
    reviewedOn: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);


export default mongoose.model("AdmissionInquiry", admissionInquirySchema);