import mongoose from "mongoose";

const classLevelSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true 
    }, // "Class 10"

    // CRITICAL FOR SORTING: 
    // "Class 2" (Order: 2) comes after "Class 1" (Order: 1)
    // "Class 10" (Order: 10) comes after "Class 2"
    // Without this, "Class 10" sorts alphabetically before "Class 2"
    order: { 
      type: Number, 
      required: true, 
      unique: true 
    },

    // Optional: Description or alias
    // e.g., "Senior Secondary"
    description: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model("ClassLevel", classLevelSchema);