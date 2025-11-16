import mongoose from "mongoose";
import AcademicYear from "../models/AcademicYear.js";
import ClassLevel from "../models/ClassLevel.js";
import Section from "../models/Section.js";
import Admin from "../models/Admin.js";
import Teacher from "../models/Teacher.js";
import Parent from "../models/Parent.js";
import Student from "../models/Student.js";
import FeeStructure from "../models/FeeStructure.js";
import StudentFee from "../models/StudentFee.js";
import Exam from "../models/Exam.js";
import ExamResult from "../models/ExamResult.js";
import Attendance from "../models/Attendance.js";

const clearDatabase = async () => {
  console.log("🗑️  Clearing Database...");
  await Promise.all([
    AcademicYear.deleteMany({}),
    ClassLevel.deleteMany({}),
    Section.deleteMany({}),
    Admin.deleteMany({}),
    Teacher.deleteMany({}),
    Parent.deleteMany({}),
    Student.deleteMany({}),
    FeeStructure.deleteMany({}),
    StudentFee.deleteMany({}),
    Exam.deleteMany({}),
    ExamResult.deleteMany({}),
    Attendance.deleteMany({})
  ]);
  console.log("✅ Database Cleared\n");
};

export const seedFullDatabase = async () => {
  try {
    await clearDatabase();
    console.log("🌱 Starting Database Seeding...\n");

    // ==========================================
    // 1. ACADEMIC YEAR
    // ==========================================
    console.log("📅 Creating Academic Year...");
    const year2025 = await AcademicYear.create({
      name: "2025-2026",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2026-03-31"),
      isCurrent: true
    });
    console.log(`✓ Created: ${year2025.name}\n`);

    // ==========================================
    // 2. CLASSES & SECTIONS (1-10, A & B)
    // ==========================================
    console.log("🏫 Creating Classes & Sections...");
    const classes = [];
    const sections = [];
    
    for (let i = 1; i <= 10; i++) {
      const cls = await ClassLevel.create({ 
        name: `Class ${i}`, 
        order: i 
      });
      classes.push(cls);

      // Create sections A and B for each class
      for (const secName of ["A", "B"]) {
        const sec = await Section.create({
          name: secName,
          classLevel: cls._id,
          capacity: 40
        });
        sections.push(sec);
      }
    }
    console.log(`✓ Created: ${classes.length} Classes, ${sections.length} Sections\n`);

    // ==========================================
    // 3. ADMIN USERS
    // ==========================================
    console.log("👨‍💼 Creating Admin Users...");
    const admins = await Admin.insertMany([
      {
        name: "Principal Sharma",
        phone: "9999999999",
        email: "principal@school.com",
        role: "ADMIN",
        status: "ACTIVE"
      },
      {
        name: "Office Manager",
        phone: "8888888888",
        email: "office@school.com",
        role: "OPERATOR",
        status: "ACTIVE"
      }
    ]);
    console.log(`✓ Created: ${admins.length} Admins\n`);

    // ==========================================
    // 4. TEACHERS
    // ==========================================
    console.log("👨‍🏫 Creating Teachers...");
    const teacherSubjects = ["Mathematics", "Science", "English", "History", "Hindi"];
    const teacherData = teacherSubjects.map((subject, i) => ({
      teacherId: `TCH${String(100 + i).padStart(3, '0')}`,
      name: `${subject} Teacher`,
      phone: `700000000${i}`,
      email: `${subject.toLowerCase()}@school.com`,
      gender: i % 2 === 0 ? "FEMALE" : "MALE",
      subjects: [subject],
      password: "teacher123",
      status: "ACTIVE",
      dob: new Date("1990-05-20"),
      salary: 45000 + (i * 2000),
      qualification: "M.Sc. B.Ed",
      address: "Teacher Colony, Delhi"
    }));
    
    const teachers = await Teacher.insertMany(teacherData);
    console.log(`✓ Created: ${teachers.length} Teachers\n`);

    // ==========================================
    // 5. FEE STRUCTURE FOR CLASS 10
    // ==========================================
    console.log("💰 Creating Fee Structure...");
    const class10 = classes.find(c => c.name === "Class 10");
    const feeStructure = await FeeStructure.create({
      name: "Class 10 Annual Fee 2025-26",
      academicYear: year2025._id,
      classLevel: class10._id,
      totalYearlyAmount: 50000,
      components: [
        { 
          name: "Tuition Fee", 
          amount: 40000, 
          frequency: "YEARLY", 
          isMandatory: true 
        },
        { 
          name: "Lab Fee", 
          amount: 5000, 
          frequency: "YEARLY", 
          isMandatory: true 
        },
        { 
          name: "Exam Fee", 
          amount: 5000, 
          frequency: "YEARLY", 
          isMandatory: true 
        }
      ]
    });
    console.log(`✓ Created Fee Structure: ₹${feeStructure.totalYearlyAmount}\n`);

    // ==========================================
    // 6. STUDENTS & PARENTS (20 Students for Class 10-A)
    // ==========================================
    console.log("👨‍🎓 Creating Students & Parents...");
    const section10A = sections.find(
      s => s.classLevel.equals(class10._id) && s.name === "A"
    );
    
    const studentDocs = [];
    const studentFees = [];

    for (let i = 1; i <= 20; i++) {
      // Create Parent
      const parent = await Parent.create({
        primaryPhone: `90000000${String(i).padStart(2, '0')}`,
        fatherName: `Mr. Sharma ${i}`,
        motherName: `Mrs. Sharma ${i}`,
        status: "ACTIVE",
        password: "parent123"
      });

      // Create Student
      const student = await Student.create({
        admissionNo: `ADM2025${String(100 + i).padStart(3, '0')}`,
        firstName: "Student",
        lastName: `${i}`,
        rollNo: i,
        parent: parent._id,
        academicYear: year2025._id,
        classLevel: class10._id,
        section: section10A._id,
        aadharNo: 100000000000 + i,
        gender: i % 2 === 0 ? "FEMALE" : "MALE",
        dob: new Date("2010-01-15"),
        status: "ACTIVE",
        admissionDate: new Date("2025-04-01")
      });

      studentDocs.push(student);

      // Link child to parent
      parent.children.push({ 
        student: student._id, 
        relation: "FATHER" 
      });
      await parent.save();

      // Create unpaid fee ledger (NO PAYMENT)
      studentFees.push({
        student: student._id,
        academicYear: year2025._id,
        classLevel: class10._id,
        feeStructure: feeStructure._id,
        totalAmount: 50000,
        finalAmount: 50000,
        dueAmount: 50000,
        status: "PENDING",
        installments: []
      });
    }

    await StudentFee.insertMany(studentFees);
    console.log(`✓ Created: ${studentDocs.length} Students with Parents\n`);

    // ==========================================
    // 7. EXAM & RESULTS
    // ==========================================
    console.log("📝 Creating Exam & Results...");
    const exam = await Exam.create({
      name: "Mid-Term Exam 2025",
      academicYear: year2025._id,
      classLevel: class10._id,
      status: "PUBLISHED",
      subjects: [
        { name: "Mathematics", maxMarks: 100, passMarks: 33 },
        { name: "Science", maxMarks: 100, passMarks: 33 },
        { name: "English", maxMarks: 100, passMarks: 33 }
      ]
    });

    const examResults = studentDocs.map(student => {
      const mathMarks = Math.floor(Math.random() * 50) + 50; // 50-100
      const sciMarks = Math.floor(Math.random() * 50) + 50;
      const engMarks = Math.floor(Math.random() * 50) + 50;
      const total = mathMarks + sciMarks + engMarks;

      return {
        student: student._id,
        exam: exam._id,
        academicYear: year2025._id,
        classLevel: class10._id,
        section: section10A._id,
        marks: [
          {
            subjectName: "Mathematics",
            obtainedMarks: mathMarks,
            totalMarks: 100,
            grade: mathMarks >= 80 ? "A" : mathMarks >= 60 ? "B" : "C",
            status: "PASS",
            gradedBy: teachers[0]._id,
            graderModel: "Teacher"
          },
          {
            subjectName: "Science",
            obtainedMarks: sciMarks,
            totalMarks: 100,
            grade: sciMarks >= 80 ? "A" : sciMarks >= 60 ? "B" : "C",
            status: "PASS",
            gradedBy: teachers[1]._id,
            graderModel: "Teacher"
          },
          {
            subjectName: "English",
            obtainedMarks: engMarks,
            totalMarks: 100,
            grade: engMarks >= 80 ? "A" : engMarks >= 60 ? "B" : "C",
            status: "PASS",
            gradedBy: teachers[2]._id,
            graderModel: "Teacher"
          }
        ],
        totalObtained: total,
        totalMaxMarks: 300,
        percentage: (total / 300) * 100,
        resultStatus: "PASS",
        lastModifiedBy: teachers[0]._id,
        modifierModel: "Teacher"
      };
    });

    await ExamResult.insertMany(examResults);
    console.log(`✓ Created Exam with ${examResults.length} Results\n`);
 // ==========================================
// 8. ATTENDANCE RECORDS
// ==========================================
console.log("📊 Creating Attendance Records...");
const today = new Date();
const yesterday = new Date(Date.now() - 86400000);
const month = today.toISOString().slice(0, 7);

const attendanceRecords = studentDocs.map(student => ({
    academicYear: year2025._id,
    month: month,
    userType: "STUDENT",
    userId: student._id,
    student: student._id, // Add this line to include the student ID
    classLevel: class10._id,
    section: section10A._id,
    records: [
      {
        day: today.getDate(),
        date: today,
        status: "PRESENT",
        markedBy: teachers[0]._id,
        markedByModel: "Teacher"
      },
      {
        day: yesterday.getDate(),
        date: yesterday,
        status: Math.random() > 0.15 ? "PRESENT" : "ABSENT",
        markedBy: teachers[0]._id,
        markedByModel: "Teacher"
      }
    ],
    stats: { 
      present: Math.random() > 0.15 ? 2 : 1, 
      absent: Math.random() > 0.15 ? 0 : 1 
    }
  }));

await Attendance.insertMany(attendanceRecords);
console.log(`✓ Created: ${attendanceRecords.length} Attendance Records\n`);

    // ==========================================
    // ✅ SUMMARY
    // ==========================================
    console.log("╔═══════════════════════════════════════╗");
    console.log("║   🎉 SEEDING COMPLETED SUCCESSFULLY   ║");
    console.log("╚═══════════════════════════════════════╝\n");
    console.log("📊 Summary:");
    console.log(`   • Academic Year: 1`);
    console.log(`   • Classes: ${classes.length}`);
    console.log(`   • Sections: ${sections.length}`);
    console.log(`   • Admins: ${admins.length}`);
    console.log(`   • Teachers: ${teachers.length}`);
    console.log(`   • Students: ${studentDocs.length}`);
    console.log(`   • Fee Structures: 1`);
    console.log(`   • Exams: 1`);
    console.log(`   • Exam Results: ${examResults.length}`);
    console.log(`   • Attendance Records: ${attendanceRecords.length}\n`);

  } catch (error) {
    console.error("\n❌ SEEDING FAILED:");
    console.error(error);
    process.exit(1);
  }
};
