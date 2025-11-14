import express from 'express';
import { 
  createInquiry, 
  getAllInquiries, 
  addFollowUp, 
  updateInquiryStatus,
  contactInquiry,
  approveInquiry,
  rejectInquiry
} from '../controllers/inquiryController.js';
import { protect } from '../middleware/authMiddleware.js'; // Your auth middleware

const router = express.Router();

// Public route
router.post('/', createInquiry);

// Protected routes
router.get('/', protect, getAllInquiries);
router.post('/:id/followup', protect, addFollowUp);
router.put('/:id/status', protect, updateInquiryStatus);

// New specific status routes
router.put('/:id/contact', protect, contactInquiry);
router.put('/:id/approve', protect, approveInquiry);
router.put('/:id/reject', protect, rejectInquiry);

export default router;
