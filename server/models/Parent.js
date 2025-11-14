import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const parentSchema = new mongoose.Schema(
  {
    primaryPhone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      select: false,
    },

    fatherName: String,
    motherName: String,
    email: { type: String, trim: true },

    fatherOccupation: String,
    motherOccupation: String,

    aadharaPhotos: {
      father: String,
      mother: String,
    },

    banckAccountPhoto: String,
    rationCardPhoto: String,

    children: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
        relation: {
          type: String,
          enum: ["FATHER", "MOTHER", "GUARDIAN"],
          default: "FATHER",
        },
      },
    ],

    address: String,

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "BLOCKED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true }
);

// Hash password before save
parentSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

parentSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("Parent", parentSchema);
