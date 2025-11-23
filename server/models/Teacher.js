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
    }, // Auto-generated: "225001"

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
    qualification: { type: String },
    experience: { type: Number },
    
    mainSubject: { type: String },
    subjects: [{ type: String }],
    
    // 🏫 Responsibility
    classTeacherOf: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Section" 
    },

    bankDetailsUrl: { type: String, select: false },

    // 📅 HR Details
    joiningDate: { type: Date, default: Date.now },
    salary: { type: Number, select: false }, 
    address: String,
    photoUrl: String,
    perviousSchool: String,

    role: {
      type: String,
      default: "TEACHER"
    },

    status: {
      type: String,
      enum: ["ACTIVE", "ON_LEAVE", "LEFT"],
      default: "ACTIVE",
      index: true
    }
  },
  { timestamps: true }
);

// 🆔 Auto-generate Teacher ID: 225001, 225002, etc.
teacherSchema.pre("save", async function (next) {
  if (this.teacherId) return next(); // Skip if already exists

  const prefix = "2"; // Constant
  const year = new Date().getFullYear().toString().slice(-2); // "25"

  // Find last teacher with this year pattern
  const lastTeacher = await mongoose.model("Teacher")
    .findOne({ teacherId: new RegExp(`^${prefix}${year}`) })
    .sort({ teacherId: -1 })
    .lean();

  let newIncrement = 1;

  if (lastTeacher) {
    const lastNo = lastTeacher.teacherId;
    const lastInc = parseInt(lastNo.slice(3)); // Skip "2" + "25"
    newIncrement = lastInc + 1;
  }

  const padded = String(newIncrement).padStart(3, "0"); // 001, 002, 003
  this.teacherId = `${prefix}${year}${padded}`; // 225001

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
