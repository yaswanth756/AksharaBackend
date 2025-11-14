import express from "express";
import { 
  seedOwner, 
  sendOtp, 
  verifyOtp, 
  createOperator ,
  getAdminProfile
} from "../controllers/authController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();


//router.get("/seed-owner", seedOwner);
router.post("/login/send-otp", sendOtp); 
router.post("/login/verify-otp", verifyOtp);

// --- PROTECTED ROUTES (Login Required) ---
router.use(protect); // 🔒 All routes below this line need a Token

router.get("/profile", getAdminProfile);

// Only 'ADMIN' can create a new Operator
router.post(
  "/create-operator", 
  restrictTo("ADMIN"), 
  createOperator
);

export default router;