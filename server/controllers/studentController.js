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
        sectionId, // OPTIONAL now
  
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
      // Make sectionId OPTIONAL → Convert "" to null
      // -----------------------------------------------
      const finalSectionId = sectionId && sectionId !== "" ? sectionId : null;
  
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
              password: formatDobAsPassword(dob),
            },
          ],
          { session }
        );
  
        parent = parent[0];
      }
  
      // -----------------------------------------------
      // STEP 2: Create Student (SECTION OPTIONAL)
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
  
            // section: null if not provided
            section: finalSectionId,
  
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
/* ============================================
   GET ALL STUDENTS (With Pagination)
   ============================================ */
   export const getAllStudents = catchAsync(async (req, res, next) => {
    const filter = {};
  
    // Filters
    if (req.query.classId) filter.classLevel = req.query.classId;
    if (req.query.sectionId) filter.section = req.query.sectionId;
    if (req.query.status) filter.status = req.query.status;
  
    // Search
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;

    // Get total count
    const total = await Student.countDocuments(filter);
  
    // Fetch students
    const students = await Student.find(filter)
      .select("_id admissionNo firstName lastName rollNo status classLevel section")
      .populate("classLevel", "name")
      .populate("section", "name")
      .skip(skip)
      .limit(limit);
  
    // Format clean response
    const result = students.map((s) => ({
      _id: s._id,
      admissionNo: s.admissionNo,
      name: `${s.firstName} ${s.lastName || ""}`,
      class: s.classLevel?.name,
      section: s.section?.name,
      rollNo: s.rollNo || null,
      status: s.status,
    }));
  
    res.status(200).json({
      status: "success",
      results: result.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
      data: { students: result },
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


/* ============================================
   UPDATE STUDENT (Partial Update)
   ============================================ */
// ... imports (Student, etc)

/* ============================================
   5. UPDATE STUDENT (Correct/Add Details)
   ============================================ */
   export const updateStudent = catchAsync(async (req, res, next) => {
    const { id } = req.params;
  
    // 1. Block sensitive fields (Optional safety)
    // You generally don't want manual updates to these via a simple Edit form:
    if (req.body.admissionNo || req.body.balance || req.body.academicYear) {
       // You can choose to throw error or just delete them from req.body
       // delete req.body.admissionNo;
    }
  
    // 2. Find and Update
    // { new: true } returns the updated document
    // { runValidators: true } ensures 'enum' rules (like gender) are followed
    const student = await Student.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });
  
    if (!student) {
      return next(new AppError("No student found with that ID", 404));
    }
  
    res.status(200).json({
      status: "success",
      message: "Student details updated successfully",
      data: {
        student
      }
    });
  });
  
  /* ============================================
     6. GET SINGLE STUDENT (For the Edit Page)
     ============================================ */
  // You need this so the Frontend can pre-fill the "Edit Form" with existing data
  export const getStudent = catchAsync(async (req, res, next) => {
    const student = await Student.findById(req.params.id)
      .populate("parent")       // Get Father/Mother info
      .populate("classLevel")   // Get Class Name
      .populate("section")      // Get Section Name
      .populate("academicYear");
  
    if (!student) {
      return next(new AppError("No student found with that ID", 404));
    }
  
    res.status(200).json({
      status: "success",
      data: { student }
    });
  });
  