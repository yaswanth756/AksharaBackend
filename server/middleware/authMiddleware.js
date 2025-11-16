import jwt from "jsonwebtoken";
import { promisify } from "util";
import Admin from "../models/Admin.js";
import Teacher from "../models/Teacher.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";

/* ============================================
   1. PROTECT (Login Check)
   ============================================ */
   export const protect = catchAsync(async (req, res, next) => {
    // 1. Get token
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
  
    if (!token) {
      return next(new AppError("You are not logged in!", 401));
    }
  
    // 2. Verify Token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  
    // 3. Check if User exists in ADMIN collection
    let currentUser = await Admin.findById(decoded.id);
  
    // 4. If not Admin, check TEACHER collection
    if (!currentUser) {
      currentUser = await Teacher.findById(decoded.id);
    }
  
    if (!currentUser) {
      return next(new AppError("The user belonging to this token no longer exists.", 401));
    }
  
    // 5. Grant Access
    req.user = currentUser;
    next();
  });

/* ============================================
   2. RESTRICT (Role Check)
   ============================================ */
// Usage: restrictTo('ADMIN') or restrictTo('ADMIN', 'SUPER_ADMIN')
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }
    next();
  };
};