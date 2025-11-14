import mongoose from "mongoose";

const academicYearSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true 
    }, // Example: "2025-2026"

    startDate: { 
      type: Date, 
      required: true 
    },

    endDate: { 
      type: Date, 
      required: true 
    },

    // Only ONE document in the database should have isCurrent: true
    isCurrent: { 
      type: Boolean, 
      default: false,
      index: true // Optimized for fast lookup on login
    },

    // Financial & Academic Safety Switch
    // If true, no Fees or Marks can be edited for this year
    isLocked: { 
      type: Boolean, 
      default: false 
    }
  },
  { timestamps: true }
);

// Virtual: Check if today is within this academic year
academicYearSchema.virtual("isActiveDate").get(function () {
  const now = new Date();
  return now >= this.startDate && now <= this.endDate;
});

export default mongoose.model("AcademicYear", academicYearSchema);