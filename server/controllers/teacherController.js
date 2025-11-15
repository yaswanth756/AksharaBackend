// teacherController.js
import mongoose from 'mongoose'; // ✅ ADDED
import Teacher from "../models/Teacher.js";
import Section from "../models/Section.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";
import jwt from "jsonwebtoken";

// Helper for Token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "90d" });
};

/* ============================================
   1. ADMIN: Create Teacher
   ============================================ */
export const createTeacher = catchAsync(async (req, res, next) => {
  const { 
    name, phone, email, gender, 
    qualification, subjects, mainSubject, experience,
    bankDetailsUrl, address, photoUrl, perviousSchool,
    dob, section_id
  } = req.body;

  if (!name || !phone || !gender || !dob) {
    return next(new AppError('Name, phone, gender, and DOB are required', 400));
  }

  let classTeacherOf = null;
  if (section_id) {
    const section = await Section.findById(section_id);
    if (!section) {
      return next(new AppError('Invalid section ID', 400));
    }
    classTeacherOf = section._id;
  }

  const newTeacher = await Teacher.create({
    name, phone, email, gender, qualification, subjects, mainSubject,
    experience, bankDetailsUrl, address, photoUrl, perviousSchool, dob, classTeacherOf
  });

  const { password, bankDetailsUrl: _, salary: __, ...teacherData } = newTeacher.toObject();

  res.status(201).json({
    status: "success",
    data: { teacher: teacherData }
  });
});

/* ============================================
   2. PUBLIC/APP: Teacher Login
   ============================================ */
export const teacherLogin = catchAsync(async (req, res, next) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return next(new AppError("Please provide phone and password", 400));
  }

  const teacher = await Teacher.findOne({ phone }).select("+password");

  if (!teacher || !(await teacher.matchPassword(password))) {
    return next(new AppError("Incorrect phone or password", 401));
  }

  const token = signToken(teacher._id);
  res.status(200).json({
    status: "success",
    token,
    data: { id: teacher._id, name: teacher.name, role: "TEACHER" }
  });
});

/* ============================================
   3. ADMIN/STAFF: Get All Teachers
   ============================================ */
export const getAllTeachers = catchAsync(async (req, res, next) => {
  const filter = {};
  const { search, classId, sectionId, status } = req.query;
  
  filter.status = status || "ACTIVE";

  if (search) filter.$text = { $search: search };

  if (sectionId) {
    filter.classTeacherOf = sectionId;
  } else if (classId) {
    const sections = await Section.find({ classLevel: classId }).select("_id");
    if (sections.length > 0) {
      filter.classTeacherOf = { $in: sections.map(s => s._id) };
    } else {
      return res.status(200).json({ status: "success", results: 0, data: { teachers: [] } });
    }
  }

  const teachers = await Teacher.find(filter)
    .select("name teacherId mainSubject phone classTeacherOf status")
    .populate({
      path: "classTeacherOf",
      select: "name classLevel",
      populate: { path: "classLevel", select: "name" }
    });

  const result = teachers.map((teacher) => {
    let className = null;
    let sectionName = null;
    if (teacher.classTeacherOf) {
      sectionName = teacher.classTeacherOf.name;
      className = teacher.classTeacherOf.classLevel?.name || null;
    }

    return {
      _id: teacher._id,
      teacherId: teacher.teacherId,
      name: teacher.name,
      mainSubject: teacher.mainSubject,
      phone: teacher.phone,
      isClassTeacher: !!teacher.classTeacherOf,
      className,
      sectionName,
      classTeacherOf: className && sectionName ? `${className} - ${sectionName}` : sectionName || null,
      status: teacher.status,
    };
  });

  res.status(200).json({
    status: "success",
    results: result.length,
    data: { teachers: result }
  });
});

/* ============================================
   4. UPDATE TEACHER
   ============================================ */
   export const updateTeacher = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { 
      name, phone, email, gender, qualification, subjects, mainSubject,
      experience, bankDetailsUrl, address, photoUrl, perviousSchool, dob, section_id, status
    } = req.body;
  
    const teacher = await Teacher.findById(id);
    if (!teacher) return next(new AppError('Teacher not found', 404));
  
    let classTeacherOf = teacher.classTeacherOf;
    
    // ✅ Handle section assignment changes
    if (section_id !== undefined) {
      // Remove old section reference (if exists)
      if (teacher.classTeacherOf) {
        await Section.findByIdAndUpdate(
          teacher.classTeacherOf,
          { $unset: { classTeacher: 1 } }
        );
      }
  
      // Assign new section (if provided)
      if (section_id) {
        const section = await Section.findById(section_id);
        if (!section) return next(new AppError('Invalid section ID', 400));
        
        // Check if another teacher is already assigned to this section
        if (section.classTeacher && section.classTeacher.toString() !== id) {
          // Remove the other teacher's assignment
          await Teacher.findByIdAndUpdate(
            section.classTeacher,
            { $unset: { classTeacherOf: 1 } }
          );
        }
        
        // Update the new section with this teacher
        await Section.findByIdAndUpdate(
          section_id,
          { classTeacher: id }
        );
        
        classTeacherOf = section._id;
      } else {
        // Remove teacher assignment (set to null)
        classTeacherOf = null;
      }
    }
  
    const updateData = {
      name, phone, email, gender, qualification, subjects, mainSubject,
      experience, bankDetailsUrl, address, photoUrl, perviousSchool, dob, classTeacherOf, status
    };
  
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key];
    });
  
    const updatedTeacher = await Teacher.findByIdAndUpdate(id, updateData, 
      { new: true, runValidators: true }
    ).populate({
      path: "classTeacherOf",
      select: "name classLevel",
      populate: {
        path: "classLevel",
        select: "name"
      }
    });
  
    const { password, bankDetailsUrl: _, salary: __, ...teacherData } = updatedTeacher.toObject();
  
    res.status(200).json({
      status: "success",
      message: "Teacher updated successfully",
      data: { teacher: teacherData }
    });
  });
  

/* ============================================
   5. GET SINGLE TEACHER
   ============================================ */
export const getTeacher = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const teacher = await Teacher.findById(id)
    .populate({
      path: "classTeacherOf",
      select: "name classLevel",
      populate: { path: "classLevel", select: "name" }
    });

  if (!teacher) return next(new AppError('Teacher not found', 404));

  const { password, bankDetailsUrl: _, salary: __, ...teacherData } = teacher.toObject();

  res.status(200).json({
    status: "success",
    data: { teacher: teacherData }
  });
});
