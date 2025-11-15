import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const teacherSchema = new mongoose.Schema(
  {
    // 🆔 Identity
    teacherId: { 
      type: String, 
      unique: true, 
      uppercase: true,
      trim: true
    }, // Auto-generated: "TCH-2025-001"

    name: { 
      type: String, 
      required: true, 
      trim: true 
    },

    // 📅 Date of Birth (Required for default password)
    dob: {
      type: Date,
      required: true
    },

    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER"],
      required: true
    },

    // 🔐 Login Credentials
    phone: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true,
      index: true 
    },
    email: { type: String, lowercase: true, trim: true },
    password: { type: String, select: false },

    // 🎓 Professional Info
    qualification: { type: String }, // e.g. "M.Sc Mathematics"
    experience: { type: Number },    // Years of experience
    
    mainSubject: { type: String },
    // What can they teach? (Crucial for TimeTable)
    subjects: [{ type: String }],    // ["Mathematics", "Physics"]
    
    // 🏫 Responsibility
    classTeacherOf: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Section" 
    },

    bankDetailsUrl: { type: String, select: false }, // Hidden from normal queries

    // 📅 HR Details (Simplified)
    joiningDate: { type: Date, default: Date.now },
    salary: { type: Number, select: false }, // Hidden from normal queries
    address: String,
    photoUrl: String,
    perviousSchool: String,

    status: {
      type: String,
      enum: ["ACTIVE", "ON_LEAVE", "LEFT"],
      default: "ACTIVE",
      index: true
    }
  },
  { timestamps: true }
);

// 🆔 Auto-generate Teacher ID
teacherSchema.pre("save", async function (next) {
  if (this.isNew && !this.teacherId) {
    const currentYear = new Date().getFullYear();
    
    // Find the last teacher created this year
    const lastTeacher = await mongoose.model("Teacher")
      .findOne({ teacherId: new RegExp(`^TCH-${currentYear}-`) })
      .sort({ teacherId: -1 })
      .select("teacherId");

    let nextNumber = 1;
    if (lastTeacher) {
      const lastNumber = parseInt(lastTeacher.teacherId.split("-")[2]);
      nextNumber = lastNumber + 1;
    }

    // Format: TCH-2025-001
    this.teacherId = `TCH-${currentYear}-${String(nextNumber).padStart(3, "0")}`;
  }
  next();
});

// 🔒 Set Default Password from DOB & Hash
teacherSchema.pre("save", async function (next) {
  // If password is not set, generate from DOB
  if (this.isNew && !this.password && this.dob) {
    const d = new Date(this.dob);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    this.password = `${day}${month}${year}`; // Format: DDMMYYYY
  }

  // Hash password if modified
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  
  next();
});

// 📝 Text Index for Search
teacherSchema.index({ name: "text", teacherId: "text", phone: "text" });

// Helper: Check Password
teacherSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("Teacher", teacherSchema);
