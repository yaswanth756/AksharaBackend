
import AdmissionInquiry from "../models/AdmissionInquiry.js";
import ClassLevel from "../models/ClassLevel.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";

export const createInquiry = catchAsync(async (req, res, next) => {
  // 1. Destructure ALL fields from Frontend (including parentEmail)
  const { 
    childName, 
    parentName, 
    parentPhone,
    parentEmail,      // ✅ Added this - was missing!
    previousSchool,
    classApplyingFor,
    address
  } = req.body;

  // 2. Validate required fields
  if (!childName || !parentName || !parentPhone || !parentEmail || !classApplyingFor || !address) {
    return next(new AppError('Please provide all required fields', 400));
  }

  

  // 3. Generate Inquiry Number
  const inquiryNo = `INQ-${Date.now().toString().slice(-6)}`;

  // 4. Create Record
  const newInquiry = await AdmissionInquiry.create({
    inquiryNo,
    childName,
    parentName,
    parentPhone,
    parentEmail,     // ✅ Now included in DB save
    previousSchool: previousSchool || 'N/A',
    classApplyingFor,
    address,
    status: "pending",
  });

  // 5. Send Response
  res.status(201).json({
    success: true,    // ✅ Frontend checks data.success
    message: "Inquiry received!",
    inquiryNo: newInquiry.inquiryNo,  // ✅ Frontend needs this
    data: { 
      inquiry: newInquiry 
    }
  });
});



export const getAllInquiries = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const inquiries = await AdmissionInquiry.find(filter)
    .sort("-createdAt")
    .populate("classApplyingFor", "name");

  // Transform data to match frontend expectations
  const transformedInquiries = inquiries.map(inquiry => ({
    _id: inquiry._id,
    admissionId: inquiry.inquiryNo,
    fullName: inquiry.childName,
    parentName: inquiry.parentName,
    parentPhone: inquiry.parentPhone,
    parentEmail: inquiry.parentEmail,
    class: inquiry.classApplyingFor?.name || inquiry.classApplyingFor,
    previousSchool: inquiry.previousSchool,
    address: inquiry.address,
    status: inquiry.status,
    notes: inquiry.notes,
    reviewedBy: inquiry.reviewedBy,
    reviewedOn: inquiry.reviewedOn,
    createdAt: inquiry.createdAt,
    submittedOn: inquiry.createdAt
  }));

  res.status(200).json({
    success: true,  // ✅ Frontend checks this
    results: transformedInquiries.length,
    data: transformedInquiries  // ✅ Direct array, not nested
  });
});


/* ============================================
   3. PROTECTED: Add Call Note (Follow Up)
   ============================================ */
// ✅ Contact inquiry - optimized with findByIdAndUpdate
export const contactInquiry = catchAsync(async (req, res, next) => {
  const { notes } = req.body;
  
  // Using findByIdAndUpdate - faster and cleaner
  const inquiry = await AdmissionInquiry.findByIdAndUpdate(
    req.params.id,  // ✅ Now this is the MongoDB _id
    { 
      status: "contacted",
      notes,
      reviewedBy: req.user?._id,
      reviewedOn: new Date()
    },
    { 
      new: true,  // Return updated document
      runValidators: true 
    }
  );

  if (!inquiry) {
    return next(new AppError("Inquiry not found", 404));
  }

  res.status(200).json({
    success: true,
    data: {
      _id: inquiry._id,
      admissionId: inquiry.inquiryNo,
      fullName: inquiry.childName,
      status: inquiry.status,
      notes: inquiry.notes,
      reviewedOn: inquiry.reviewedOn
    }
  });
});

// ✅ Approve inquiry
export const approveInquiry = catchAsync(async (req, res, next) => {
  const { notes } = req.body;
  
  const inquiry = await AdmissionInquiry.findByIdAndUpdate(
    req.params.id,
    { 
      status: "approved",
      notes,
      reviewedBy: req.user?._id,
      reviewedOn: new Date()
    },
    { new: true, runValidators: true }
  );

  if (!inquiry) {
    return next(new AppError("Inquiry not found", 404));
  }

  res.status(200).json({
    success: true,
    data: {
      _id: inquiry._id,
      admissionId: inquiry.inquiryNo,
      fullName: inquiry.childName,
      status: inquiry.status,
      notes: inquiry.notes,
      reviewedOn: inquiry.reviewedOn
    }
  });
});

// ✅ Reject inquiry
export const rejectInquiry = catchAsync(async (req, res, next) => {
  const { notes } = req.body;
  
  if (!notes || notes.trim() === "") {
    return next(new AppError("Rejection reason is required", 400));
  }
  
  const inquiry = await AdmissionInquiry.findByIdAndUpdate(
    req.params.id,
    { 
      status: "rejected",
      notes,
      reviewedBy: req.user?._id,
      reviewedOn: new Date()
    },
    { new: true, runValidators: true }
  );

  if (!inquiry) {
    return next(new AppError("Inquiry not found", 404));
  }

  res.status(200).json({
    success: true,
    data: {
      _id: inquiry._id,
      admissionId: inquiry.inquiryNo,
      fullName: inquiry.childName,
      status: inquiry.status,
      notes: inquiry.notes,
      reviewedOn: inquiry.reviewedOn
    }
  });
});

// ✅ Update existing methods
export const updateInquiryStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;

  const inquiry = await AdmissionInquiry.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  );

  if (!inquiry) {
    return next(new AppError("Inquiry not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: { inquiry }
  });
});

export const addFollowUp = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { note, nextCallDate } = req.body;

  const inquiry = await AdmissionInquiry.findById(id);  // ✅ Uses _id now
  if (!inquiry) {
    return next(new AppError("Inquiry not found", 404));
  }

  inquiry.followUps.push({
    note,
    nextCallDate,
    calledBy: req.user._id,
    date: Date.now()
  });

  if (inquiry.status === "pending") {
    inquiry.status = "contacted";
  }

  await inquiry.save();

  res.status(200).json({
    status: "success",
    message: "Follow-up note added",
    data: { inquiry }
  });
});
