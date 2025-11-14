import mongoose from "mongoose";

const feeStructureSchema = new mongoose.Schema(
  {
    // 🏷️ Identity: "Class 10 General Fee (2025-2026)"
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },

    // 🔗 Context: Applies to whom?
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

    // 💰 The Breakdown (The Menu Items)
    components: [
      {
        name: { type: String, required: true }, // "Tuition Fee", "Exam Fee"
        
        amount: { type: Number, required: true, min: 0 }, // e.g., 5000
        
        // Critical for Calculation logic later
        frequency: {
          type: String,
          enum: ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"],
          required: true
        },

        // Optional: Due Day (e.g., "5" means 5th of every month)
        dueDay: { type: Number, default: 10 },
        
        // Is this optional? (e.g., "Bus Fee" might be optional here, but usually handled separately)
        isMandatory: { type: Boolean, default: true }
      }
    ],

    // 📊 Auto-calculated Total (For quick display)
    totalYearlyAmount: { 
      type: Number, 
      required: true 
    },

    isActive: { 
      type: Boolean, 
      default: true 
    }
  },
  { timestamps: true }
);

// ⚡ OPTIMIZATION: Quick Lookup
// "Find me the fee structure for Class 10 in 2025"
feeStructureSchema.index({ academicYear: 1, classLevel: 1 });

export default mongoose.model("FeeStructure", feeStructureSchema);