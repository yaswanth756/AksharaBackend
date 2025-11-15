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
    dob, section_id // Optional: assign as class teacher
  } = req.body;

  // Validate required fields
  if (!name || !phone || !gender || !dob) {
    return next(new AppError('Name, phone, gender, and DOB are required', 400));
  }

  // Check if section exists (if provided)
  let classTeacherOf = null;
  if (section_id) {
    const section = await Section.findById(section_id);
    if (!section) {
      return next(new AppError('Invalid section ID', 400));
    }
    classTeacherOf = section._id;
  }

  const newTeacher = await Teacher.create({
    name,
    phone,
    email,
    gender,
    qualification,
    subjects,
    mainSubject,
    experience,
    bankDetailsUrl,
    address,
    photoUrl,
    perviousSchool,
    dob,
    classTeacherOf
  });

  // Hide sensitive fields in response
  const { password, bankDetailsUrl: _, salary: __, ...teacherData } = newTeacher.toObject();

  res.status(201).json({
    status: "success",
    data: { teacher: teacherData }
  });
});

/* ===========================================
   2. PUBLIC/APP: Teacher Login
   ============================================ */
export const teacherLogin = catchAsync(async (req, res, next) => {
  const { phone, password } = req.body;

  // 1. Check if phone and password exist
  if (!phone || !password) {
    return next(new AppError("Please provide phone and password", 400));
  }

  // 2. Check if user exists && password is correct
  const teacher = await Teacher.findOne({ phone }).select("+password");

  if (!teacher || !(await teacher.matchPassword(password))) {
    return next(new AppError("Incorrect phone or password", 401));
  }

  // 3. Send Token
  const token = signToken(teacher._id);
  res.status(200).json({
    status: "success",
    token,
    data: {
      id: teacher._id,
      name: teacher.name,
      role: "TEACHER"
    }
  });
});

/* ============================================
   3. ADMIN/STAFF: Get All Teachers
   ============================================ */
   export const getAllTeachers = catchAsync(async (req, res, next) => {
    const filter = {}; // ✅ Start with empty filter
    const { search, classId, sectionId, status } = req.query; // ✅ Get status from query
    console.log(req.query);
    // ✅ Status filter (dynamic)
    if (status) {
      filter.status = status;
    } else {
      filter.status = "ACTIVE"; // Default to ACTIVE if not provided
    }
  
    // Search
    if (search) {
      filter.$text = { $search: search };
    }
  
    if (sectionId) {
      filter.classTeacherOf = sectionId;
    } else if (classId) {
      const sections = await Section.find({ classLevel: classId }).select("_id");
      if (sections.length > 0) {
        filter.classTeacherOf = { $in: sections.map(s => s._id) };
      } else {
        return res.status(200).json({
          status: "success",
          results: 0,
          data: { teachers: [] },
        });
      }
    }
  
    // Populate Section and nested ClassLevel for class name
    const teachers = await Teacher.find(filter)
      .select("name teacherId mainSubject phone classTeacherOf status")
      .populate({
        path: "classTeacherOf",
        select: "name classLevel",
        populate: {
          path: "classLevel",
          select: "name",
        },
      });
  
    const result = teachers.map((teacher) => {
      let className = null;
      let sectionName = null;
      if (teacher.classTeacherOf) {
        sectionName = teacher.classTeacherOf.name;
        className = teacher.classTeacherOf.classLevel?.name || null;
      }
      console.log(teacher); 
  
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
      data: { teachers: result },
    });
  });
  
  

/* ============================================
   4. ASSIGN CLASS TEACHER (Update Section)
   ============================================ */
export const assignClassTeacher = catchAsync(async (req, res, next) => {
  const { teacherId, sectionId } = req.body;

  // Validate inputs
  if (!teacherId || !sectionId) {
    return next(new AppError("Teacher ID and Section ID are required", 400));
  }

  // Check if teacher exists
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    return next(new AppError("Teacher not found", 404));
  }

  // Check if section exists
  const section = await Section.findById(sectionId);
  if (!section) {
    return next(new AppError("Section not found", 404));
  }

  // Update the Section
  await Section.findByIdAndUpdate(sectionId, { classTeacher: teacherId });

  // Update the Teacher
  await Teacher.findByIdAndUpdate(teacherId, { classTeacherOf: sectionId });

  res.status(200).json({
    status: "success",
    message: "Class Teacher Assigned Successfully"
  });
});

/* ============================================
   5. UPDATE TEACHER
   ============================================ */
export const updateTeacher = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { 
    name, phone, email, gender, 
    qualification, subjects, mainSubject, experience,
    bankDetailsUrl, address, photoUrl, perviousSchool,
    dob, section_id, status
  } = req.body;

  // Find teacher
  const teacher = await Teacher.findById(id);
  if (!teacher) {
    return next(new AppError('Teacher not found', 404));
  }

  // Check if section exists (if provided)
  let classTeacherOf = teacher.classTeacherOf;
  if (section_id !== undefined) {
    if (section_id) {
      const section = await Section.findById(section_id);
      if (!section) {
        return next(new AppError('Invalid section ID', 400));
      }
      classTeacherOf = section._id;
    } else {
      classTeacherOf = null;
    }
  }

  // Prepare update data
  const updateData = {
    name,
    phone,
    email,
    gender,
    qualification,
    subjects,
    mainSubject,
    experience,
    bankDetailsUrl,
    address,
    photoUrl,
    perviousSchool,
    dob,
    classTeacherOf,
    status
  };

  // Remove undefined values
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  // Update teacher
  const updatedTeacher = await Teacher.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate("classTeacherOf", "name");

  // Hide sensitive fields in response
  const { password, bankDetailsUrl: _, salary: __, ...teacherData } = updatedTeacher.toObject();

  res.status(200).json({
    status: "success",
    message: "Teacher updated successfully",
    data: { teacher: teacherData }
  });
});

/* ============================================
   6. GET SINGLE TEACHER
   ============================================ */
   export const getTeacher = catchAsync(async (req, res, next) => {
    const { id } = req.params;
  
    const teacher = await Teacher.findById(id)
      .populate({
        path: "classTeacherOf",
        select: "name classLevel",
        populate: {
          path: "classLevel",
          select: "name"
        }
      }); // ✅ Populate section with nested classLevel
  
    if (!teacher) {
      return next(new AppError('Teacher not found', 404));
    }
  
    // Hide sensitive fields in response
    const { password, bankDetailsUrl: _, salary: __, ...teacherData } = teacher.toObject();
  
    res.status(200).json({
      status: "success",
      data: { teacher: teacherData }
    });
  });
  
