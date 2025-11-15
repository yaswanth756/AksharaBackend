import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";

/* ===================================================
   JWT Helper
=================================================== */
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "90d",
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  // Clear sensitive fields
  user.otp = undefined;
  user.otpExpires = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: { user }, // ✅ Consistent with JWT standard
  });
};

/* ===================================================
   1. Seed Owner (run once)
=================================================== */
export const seedOwner = catchAsync(async (req, res, next) => {
  const existingAdmin = await Admin.findOne({ role: "ADMIN" });

  if (existingAdmin) {
    return next(new AppError("Owner already exists!", 403));
  }

  const newOwner = await Admin.create({
    name: "School Owner",
    email: "admin@school.com",
    phone: "9999999999",
    role: "ADMIN",
    status: "ACTIVE",
  });

  createSendToken(newOwner, 201, res);
});

/* ===================================================
   2. LOGIN STEP 1: Send OTP to Email
=================================================== */
const otpStore = new Map();

// ✅ Optional: Add cleanup for expired OTPs
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (data.expires < now) {
      otpStore.delete(email);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

export const sendOtp = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) return next(new AppError("Email is required", 400));

  // Verify admin exists in DB
  const admin = await Admin.findOne({ email });
  if (!admin) {
    return next(new AppError("No user found with this email", 404));
  }

  if (admin.status !== "ACTIVE") {
    return next(new AppError("Your account is inactive. Contact admin.", 401));
  }

  // Generate 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 10 * 60 * 1000; // 10 mins

  // Store in memory
  otpStore.set(email, { otp, expires });

  // DEV MODE - Show OTP in console
  console.log(`🔐 OTP for ${email}: ${otp}`);
  console.log(`📊 Current OTP Store size: ${otpStore.size}`);

  res.status(200).json({
    status: "success",
    message: "OTP sent to email (check console in dev)",
  });
});

/* ===================================================
   3. VERIFY OTP (From Memory)
=================================================== */
export const verifyOtp = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new AppError("Email and OTP are required", 400));
  }

  // Get OTP from memory
  const storedData = otpStore.get(email);

  if (!storedData) {
    return next(new AppError("OTP not found or expired", 401));
  }

  // Validate OTP and expiry
  const otpIsValid = storedData.otp === otp && storedData.expires > Date.now();

  if (!otpIsValid) {
    otpStore.delete(email); // Clear invalid OTP
    return next(new AppError("Invalid OTP or OTP expired", 401));
  }

  // Clear OTP after successful verification
  otpStore.delete(email);

  // Get admin for JWT token
  const admin = await Admin.findOne({ email });
  
  if (!admin) {
    return next(new AppError("User not found", 404));
  }

  admin.lastLogin = Date.now();
  await admin.save({ validateBeforeSave: false });

  createSendToken(admin, 200, res);
});

/* ===================================================
   4. Create Operator
=================================================== */
export const createOperator = catchAsync(async (req, res, next) => {
  const { name, phone, email } = req.body;

  if (!name || !email || !phone) {
    return next(new AppError("Name, email & phone are required", 400));
  }

  const newOperator = await Admin.create({
    name,
    phone,
    email,
    role: "OPERATOR",
    status: "ACTIVE",
  });

  res.status(201).json({
    status: "success",
    data: {
      user: newOperator,
    },
  });
});


export const getAdminProfile = async (req, res) => {
  try {
   
    const { adminId } = req.user;

    // Fetch admin details from DB
    const admin = await Admin.findOne(
      { adminId },
      { name: 1, email: 1, role: 1, _id: 0 } // select only specific fields
    );

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.status(200).json({
      success: true,
      profile: admin,
    });
  } catch (err) {
    console.error("Get Admin Profile Error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching admin profile",
    });
  }
};