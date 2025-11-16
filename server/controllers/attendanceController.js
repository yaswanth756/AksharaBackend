import Attendance from "../models/Attendance.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";

// 🛠️ Helper: Parse Date string to Month and Day
const parseDate = (dateString) => {
  const d = new Date(dateString);
  // Format: "2025-11" (YYYY-MM)
  const month = d.toISOString().slice(0, 7); 
  const day = d.getDate();
  return { month, day, dateObj: d };
};

/* ============================================
   1. MARK ATTENDANCE (Bulk & Correction)
   Handles Students & Teachers in one function
   ============================================ */
   export const markAttendance = catchAsync(async (req, res, next) => {
    const { 
      date,
      userType,
      classId,
      sectionId,
      academicYearId,
      records
    } = req.body;
  
    const { month, day, dateObj } = parseDate(date);
    const userIds = records.map(r => r.userId);
    
    const existingDocs = await Attendance.find({
      userId: { $in: userIds },
      month,
      academicYear: academicYearId
    });
  
    const bulkOps = [];
  
    for (const record of records) {
      let doc = existingDocs.find(d => d.userId.toString() === record.userId);
      
      if (!doc) {
        const docData = {
          academicYear: academicYearId,
          month,
          userType,
          userId: record.userId,
          records: [],
          stats: { present: 0, absent: 0, late: 0, leaves: 0 }
        };
  
        // ✅ Only add student-specific fields if userType is STUDENT
        if (userType === "STUDENT") {
          docData.student = record.userId;
          docData.classLevel = classId;
          docData.section = sectionId;
        }
  
        doc = new Attendance(docData);
      }
  
      const cleanRecords = doc.records.filter(r => r.day !== day);
      
      const newEntry = {
        day,
        date: dateObj,
        status: record.status || "PRESENT",
        markedBy: req.user._id,
        markedByModel: req.user.role === "TEACHER" ? "Teacher" : "Admin",
        remarks: record.remarks || ""
      };
  
      const updatedRecords = [...cleanRecords, newEntry];
  
      const newStats = { present: 0, absent: 0, late: 0, leaves: 0 };
      updatedRecords.forEach(r => {
        if (r.status === "PRESENT") newStats.present++;
        else if (r.status === "ABSENT") newStats.absent++;
        else if (r.status === "LATE") newStats.late++;
        else if (r.status === "LEAVE") newStats.leaves++;
      });
  
      // ✅ Build update object conditionally
      const updateObj = { 
        records: updatedRecords, 
        stats: newStats,
        academicYear: academicYearId,
        userType
      };
  
      // ✅ Only add student-specific fields for STUDENT userType
      if (userType === "STUDENT") {
        updateObj.student = record.userId;
        updateObj.classLevel = classId;
        updateObj.section = sectionId;
      }
  
      bulkOps.push({
        updateOne: {
          filter: { userId: record.userId, month: month },
          update: { $set: updateObj },
          upsert: true
        }
      });
    }
  
    if (bulkOps.length > 0) {
      await Attendance.bulkWrite(bulkOps);
    }
  
    res.status(200).json({
      status: "success",
      message: `Attendance marked for ${records.length} users.`
    });
  });
  

/* ============================================
   2. GET MONTHLY REPORT (The Grid View)
   Used for: "Show me November Attendance for Class 10-A"
   ============================================ */
export const getMonthlyReport = catchAsync(async (req, res, next) => {
  const { month, classId, sectionId, userType } = req.query;

  const filter = { month, userType };
  
  if (userType === "STUDENT") {
    if (!sectionId) return next(new AppError("Section ID required for students", 400));
    filter.section = sectionId;
  }

  const attendanceData = await Attendance.find(filter)
    .populate("userId", "name firstName lastName rollNo") 
    .sort("userId");

  res.status(200).json({
    status: "success",
    results: attendanceData.length,
    data: { attendanceData }
  });
});

/* ============================================
   3. GET DAILY STATUS (For Marking UI)
   Used for: Pre-filling the toggles when teacher opens the app
   ============================================ */
export const getDailyStatus = catchAsync(async (req, res, next) => {
  const { date, sectionId, userType } = req.query;
  const { month, day } = parseDate(date);

  const filter = { month, userType };
  if (sectionId) filter.section = sectionId;

  const docs = await Attendance.find(filter).select("userId records");

  // Transform to simple map: { "STUDENT_ID": "ABSENT" }
  const dailyMap = {};
  
  docs.forEach(doc => {
    const todayRecord = doc.records.find(r => r.day === day);
    if (todayRecord) {
      dailyMap[doc.userId] = todayRecord.status;
    }
  });

  res.status(200).json({
    status: "success",
    data: { dailyMap }
  });
});

/* ============================================
   4. GET SPECIFIC DAY REPORT (Admin Tool)
   Used for: "Who was absent on Nov 10th?"
   ============================================ */
/* ============================================
   4. GET SPECIFIC DAY REPORT (Admin Tool)
   ============================================ */
   export const getDailyReport = catchAsync(async (req, res, next) => {
    const { date, userType, sectionId, classId } = req.query;
  
    if (!date) return next(new AppError("Please provide a date", 400));
  
    const { month, day } = parseDate(date);
  
    const filter = {
      month: month,
      userType: userType || "STUDENT",
      records: { $elemMatch: { day: day } }
    };
  
    if (sectionId) {
      filter.section = sectionId;
    } else if (classId) {
      filter.classLevel = classId;
    }
  
    // Populate based on userType
    const attendanceDocs = await Attendance.find(filter)
      .populate("userId", "firstName lastName admissionNo name phone rollNo teacherId")
      .populate("section", "name")
      .populate("classLevel", "name")
      .populate("records.markedBy", "name");
  
    // Extract day's data
    const dailyData = attendanceDocs.map((doc) => {
      const dayRecord = doc.records.find((r) => r.day === day);
      
      // ✅ Dynamic name based on userType
      const name = doc.userType === "STUDENT"
        ? `${doc.userId.firstName || ''} ${doc.userId.lastName || ''}`
        : doc.userId.name || 'Unknown';
  
      // ✅ Dynamic identifier
      const identifier = doc.userType === "STUDENT"
        ? doc.userId.admissionNo || "N/A"
        : doc.userId.teacherId || doc.userId.phone || "N/A";
  
      const baseData = {
        id: doc.userId._id,
        name,
        identifier,
        status: dayRecord.status,
        remarks: dayRecord.remarks,
        markedBy: dayRecord.markedBy ? dayRecord.markedBy.name : "Unknown"
      };
  
      // ✅ Only add class/section for STUDENTS
      if (doc.userType === "STUDENT") {
        baseData.className = doc.classLevel?.name || "N/A";
        baseData.sectionName = doc.section?.name || "N/A";
        baseData.rollNo = doc.userId.rollNo || "N/A";
      }
  
      return baseData;
    });
  
    // Summary Stats
    const stats = {
      total: dailyData.length,
      present: dailyData.filter(d => d.status === "PRESENT").length,
      absent: dailyData.filter(d => d.status === "ABSENT").length,
      late: dailyData.filter(d => d.status === "LATE").length,
      leave: dailyData.filter(d => d.status === "LEAVE").length
    };
  
    // ✅ Group by section ONLY for students
    let groupedBySection = {};
    if (userType === "STUDENT") {
      groupedBySection = dailyData.reduce((acc, record) => {
        const key = `${record.className} - ${record.sectionName}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(record);
        return acc;
      }, {});
    } else {
      // ✅ For teachers, group by department or just keep flat
      groupedBySection = {
        "All Teachers": dailyData
      };
    }
  
    res.status(200).json({
      status: "success",
      date: date,
      stats,
      data: { 
        report: dailyData,
        groupedBySection
      }
    });
  });
  
  