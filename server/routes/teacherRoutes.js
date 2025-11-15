import express from "express";
import { 
  createTeacher, 
  getAllTeachers, 
  teacherLogin,
  assignClassTeacher,
  updateTeacher,
  getTeacher
} from "../controllers/teacherController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public Route (For Teacher App)
router.post("/login", teacherLogin);

// Protected Routes
router.use(protect);

// Get all teachers (for dropdowns)
router.get("/", getAllTeachers);

// Admin/Operator only routes
router.post("/", restrictTo("ADMIN", "OPERATOR"), createTeacher);
router.post("/assign-class", restrictTo("ADMIN"), assignClassTeacher);

// Update and get single teacher
router
  .route("/:id")
  .get(getTeacher)
  .patch(restrictTo("ADMIN", "OPERATOR"), updateTeacher);

export default router;
