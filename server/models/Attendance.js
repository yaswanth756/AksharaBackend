import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    // 📅 Context
    academicYear: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "AcademicYear", 
      required: true 
    },
    
    month: { 
      type: String, 
      required: true 
    }, // Format: "2025-11"

    // 👤 Who is this attendance for?
    userType: {
      type: String,
      enum: ["STUDENT", "TEACHER"],
      required: true
    },
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'userModel'
    },

    // 🏫 Context (ONLY FOR STUDENTS)
    classLevel: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "ClassLevel",
      required: function() {
        return this.userType === "STUDENT"; // ✅ Only required for students
      }
    },
    
    section: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Section",
      required: function() {
        return this.userType === "STUDENT"; // ✅ Only required for students
      }
    },
    
    student: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Student",
      required: function() {
        return this.userType === "STUDENT"; // ✅ Only for students
      }
    },

    // 📊 The Ledger: Stores 1 to 31 days
    records: [
      {
        day: { type: Number, required: true },
        date: { type: Date },
        
        status: { 
          type: String, 
          enum: ["PRESENT", "ABSENT", "LATE", "LEAVE", "HOLIDAY", "HALF_DAY"], 
          default: "PRESENT" 
        },

        markedBy: { 
          type: mongoose.Schema.Types.ObjectId, 
          required: true,
          refPath: 'records.markedByModel'
        },
        
        markedByModel: { 
          type: String, 
          required: true,
          enum: ['Admin', 'Teacher'] 
        },

        remarks: String
      }
    ],

    // 📈 Stats
    stats: {
      present: { type: Number, default: 0 },
      absent: { type: Number, default: 0 },
      late: { type: Number, default: 0 },
      leaves: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

// ⚡ Virtual for the User (Student/Teacher)
attendanceSchema.virtual('userModel').get(function() {
  return this.userType === 'STUDENT' ? 'Student' : 'Teacher';
});

// ⚡ Indexes
attendanceSchema.index({ userId: 1, month: 1 }, { unique: true });
attendanceSchema.index({ section: 1, month: 1 }); // Still useful for student queries
attendanceSchema.index({ userType: 1, month: 1 }); // ✅ Added for teacher queries

export default mongoose.model("Attendance", attendanceSchema);
