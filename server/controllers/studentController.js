import mongoose from "mongoose";
import Student from "../models/Student.js";
import Parent from "../models/Parent.js";
import StudentFee from "../models/StudentFee.js";
import FeeStructure from "../models/FeeStructure.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";

/* ============================================
   1. ADMIT STUDENT (The Big Transaction)
   ============================================ */
export const admitStudent = catchAsync(async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      const {
        // Student Details
        firstName,
        lastName,
        dob,
        gender,
        aadharNo,
        transferceritificateUrl,
        aadharacardUrl,
       
  
        // Academic Details
        academicYearId,
        classId,
        sectionId,
  
        // Parent Details
        fatherName,
        motherName,
        parentPhone,
        parentEmail,
        fatherOccupation,
        motherOccupation,
        banckAccountPhoto,
        address,
      } = req.body;
  
      // -----------------------------------------------
      // Helper: Convert DOB → Password (DDMMYYYY)
      // -----------------------------------------------
      const formatDobAsPassword = (dob) => {
        const d = new Date(dob);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}${month}${year}`;
      };
  
      // -----------------------------------------------
      // STEP 1: Find or Create Parent
      // -----------------------------------------------
      let parent = await Parent.findOne({ primaryPhone: parentPhone }).session(session);
  
      if (!parent) {
        parent = await Parent.create(
          [
            {
              primaryPhone: parentPhone,
              fatherName,
              motherName,
              email: parentEmail,
              fatherOccupation,
              motherOccupation,
              address,
              banckAccountPhoto,
              password: formatDobAsPassword(dob), // Password = DOB
            },
          ],
          { session }
        );
  
        parent = parent[0];
      }
  
      // -----------------------------------------------
      // STEP 2: Create Student
      // -----------------------------------------------
      const newStudent = await Student.create(
        [
          {
            firstName,
            lastName,
            dob,
            gender,
            aadharNo,
            transferceritificateUrl,
            aadharacardUrl,
  
            parent: parent._id,
            academicYear: academicYearId,
            classLevel: classId,
            section: sectionId,
            status: "ACTIVE",
          },
        ],
        { session }
      );
  
      const studentId = newStudent[0]._id;
  
      // -----------------------------------------------
      // STEP 3: Link Student → Parent
      // -----------------------------------------------
      await Parent.findByIdAndUpdate(
        parent._id,
        {
          $push: {
            children: {
              student: studentId,
              relation: "FATHER",
            },
          },
        },
        { session }
      );
  
      // -----------------------------------------------
      // STEP 4: Fee Ledger (If class has fees)
      // -----------------------------------------------
      const feeStructure = await FeeStructure.findOne({
        classLevel: classId,
        academicYear: academicYearId,
      }).session(session);
  
      if (feeStructure) {
        await StudentFee.create(
          [
            {
              student: studentId,
              academicYear: academicYearId,
              classLevel: classId,
              feeStructure: feeStructure._id,
              totalAmount: feeStructure.totalYearlyAmount,
              finalAmount: feeStructure.totalYearlyAmount,
              dueAmount: feeStructure.totalYearlyAmount,
              status: "PENDING",
              installments: feeStructure.components.map((comp) => ({
                name: comp.name,
                amount: comp.amount,
                dueDate: new Date(),
                status: "PENDING",
              })),
            },
          ],
          { session }
        );
      }
  
      // -----------------------------------------------
      // COMMIT
      // -----------------------------------------------
      await session.commitTransaction();
  
      res.status(201).json({
        status: "success",
        message: "Student Admitted Successfully",
        data: { student: newStudent[0] },
      });
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      session.endSession();
    }
  });
  

/* ============================================
   2. GET ALL STUDENTS (With Filters)
   ============================================ */
export const getAllStudents = catchAsync(async (req, res, next) => {
  // Filter by Class, Section, Status, Name
  const filter = {};
  if (req.query.classId) filter.classLevel = req.query.classId;
  if (req.query.sectionId) filter.section = req.query.sectionId;
  if (req.query.status) filter.status = req.query.status;
  
  // Search Logic (Optional)
  if (req.query.search) {
    filter.$text = { $search: req.query.search };
  }

  const students = await Student.find(filter)
    .populate("classLevel", "name")
    .populate("section", "name")
    .populate("parent", "fatherName primaryPhone");

  res.status(200).json({
    status: "success",
    results: students.length,
    data: { students }
  });
});




export const searchStudents = catchAsync(async (req, res, next) => {
  const { query } = req.query; 
  if (!query) {
    return next(new AppError("Please provide a search term", 400));
  }

  // 🔍 Perform Text Search using the Text Index we created in the Model
  // It searches: firstName, lastName, and admissionNo
  const students = await Student.find(
    { $text: { $search: query } },
    { score: { $meta: "textScore" } } // Project the match score
  )
  .sort({ score: { $meta: "textScore" } }) // Sort by best match
  .limit(10) // Limit to top 10 results for speed
  .populate("classLevel", "name")
  .populate("section", "name")
  .select("firstName lastName admissionNo photoUrl classLevel section status");

  res.status(200).json({
    status: "success",
    results: students.length,
    data: { students }
  });
});


export const getStudentStats = catchAsync(async (req, res, next) => {
  const stats = await Student.aggregate([
    // 1. Filter only ACTIVE students
    { $match: { status: "ACTIVE" } },

    // 2. Facet: Run multiple aggregations in parallel
    {
      $facet: {
        // A. Total Active Students
        totalCount: [{ $count: "count" }],

        // B. Gender Distribution (for Pie Chart)
        genderDistribution: [
          { $group: { _id: "$gender", count: { $sum: 1 } } }
        ],

        // C. Class-wise Strength (for Bar Chart)
        classDistribution: [
          { $group: { _id: "$classLevel", count: { $sum: 1 } } },
          // Lookup Class Name from ClassLevel collection
          {
            $lookup: {
              from: "classlevels", // Mongoose lowercases & pluralizes model names
              localField: "_id",
              foreignField: "_id",
              as: "classInfo"
            }
          },
          // Clean up the output
          {
            $project: {
              className: { $arrayElemAt: ["$classInfo.name", 0] },
              order: { $arrayElemAt: ["$classInfo.order", 0] },
              count: 1
            }
          },
          { $sort: { order: 1 } } // Sort by Class 1, 2, 3...
        ]
      }
    }
  ]);

  res.status(200).json({
    status: "success",
    data: {
      totalStudents: stats[0].totalCount[0]?.count || 0,
      genderStats: stats[0].genderDistribution,
      classStats: stats[0].classDistribution
    }
  });
});
