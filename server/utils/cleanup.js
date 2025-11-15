import mongoose from 'mongoose';
import Section from '../models/Section.js';
import Teacher from '../models/Teacher.js';

mongoose.connect("mongodb+srv://mohankommi105_db_user:hbvNtwk8THOZajkP@akashara.ahqzsk8.mongodb.net/?retryWrites=true&w=majority&appName=Akashara");

async function cleanupOrphanedReferences() {
  console.log('🔍 Starting cleanup...');
  
  const sections = await Section.find({ classTeacher: { $exists: true } });
  let fixed = 0;
  
  for (const section of sections) {
    const teacher = await Teacher.findById(section.classTeacher);
    
    if (!teacher) {
      await Section.findByIdAndUpdate(section._id, { $unset: { classTeacher: 1 } });
      console.log(`❌ Removed non-existent teacher from ${section.name}`);
      fixed++;
    } else if (teacher.classTeacherOf?.toString() !== section._id.toString()) {
      await Section.findByIdAndUpdate(section._id, { $unset: { classTeacher: 1 } });
      console.log(`🔧 Fixed orphaned reference in ${section.name}`);
      fixed++;
    }
  }
  
  console.log(`✅ Cleanup complete. Fixed ${fixed} discrepancies.`);
  process.exit(0);
}

cleanupOrphanedReferences();
