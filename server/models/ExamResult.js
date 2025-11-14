import mongoose from "mongoose";

const examResultSchema = new mongoose.Schema(
  {
    // 🔗 Context (Indexed for Speed)
    student: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Student", 
      required: true 
    },
    exam: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Exam", 
      required: true 
    },
    
    // ⚡ Snapshots (Denormalized for fast reporting without joining)
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    classLevel: { type: mongoose.Schema.Types.ObjectId, ref: "ClassLevel", required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },

    // 📝 Detailed Marks Ledger
    marks: [
      {
        subjectName: { type: String, required: true }, // "Mathematics"
        subjectId: { type: mongoose.Schema.Types.ObjectId }, // Optional: Link to Subject model if exists
        
        // 🔢 The Numbers
        obtainedMarks: { type: Number, required: true, default: 0 }, // Raw Score
        graceMarks: { type: Number, default: 0 }, // Extra marks added by Admin
        totalMarks: { type: Number, required: true }, // Max Marks (Snapshot)
        
        grade: { type: String }, // "A1"
        
        // 🚦 Status
        status: { 
          type: String, 
          enum: ["PASS", "FAIL", "ABSENT", "EXEMPT"], 
          default: "PASS" 
        },
        
        // 🕵️ Accountability: Who graded this specific subject?
        gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
        
        remarks: String // e.g. "Weak in Algebra"
      }
    ],

    // 📊 Aggregates (Auto-calculated)
    totalObtained: { type: Number, default: 0 }, // (Obtained + Grace)
    totalMaxMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    
    // 🏆 Rank & Result
    rank: { type: Number }, 
    resultStatus: {
      type: String,
      enum: ["PASS", "FAIL", "WITHHELD", "SUPPLEMENTARY"],
      default: "PASS"
    },

    // 🔒 Locking Mechanism
    // If true, no more changes allowed (even by teachers). Only Super Admin can unlock.
    isLocked: { type: Boolean, default: false },

    // 🕵️ Audit Trail (Who touched this document last?)
    lastModifiedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Admin" // Or Teacher
    },
    modificationReason: { type: String } // e.g. "Re-evaluation request"
  },
  { timestamps: true }
);

// ⚡ OPTIMIZATION 1: Unique Constraint
// "Ravi can only have ONE result sheet for the Mid-Term Exam"
examResultSchema.index({ exam: 1, student: 1 }, { unique: true });

// ⚡ OPTIMIZATION 2: Topper List Query
// "Get Top 3 Students"
examResultSchema.index({ exam: 1, percentage: -1 });

// ⚡ OPTIMIZATION 3: Failures List
// "Get all failed students for remedial class"
examResultSchema.index({ exam: 1, resultStatus: "FAIL" });

export default mongoose.model("ExamResult", examResultSchema);