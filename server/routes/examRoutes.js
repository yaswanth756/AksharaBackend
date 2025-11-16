import express from "express";
import { 
  createExam, 
  updateExamStatus, 
  getExamsForTeacher ,
  getExamsByClass
} from "../controllers/examController.js";
import { 
  bulkUpdateMarks, 
  updateSingleResult, 
  getClassExamReport ,
  getMarks

} from "../controllers/examResultController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.route("/")
  .post(restrictTo("ADMIN"), createExam) // Create
  
// --- EXAM MANAGEMENT ---
router.post("/", restrictTo("ADMIN"), createExam);
router.patch("/:id/status", restrictTo("ADMIN"), updateExamStatus);
router.get("/teacher-list", getExamsForTeacher); // For dropdowns

// --- MARKS ENTRY ---
// Teachers can bulk update
router.post("/marks/bulk", restrictTo("ADMIN", "OPERATOR", "TEACHER"), bulkUpdateMarks);

// Admin Override (Single Correction)
router.patch("/results/:id", restrictTo("ADMIN"), updateSingleResult);

// --- REPORTS ---
router.get("/reports/class", getClassExamReport);

router.get("/", getExamsByClass);

router.get("/marks", getMarks);



export default router;