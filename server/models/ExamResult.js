import mongoose from "mongoose";

const examResultSchema = new mongoose.Schema(
  {
    // 🔗 Context
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
    
    // ⚡ Snapshots
    academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    classLevel: { type: mongoose.Schema.Types.ObjectId, ref: "ClassLevel", required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },

    // 📝 Detailed Marks Ledger
    marks: [
      {
        subjectName: { type: String, required: true }, 
        subjectId: { type: mongoose.Schema.Types.ObjectId }, 
        
        obtainedMarks: { type: Number, required: true, default: 0 },
        graceMarks: { type: Number, default: 0 }, 
        totalMarks: { type: Number, required: true }, 
        
        grade: { type: String }, 
        
        status: { 
          type: String, 
          enum: ["PASS", "FAIL", "ABSENT", "EXEMPT"], 
          default: "PASS" 
        },
        
        // 🕵️ Accountability: Dynamic Reference (FIXED)
        // Allows both Teachers AND Admins to grade without breaking links
        gradedBy: { 
          type: mongoose.Schema.Types.ObjectId, 
          refPath: 'marks.graderModel' 
        },
        graderModel: {
          type: String,
          enum: ['Admin', 'Teacher'],
          default: 'Teacher'
        },
        
        remarks: String 
      }
    ],

    // 📊 Aggregates
    totalObtained: { type: Number, default: 0 },
    totalMaxMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    
    rank: { type: Number }, 
    resultStatus: {
      type: String,
      enum: ["PASS", "FAIL", "WITHHELD", "SUPPLEMENTARY"],
      default: "PASS"
    },

    // 🔒 Locking
    isLocked: { type: Boolean, default: false },

    // 🕵️ Document Audit: Dynamic Reference (FIXED)
    lastModifiedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      refPath: 'modifierModel' 
    },
    modifierModel: {
      type: String,
      enum: ['Admin', 'Teacher'],
      default: 'Admin'
    },
    modificationReason: { type: String }
  },
  { timestamps: true }
);

// ⚡ Indexes
examResultSchema.index({ exam: 1, student: 1 }, { unique: true });
examResultSchema.index({ exam: 1, percentage: -1 });
examResultSchema.index({ exam: 1, resultStatus: "FAIL" });

export default mongoose.model("ExamResult", examResultSchema);