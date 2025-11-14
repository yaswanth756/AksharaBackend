import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    // 🆔 Identity
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },

    // 🔑 Login ID (Phone Number)
    // This is their Username.
    phone: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true,
      index: true 
    },
    
    email: { type: String, lowercase: true, trim: true },

    // 👮 Roles (Restricted to just TWO)
    role: {
      type: String,
      enum: ["ADMIN", "OPERATOR"], 
      required: true,
      default: "OPERATOR"
    },

    // 🔐 OTP Logic (For Login)
    // Stored temporarily. "select: false" ensures it's not returned in API calls.
    otp: { 
      type: String, 
      select: false 
    },
    otpExpires: { 
      type: Date, 
      select: false 
    },

    // 🚦 Status (To block an operator who left the job)
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE"
    },

    lastLogin: { type: Date }
  },
  { timestamps: true }
);

// Helper: Check if OTP is valid
adminSchema.methods.validateOtp = function (inputOtp) {
  return this.otp === inputOtp && this.otpExpires > Date.now();
};

export default mongoose.model("Admin", adminSchema);