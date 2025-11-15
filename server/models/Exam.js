import mongoose from "mongoose";

const examSchema = new mongoose.Schema(
  {
    // 🏷️ Exam Name (e.g., "Annual Final Exam 2025")
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },

    // 🔗 Context: When and Where?
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

    // 🎯 SECTION LOGIC (The Workflow Fix)
    // [] = Empty Array means "Global" (All sections in Class 10 take this).
    // [ID_A, ID_B] = Specific (Only Section A and B take this).
    applicableSections: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Section" }
    ],

    // 📝 The "Blueprint" (Subjects & Max Marks)
    subjects: [
      {
        name: { type: String, required: true }, // "Mathematics"
        
        // Scheduling
        date: { type: Date }, 
        startTime: { type: String }, // "09:00"
        durationMins: { type: Number }, // 180
        
        // Grading Rules
        maxMarks: { type: Number, required: true },  // e.g., 100
        passMarks: { type: Number, required: true }, // e.g., 33
        
        // Is this optional? (e.g., "Computer Science" vs "Physical Ed")
        isOptional: { type: Boolean, default: false } 
      }
    ],

    // 🚦 Status Flag
    // DRAFT: Only Admin sees it.
    // PUBLISHED: Teachers can see it and enter marks.
    // COMPLETED: Marks entry is locked.
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "COMPLETED"],
      default: "DRAFT",
      index: true
    }
  },
  { timestamps: true }
);
// ⚡ OPTIMIZATION: Prevent Duplicate Exams
// "You cannot have two 'Mid-Terms' for Class 10 in the same year"
examSchema.index({ academicYear: 1, classLevel: 1, name: 1 }, { unique: true });

export default mongoose.model("Exam", examSchema);