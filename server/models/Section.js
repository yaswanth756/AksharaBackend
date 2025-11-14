import mongoose from "mongoose";

const sectionSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    }, // "A", "B", "Red", "Blue"

    // The Link: "This section belongs to Class 10"
    classLevel: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "ClassLevel", 
      required: true,
      index: true // Faster queries to "Get all sections of Class 10"
    },

    // Who is in charge?
    classTeacher: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Teacher" 
    },

    capacity: { 
      type: Number, 
      default: 40 
    },

    roomNumber: { type: String }
  },
  { timestamps: true }
);

// ⚡ OPTIMIZATION: Compound Index
// Prevents duplicate sections in the same class
sectionSchema.index({ classLevel: 1, name: 1 }, { unique: true });

export default mongoose.model("Section", sectionSchema);