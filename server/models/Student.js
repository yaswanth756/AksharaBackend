import mongoose from "mongoose";

// ---------------------------------------------
// COUNTER COLLECTION (for atomic increments)
// ---------------------------------------------
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  year: String,
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model("Counter", counterSchema);

// ---------------------------------------------
// STUDENT SCHEMA
// ---------------------------------------------
const studentSchema = new mongoose.Schema(
  {
    admissionNo: {
      type: String,
      unique: true,
      trim: true,
    },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ["MALE", "FEMALE", "OTHER"], required: true },

    aadharNo: { type: Number, unique: true },
    transferceritificateUrl: String,
    aadharacardUrl: String,

    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Parent", required: true },

    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    classLevel: { type: mongoose.Schema.Types.ObjectId, ref: "ClassLevel", required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: "Section"},

    status: {
      type: String,
      enum: ["ACTIVE", "ALUMNI", "TRANSFERRED", "SUSPENDED", "WITHDRAWN"],
      default: "ACTIVE",
    },

    admissionDate: { type: Date, default: Date.now },
    rollNo: Number,
  },
  { timestamps: true }
);

// ---------------------------------------------
// AUTO-GENERATE ADMISSION NUMBER (ATOMIC)
// ---------------------------------------------
studentSchema.pre("save", async function (next) {
  if (this.admissionNo) return next(); // already exists → skip

  const prefix = "1";
  const year = new Date().getFullYear().toString().slice(-2);
  const counterId = `admission_${year}`; // "admission_25"

  // Atomic increment - MongoDB locks, increments, returns in one operation
  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 }, year }, // $inc is atomic - prevents race conditions
    { new: true, upsert: true } // return updated doc, create if not exists
  );

  const padded = String(counter.seq).padStart(3, "0"); // 001, 002, 003...
  this.admissionNo = `${prefix}${year}${padded}`; // 125001, 125002...

  next();
});

// Unique Roll No (year+class+section)
studentSchema.index(
  { academicYear: 1, classLevel: 1, section: 1, rollNo: 1 },
  { unique: true, partialFilterExpression: { rollNo: { $exists: true } } }
);

studentSchema.index({
  firstName: "text",
  lastName: "text",
  admissionNo: "text",
});

export default mongoose.model("Student", studentSchema);
