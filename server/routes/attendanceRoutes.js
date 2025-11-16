import express from "express";
import { 
  markAttendance, 
  getMonthlyReport,
  getDailyStatus,
  getDailyReport
} from "../controllers/attendanceController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

// 🔒 Security: All routes require Login
router.use(protect);

// --- MARKING ---
// Allows Teachers to mark students, and Admins to mark anyone
router.post("/mark", restrictTo("ADMIN", "OPERATOR", "TEACHER"), markAttendance);

// --- UI HELPER ---
// Used by the Frontend "Mark Attendance" screen to show current state
router.get("/daily-status", restrictTo("ADMIN", "OPERATOR", "TEACHER"), getDailyStatus);

// --- REPORTS ---
router.get("/monthly", restrictTo("ADMIN", "OPERATOR", "TEACHER"), getMonthlyReport);
router.get("/daily-report", restrictTo("ADMIN", "OPERATOR"), getDailyReport);

export default router;