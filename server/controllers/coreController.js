import AcademicYear from "../models/AcademicYear.js";
import ClassLevel from "../models/ClassLevel.js";
import Section from "../models/Section.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";

/* ============================================
   1. ACADEMIC YEAR (Admin Setup)
   ============================================ */
export const createAcademicYear = catchAsync(async (req, res, next) => {
  const { name, startDate, endDate, isCurrent } = req.body;
  
  // If setting this as current, unset others
  if (isCurrent) {
    await AcademicYear.updateMany({}, { isCurrent: false });
  }

  const year = await AcademicYear.create({ name, startDate, endDate, isCurrent });

  res.status(201).json({ status: "success", data: { year } });
})

export const getAllYears = catchAsync(async (req, res, next) => {
  // Frontend needs this for the Dropdown!
  const years = await AcademicYear.find().sort("-startDate");
  
  
  res.status(200).json({ status: "success", results: years.length, data: { years } });
});

/* ============================================
   2. CLASS LEVEL (Admin Setup)
   ============================================ */
export const createClass = catchAsync(async (req, res, next) => {
  const { name, order } = req.body;
  const newClass = await ClassLevel.create({ name, order });
  res.status(201).json({ status: "success", data: { newClass } });
});

export const getAllClasses = catchAsync(async (req, res, next) => {
  // Frontend needs this for the Dropdown!
  const classes = await ClassLevel.find().sort("order"); // Sorted Class 1, 2, 3...
  res.status(200).json({ status: "success", results: classes.length, data: { classes } });
});

/* ============================================
   3. SECTION (Admin Setup)
   ============================================ */
export const createSection = catchAsync(async (req, res, next) => {
  const { name, classLevelId, capacity } = req.body;
  
  const section = await Section.create({ 
    name, 
    classLevel: classLevelId, 
    capacity 
  });

  res.status(201).json({ status: "success", data: { section } });
});

export const getSectionsForClass = catchAsync(async (req, res, next) => {
  // Frontend calls: /api/v1/core/sections?classId=...
  // Used when user selects "Class 10", then next dropdown shows "A, B, C"
  const { classId } = req.query;
  
  const sections = await Section.find({ classLevel: classId }).sort("name");
  res.status(200).json({ status: "success", results: sections.length, data: { sections } });
});