// sectionController.js
import mongoose from 'mongoose'; // ✅ ADDED
import Section from "../models/Section.js";
import ClassLevel from "../models/ClassLevel.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";
import cache from "../utils/cache.js";

/* ============================================
   1. CREATE SECTION
   ============================================ */
export const createSection = catchAsync(async (req, res, next) => {
  const { name, classLevelId, capacity, roomNumber } = req.body;

  const classDoc = await ClassLevel.findById(classLevelId);
  if (!classDoc) {
    return next(new AppError("Class Level not found", 404));
  }

  const section = await Section.create({
    name,
    classLevel: classLevelId,
    capacity: capacity || 40,
    roomNumber
  });

  // Invalidate cache
  cache.del(`sections_${classLevelId}`);

  res.status(201).json({
    status: "success",
    message: "Section created successfully",
    data: { section }
  });
});

/* ============================================
   2. GET SECTIONS BY CLASS
   ============================================ */
export const getSectionsByClass = catchAsync(async (req, res, next) => {
  const { classId } = req.query;

  if (!classId) {
    return next(new AppError("Please provide a classId", 400));
  }

  const sections = await Section.find({ classLevel: classId })
    .populate("classTeacher", "name phone teacherId")
    .populate("classLevel", "name")
    .sort("name");

  const sectionsWithCount = await Promise.all(
    sections.map(async (section) => {
      const studentCount = await Student.countDocuments({
        section: section._id,
        status: "ACTIVE"
      });
      return {
        ...section.toObject(),
        currentStrength: studentCount
      };
    })
  );

  res.status(200).json({
    status: "success",
    results: sectionsWithCount.length,
    data: { sections: sectionsWithCount }
  });
});

/* ============================================
   3. GET STUDENTS IN SECTION
   ============================================ */
export const getStudentsInSection = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const section = await Section.findById(id)
    .populate("classLevel", "name")
    .populate("classTeacher", "name");

  if (!section) {
    return next(new AppError("Section not found", 404));
  }

  const students = await Student.find({
    section: id,
    status: "ACTIVE"
  })
    .select("admissionNo firstName lastName rollNo photoUrl")
    .sort("rollNo");

  res.status(200).json({
    status: "success",
    data: {
      section: {
        _id: section._id,
        name: section.name,
        className: section.classLevel.name,
        classTeacher: section.classTeacher?.name || null,
        capacity: section.capacity
      },
      students: students.map(s => ({
        _id: s._id,
        admissionNo: s.admissionNo,
        name: `${s.firstName} ${s.lastName || ''}`,
        rollNo: s.rollNo || null,
        photoUrl: s.photoUrl || null
      }))
    }
  });
});

/* ============================================
   4. GET UNASSIGNED STUDENTS
   ============================================ */
export const getUnassignedStudents = catchAsync(async (req, res, next) => {
  const { classId, search } = req.query;

  if (!classId) {
    return next(new AppError("Please provide a classId", 400));
  }

  const filter = {
    classLevel: classId,
    status: "ACTIVE",
    $or: [
      { section: null },
      { section: { $exists: false } }
    ]
  };

  if (search) {
    filter.$text = { $search: search };
  }

  const students = await Student.find(filter)
    .select("admissionNo firstName lastName rollNo")
    .limit(100)
    .sort("firstName");

  res.status(200).json({
    status: "success",
    results: students.length,
    data: {
      students: students.map(s => ({
        _id: s._id,
        admissionNo: s.admissionNo,
        name: `${s.firstName} ${s.lastName || ''}`,
        rollNo: s.rollNo || null
      }))
    }
  });
});

/* ============================================
   5. ASSIGN STUDENTS TO SECTION (Bulk)
   ============================================ */
export const assignStudentsToSection = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { studentIds } = req.body;

  if (!studentIds || studentIds.length === 0) {
    return next(new AppError("Please provide student IDs", 400));
  }

  const section = await Section.findById(id);
  if (!section) {
    return next(new AppError("Section not found", 404));
  }

  const currentCount = await Student.countDocuments({
    section: id,
    status: "ACTIVE"
  });
  const newTotal = currentCount + studentIds.length;

  if (newTotal > section.capacity) {
    return next(new AppError(
      `Cannot assign students. Section capacity is ${section.capacity}, current: ${currentCount}, trying to add: ${studentIds.length}`,
      400
    ));
  }

  const result = await Student.updateMany(
    { _id: { $in: studentIds } },
    {
      $set: {
        section: id,
        classLevel: section.classLevel
      }
    }
  );

  res.status(200).json({
    status: "success",
    message: `Successfully assigned ${result.modifiedCount} students to Section ${section.name}`,
    data: {
      sectionId: section._id,
      sectionName: section.name,
      totalStudents: newTotal
    }
  });
});

/* ============================================
   6. SHIFT STUDENT TO ANOTHER SECTION
   ============================================ */
export const shiftStudentToSection = catchAsync(async (req, res, next) => {
  const { studentId, targetSectionId } = req.body;

  if (!studentId || !targetSectionId) {
    return next(new AppError("Please provide studentId and targetSectionId", 400));
  }

  const targetSection = await Section.findById(targetSectionId)
    .populate("classLevel", "name");

  if (!targetSection) {
    return next(new AppError("Target section not found", 404));
  }

  const currentCount = await Student.countDocuments({
    section: targetSectionId,
    status: "ACTIVE"
  });

  if (currentCount >= targetSection.capacity) {
    return next(new AppError(
      `Target section is full. Capacity: ${targetSection.capacity}`,
      400
    ));
  }

  const student = await Student.findByIdAndUpdate(
    studentId,
    {
      section: targetSectionId,
      classLevel: targetSection.classLevel._id
    },
    { new: true }
  ).select("firstName lastName admissionNo");

  res.status(200).json({
    status: "success",
    message: `${student.firstName} moved to ${targetSection.classLevel.name} - Section ${targetSection.name}`,
    data: { student }
  });
});

/* ============================================
   7. REMOVE STUDENT FROM SECTION
   ============================================ */
export const removeStudentFromSection = catchAsync(async (req, res, next) => {
  const { studentId } = req.body;

  if (!studentId) {
    return next(new AppError("Please provide studentId", 400));
  }

  const student = await Student.findByIdAndUpdate(
    studentId,
    { $unset: { section: 1 } },
    { new: true }
  ).select("firstName lastName admissionNo");

  res.status(200).json({
    status: "success",
    message: `${student.firstName} ${student.lastName || ''} removed from section`,
    data: { student }
  });
});

/* ============================================
   8. UPDATE SECTION
   ============================================ */
export const updateSection = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const section = await Section.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true
  })
    .populate("classTeacher", "name phone")
    .populate("classLevel", "name");

  if (!section) {
    return next(new AppError("Section not found", 404));
  }

  // Invalidate cache using the section's classLevel
  // Note: section.classLevel is populated, so it might be an object. 
  // If it's an object, we need ._id, if it's an ID, we use it directly.
  // Mongoose populate replaces the ID with the object.
  const classId = section.classLevel._id || section.classLevel;
  cache.del(`sections_${classId}`);

  res.status(200).json({
    status: "success",
    message: "Section updated successfully",
    data: { section }
  });
});

/* ============================================
   9. ASSIGN CLASS TEACHER TO SECTION
   ============================================ */
export const assignClassTeacher = catchAsync(async (req, res, next) => {
  const { sectionId, teacherId } = req.body;

  if (!sectionId || !teacherId) {
    return next(new AppError("Please provide sectionId and teacherId", 400));
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const section = await Section.findById(sectionId).session(session);
    if (!section) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError("Section not found", 404));
    }

    const teacher = await Teacher.findById(teacherId).session(session);
    if (!teacher) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError("Teacher not found", 404));
    }

    // 1. Remove old teacher from this section (if exists)
    if (section.classTeacher) {
      await Teacher.findByIdAndUpdate(
        section.classTeacher,
        { $unset: { classTeacherOf: 1 } },
        { session }
      );
    }

    // 2. Remove this teacher from their previous section (if exists)
    if (teacher.classTeacherOf && teacher.classTeacherOf.toString() !== sectionId) {
      await Section.findByIdAndUpdate(
        teacher.classTeacherOf,
        { $unset: { classTeacher: 1 } },
        { session }
      );
    }

    // 3. Assign new teacher to section
    await Section.findByIdAndUpdate(
      sectionId,
      { classTeacher: teacherId },
      { session }
    );

    // 4. Assign section to teacher
    await Teacher.findByIdAndUpdate(
      teacherId,
      { classTeacherOf: sectionId },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: "success",
      message: `${teacher.name} assigned as class teacher`
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(new AppError("Failed to assign class teacher", 500));
  }
});

/* ============================================
   10. DELETE SECTION
   ============================================ */
export const deleteSection = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const studentCount = await Student.countDocuments({ section: id });
  if (studentCount > 0) {
    return next(new AppError(
      `Cannot delete section. It has ${studentCount} students. Please remove or shift them first.`,
      400
    ));
  }

  const section = await Section.findById(id);

  if (section?.classTeacher) {
    await Teacher.findByIdAndUpdate(
      section.classTeacher,
      { $unset: { classTeacherOf: 1 } }
    );
  }

  if (section) {
    // Invalidate cache before deleting
    cache.del(`sections_${section.classLevel}`);
    await Section.findByIdAndDelete(id);
  }

  res.status(204).json({
    status: "success",
    message: "Section deleted"
  });
});

/* ============================================
   11. GET SECTION STATS
   ============================================ */
export const getSectionStats = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const totalStudents = await Student.countDocuments({
    section: id,
    status: "ACTIVE"
  });

  const section = await Section.findById(id)
    .populate("classTeacher", "name photoUrl phone teacherId")
    .populate("classLevel", "name");

  const genderStats = await Student.aggregate([
    { $match: { section: section._id, status: "ACTIVE" } },
    { $group: { _id: "$gender", count: { $sum: 1 } } }
  ]);

  res.status(200).json({
    status: "success",
    data: {
      sectionName: section.name,
      className: section.classLevel.name,
      classTeacher: section.classTeacher,
      totalStudents,
      capacity: section.capacity,
      vacancy: section.capacity - totalStudents,
      genderStats
    }
  });
});

/* ============================================
   12. GET SECTION BY ID
   ============================================ */
export const getSectionById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const section = await Section.findById(id)
    .populate("classTeacher", "name phone teacherId")
    .populate("classLevel", "name");

  if (!section) {
    return next(new AppError("Section not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: { section }
  });
});
