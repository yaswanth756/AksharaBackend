import express from "express";
import { 
  createFeeStructure, 
  getStructuresByClass 
} from "../controllers/feeStructureController.js";
import { 
  collectFee, 
  getPaymentHistory, 
  getCollectionReport 
} from "../controllers/feePaymentController.js";
import { 
  getStudentFeeLedger, 
  applyConcession, 
  getDefaultersReport 
} from "../controllers/studentFeeController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect); // All Fee routes must be protected

// --- Fee Structure (Menu) ---
router.post("/structures", restrictTo("ADMIN"), createFeeStructure);
router.get("/structures", restrictTo("ADMIN", "OPERATOR"), getStructuresByClass);

// --- Fee Payment (Receipts) ---
router.post("/pay", restrictTo("ADMIN", "OPERATOR"), collectFee);
router.get("/history/:studentId", getPaymentHistory);
router.get("/reports/collection", restrictTo("ADMIN"), getCollectionReport);

// --- Student Ledger (Bills) ---
router.get("/ledger/:studentId", getStudentFeeLedger);
router.post("/ledger/concession/:ledgerId", restrictTo("ADMIN"), applyConcession);
router.get("/reports/defaulters", restrictTo("ADMIN"), getDefaultersReport);

export default router;