import express from "express";
import { 
  createAcademicYear, getAllYears,
  createClass, getAllClasses,
  createSection, getSectionsForClass
} from "../controllers/coreController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

// --- PUBLIC (Or protected, depending on your need) ---
// Dropdowns usually need to be public for the "Inquiry Form" on website
router.get("/academic-years", getAllYears);
router.get("/classes", getAllClasses);

// --- PROTECTED ADMIN SETUP ---
router.use(protect);
router.use(restrictTo("ADMIN"));

router.post("/academic-years", createAcademicYear);
router.post("/classes", createClass);

router.get("/sections", getSectionsForClass); // For Staff Dashboard
router.post("/sections", createSection);

export default router;