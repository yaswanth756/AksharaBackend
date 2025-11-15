import mongoose from "mongoose";

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
// AUTO-GENERATE ADMISSION NUMBER
// ---------------------------------------------
studentSchema.pre("save", async function (next) {
  if (this.admissionNo) return next(); // already exists → skip

  const prefix = "1"; // constant
  const year = new Date().getFullYear().toString().slice(-2); // last 2 digits of year

  // find last student admission number for current year
  const lastStudent = await mongoose
    .model("Student")
    .findOne({ admissionNo: new RegExp(`^${prefix}${year}`) })
    .sort({ admissionNo: -1 })
    .lean();

  let newIncrement = 1;

  if (lastStudent) {
    const lastNo = lastStudent.admissionNo;
    const lastInc = parseInt(lastNo.slice(3)); // skip prefix & year
    newIncrement = lastInc + 1;
  }

  const padded = String(newIncrement).padStart(4, "0"); // → 0001, 0002, 0264

  this.admissionNo = `${prefix}${year}${padded}`;

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
