import mongoose from "mongoose";

const examSchema = new mongoose.Schema(
  {
    // 🏷️ Identity
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },

    // 🔗 Context
    academicYear: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "AcademicYear", 
      required: true 
    },
    classLevel: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "ClassLevel", 
      required: true 
    },

    // 🎯 Section Logic (Global vs Specific)
    applicableSections: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Section" }
    ],

    // 📝 Configuration
    subjects: [
      {
        name: { type: String, required: true },
        
        date: { type: Date }, 
        startTime: { type: String }, 
        durationMins: { type: Number },
        
        maxMarks: { type: Number, required: true },
        passMarks: { type: Number, required: true },
        
        isOptional: { type: Boolean, default: false } 
      }
    ],

    // 🚦 Status
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "COMPLETED"],
      default: "DRAFT",
      index: true
    }
  },
  { timestamps: true }
);

// ⚡ Prevent Duplicates
examSchema.index({ academicYear: 1, classLevel: 1, name: 1 }, { unique: true });

export default mongoose.model("Exam", examSchema);