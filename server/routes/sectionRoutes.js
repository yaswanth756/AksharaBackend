// routes/sectionRoutes.js
import express from "express";
import { 
  createSection, 
  getSectionsByClass, 
  updateSection, 
  deleteSection,
  getSectionStats,
  assignStudentsToSection,
  getStudentsInSection,
  getUnassignedStudents,
  shiftStudentToSection, // ✅ This is the correct name
  removeStudentFromSection,
  assignClassTeacher,
  getSectionById
} from "../controllers/sectionController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// Public routes
router.get("/", getSectionsByClass);
router.get("/:id/students", getStudentsInSection);
router.get("/unassigned", getUnassignedStudents);
router.get("/:id/stats", getSectionStats);

// Admin only routes
router.post("/", restrictTo("ADMIN", "OPERATOR"), createSection);
router.patch("/:id", restrictTo("ADMIN", "OPERATOR"), updateSection);
router.delete("/:id", restrictTo("ADMIN", "OPERATOR"), deleteSection);

// Student & Teacher Assignment
router.post("/:id/assign-students", restrictTo("ADMIN", "OPERATOR"), assignStudentsToSection);
router.post("/shift-student", restrictTo("ADMIN", "OPERATOR"), shiftStudentToSection); // ✅ Correct
router.post("/remove-student", restrictTo("ADMIN", "OPERATOR"), removeStudentFromSection);
router.post("/assign-teacher", restrictTo("ADMIN", "OPERATOR"), assignClassTeacher);

router.get("/:id", getSectionById);
export default router;
