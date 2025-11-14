import mongoose from "mongoose";
import dotenv from "dotenv";
import AcademicYear from "../models/AcademicYear.js";
import ClassLevel from "../models/ClassLevel.js";
import Section from "../models/Section.js";

dotenv.config();

// 🛠️ CONSTANTS (What you wanted)
const CONSTANT_YEARS = [
  { name: "2025-2026", current: true, start: "2025-04-01", end: "2026-03-31" },
  { name: "2026-2027", current: false, start: "2026-04-01", end: "2027-03-31" }
];

const CONSTANT_CLASSES = [
  { name: "Class 3", order: 3 },
  { name: "Class 4", order: 4 },
  { name: "Class 5", order: 5 },
  { name: "Class 6", order: 6 },
  { name: "Class 7", order: 7 },
  { name: "Class 8", order: 8 },
  { name: "Class 9", order: 9 },
  { name: "Class 10", order: 10 }
];

const SECTIONS = ["A", "B", "C"]; // Default sections for every class

export const seedDatabase = async () => {
  try {
    console.log("🌱 Seeding Database...");

    // 1. Seed Academic Years
    for (const y of CONSTANT_YEARS) {
      const exists = await AcademicYear.findOne({ name: y.name });
      if (!exists) {
        await AcademicYear.create({
          name: y.name,
          startDate: new Date(y.start),
          endDate: new Date(y.end),
          isCurrent: y.current
        });
        console.log(`✅ Created Year: ${y.name}`);
      }
    }

    // 2. Seed Classes & Sections
    for (const c of CONSTANT_CLASSES) {
      let classDoc = await ClassLevel.findOne({ name: c.name });
      
      if (!classDoc) {
        classDoc = await ClassLevel.create({ name: c.name, order: c.order });
        console.log(`✅ Created Class: ${c.name}`);
      }

      // Auto-create Sections A, B, C for this class
      for (const secName of SECTIONS) {
        const secExists = await Section.findOne({ 
          name: secName, 
          classLevel: classDoc._id 
        });
        
        if (!secExists) {
          await Section.create({
            name: secName,
            classLevel: classDoc._id,
            capacity: 40
          });
          console.log(`   ➡️ Added Section ${secName} to ${c.name}`);
        }
      }
    }
    
    console.log("🌱 Seeding Complete!");
  } catch (error) {
    console.error("❌ Seeding Error:", error);
  }
};