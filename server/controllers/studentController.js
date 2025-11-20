import mongoose from "mongoose";
import Student from "../models/Student.js";
import Parent from "../models/Parent.js";

import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";
import { shortCache } from "../utils/cache.js";

// 💡 IMPORT THE FINANCE HELPER
import { generateStudentFeeLedger } from "./feeStructureController.js";

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
      sectionId, // Can be "" or null

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
    // Handle Optional Section
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
            password: formatDobAsPassword(dob), // Auto-generate password
          },
        ],
        { session }
      );

      parent = parent[0]; // .create returns an array when using session
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
          section: finalSectionId, // Uses null if not provided
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
            relation: "FATHER", // Default, can be an input field
          },
        },
      },
      { session }
    );

    // -----------------------------------------------
    // STEP 4: Fee Ledger (Auto-Generation)
    // -----------------------------------------------
    // Call the helper from feeStructureController
    await generateStudentFeeLedger(
      newStudent[0], // Pass the new student object
      academicYearId, // Pass the Year ID
      classId, // Pass the Class ID
      session // Pass the transaction session
    );

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
   2. GET ALL STUDENTS (With Pagination)
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
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  const skip = (page - 1) * limit;

  // Get total count for pagination headers
  const total = await Student.countDocuments(filter);

  // Fetch students
  const students = await Student.find(filter)
    .select("_id admissionNo firstName lastName rollNo status classLevel section")
    .populate("classLevel", "name")
    .populate("section", "name")
    .skip(skip)
    .limit(limit);

  // Format clean response for the frontend
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

/* ============================================
   3. SEARCH STUDENTS
   ============================================ */
export const searchStudents = catchAsync(async (req, res, next) => {
  const { query } = req.query;
  if (!query) {
    return next(new AppError("Please provide a search term", 400));
  }

  const students = await Student.find(
    { $text: { $search: query } },
    { score: { $meta: "textScore" } }
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(10)
    .populate("classLevel", "name")
    .populate("section", "name")
    .select("firstName lastName admissionNo photoUrl classLevel section status");

  console.log("Search Students Result:", students);
  res.status(200).json({
    status: "success",
    results: students.length,
    data: { students }
  });
});

/* ============================================
   4. GET DASHBOARD STATS
   ============================================ */
export const getStudentStats = catchAsync(async (req, res, next) => {
  // Check cache
  const cacheKey = "student_dashboard_stats";
  if (shortCache.has(cacheKey)) {
    return res.status(200).json({
      status: "success",
      source: "cache",
      data: shortCache.get(cacheKey)
    });
  }

  const stats = await Student.aggregate([
    { $match: { status: "ACTIVE" } },
    {
      $facet: {
        totalCount: [{ $count: "count" }],
        genderDistribution: [
          { $group: { _id: "$gender", count: { $sum: 1 } } }
        ],
        classDistribution: [
          { $group: { _id: "$classLevel", count: { $sum: 1 } } },
          {
            $lookup: {
              from: "classlevels",
              localField: "_id",
              foreignField: "_id",
              as: "classInfo"
            }
          },
          {
            $project: {
              className: { $arrayElemAt: ["$classInfo.name", 0] },
              order: { $arrayElemAt: ["$classInfo.order", 0] },
              count: 1
            }
          },
          { $sort: { order: 1 } }
        ]
      }
    }
  ]);

  const responseData = {
    totalStudents: stats[0].totalCount[0]?.count || 0,
    genderStats: stats[0].genderDistribution,
    classStats: stats[0].classDistribution
  };

  shortCache.set(cacheKey, responseData);

  res.status(200).json({
    status: "success",
    data: responseData
  });
});

/* ============================================
   5. UPDATE STUDENT (Correct/Add Details)
   ============================================ */
export const updateStudent = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (req.body.admissionNo || req.body.balance || req.body.academicYear) {
    // Block sensitive fields from being updated here
    return next(new AppError("Cannot update sensitive fields from this route", 400));
  }

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
   6. GET SINGLE STUDENT (For Profile/Edit Page)
   ============================================ */
export const getStudent = catchAsync(async (req, res, next) => {
  const student = await Student.findById(req.params.id)
    .populate("parent")
    .populate("classLevel")
    .populate("section")
    .populate("academicYear");

  if (!student) {
    return next(new AppError("No student found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: { student }
  });
});