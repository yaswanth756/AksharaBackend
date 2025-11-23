import express from "express";
import { 
  admitStudent, 
  getAllStudents, 
  searchStudents,   
  getStudentStats,
  getStudent, 
  updateStudent ,
  getStudentProfile
} from "../controllers/studentController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

// 🔒 Secure all routes
router.use(protect);

// --- SPECIAL ROUTES (Must be above generic ones) ---
router.get("/search",restrictTo("ADMIN", "OPERATOR") ,searchStudents); // /api/v1/students/search?query=...
router.get("/stats", restrictTo("ADMIN,", "OPERATOR"), getStudentStats); // /api/v1/students/stats

// --- GENERIC ROUTES ---
router.post("/admit", restrictTo("ADMIN", "OPERATOR"), admitStudent);
router.get("/", restrictTo("ADMIN", "OPERATOR", "TEACHER"), getAllStudents);

router.get("/:id/profile", restrictTo("ADMIN", "OPERATOR", "TEACHER"), getStudentProfile);

router
  .route("/:id")
  .get(getStudent)                                      // View Profile
  .patch(restrictTo("ADMIN", "OPERATOR"), updateStudent);
export default router;