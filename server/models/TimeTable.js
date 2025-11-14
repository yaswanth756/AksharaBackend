import mongoose from "mongoose";

const timeTableSchema = new mongoose.Schema(
  {
    // 🔗 Context: When and Where?
    academicYear: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "AcademicYear",
      required: true 
    },
    
    section: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Section", 
      required: true 
    },

    // 📅 The Day
    dayOfWeek: {
      type: String,
      enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      required: true
    },

    // ⏰ The Schedule
    periods: [
      {
        periodNumber: { type: Number, required: true }, // 1, 2, 3...
        startTime: { type: String, required: true },    // "09:00"
        endTime: { type: String, required: true },      // "09:45"
        
        subject: { 
            type: String, 
            required: true 
        }, // Can also be an ObjectId if you have a Subject model
        
        teacher: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: "Teacher" 
        },
        
        roomNumber: String, // If different from section default (e.g., Chemistry Lab)
        isBreak: { type: Boolean, default: false }
      }
    ]
  },
  { timestamps: true }
);

// ⚡ OPTIMIZATION 1: One Schedule per Section per Day
// "Section 10-A can only have ONE timetable for Monday."
timeTableSchema.index({ section: 1, dayOfWeek: 1 }, { unique: true });

// ⚡ OPTIMIZATION 2: Teacher Conflict Check
// "Teacher Ravi cannot be in two places at once."
// (Note: Mongoose indexes on arrays work, but application-level validation is also recommended here)
timeTableSchema.index({ "periods.teacher": 1, dayOfWeek: 1, "periods.startTime": 1 });

export default mongoose.model("TimeTable", timeTableSchema);