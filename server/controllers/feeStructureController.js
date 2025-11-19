import FeeStructure from "../models/FeeStructure.js";
import StudentFee from "../models/StudentFee.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";

/* ============================================
   1. CREATE FEE STRUCTURE (Admin)
   Defines the "Menu" for a class
   ============================================ */
export const createFeeStructure = catchAsync(async (req, res, next) => {
  const { name, academicYearId, classLevelId, components } = req.body;

  // 1. Calculate Total Yearly Amount from components
  let totalYearlyAmount = 0;
  const installmentsTemplate = [];

  components.forEach(comp => {
    if (comp.frequency === "MONTHLY") {
      totalYearlyAmount += comp.amount * 12; // Assuming 12 months
      // Create 12 installment templates
      for (let i = 0; i < 12; i++) {
        const month = new Date(2000, i, 1).toLocaleString('default', { month: 'long' });
        installmentsTemplate.push({
          name: `${comp.name} - ${month}`,
          amount: comp.amount,
          // dueDate: ... logic to set 10th of each month
        });
      }
    } else if (comp.frequency === "YEARLY" || comp.frequency === "ONE_TIME") {
      totalYearlyAmount += comp.amount;
      installmentsTemplate.push({
        name: comp.name,
        amount: comp.amount,
        // dueDate: ...
      });
    }
    // Add logic for QUARTERLY if needed
  });

  // 2. Create the Structure
  const feeStructure = await FeeStructure.create({
    name,
    academicYear: academicYearId,
    classLevel: classLevelId,
    components,
    totalYearlyAmount,
    // We can store the generated installment template here
    // installmentsTemplate: installmentsTemplate 
  });

  res.status(201).json({
    status: "success",
    message: "Fee Structure created successfully",
    data: { feeStructure }
  });
});

/* ============================================
   2. GET STRUCTURES BY CLASS (For Dropdowns)
   ============================================ */
export const getStructuresByClass = catchAsync(async (req, res, next) => {
  const { classId, yearId } = req.query;

  const structures = await FeeStructure.find({
    classLevel: classId,
    academicYear: yearId
  });

  res.status(200).json({
    status: "success",
    results: structures.length,
    data: { structures }
  });
});

/* ============================================
   3. (Helper) GENERATE LEDGER FOR STUDENT
   This is called by the 'admitStudent' controller
   ============================================ */
export const generateStudentFeeLedger = async (student, academicYear, classLevel, session) => {
  // 1. Find the right Fee Structure
  const feeStructure = await FeeStructure.findOne({ 
    academicYear, 
    classLevel 
  }).session(session);
  
  if (!feeStructure) {
    // If no structure, don't create a bill
    console.warn(`No Fee Structure found for Class ${classLevel} in Year ${academicYear}`);
    return null;
  }

  // 2. Generate Installments from the Structure's components
  const installments = [];
  feeStructure.components.forEach(comp => {
    if (comp.frequency === "MONTHLY") {
      for (let i = 0; i < 12; i++) {
        const month = new Date(2000, 3 + i, 1).toLocaleString('default', { month: 'long' }); // Apr, May...
        installments.push({
          name: `${comp.name} - ${month}`,
          amount: comp.amount,
          dueDate: new Date(2025, 3 + i, comp.dueDay || 10), // Example: Apr 10
          paidAmount: 0,
          status: "PENDING"
        });
      }
    } else {
      installments.push({
        name: comp.name,
        amount: comp.amount,
        dueDate: new Date(2025, 3, comp.dueDay || 10), // Example: Apr 10
        paidAmount: 0,
        status: "PENDING"
      });
    }
  });

  // 3. Create the Student's Personal Bill (Ledger)
  const studentFee = await StudentFee.create([{
    student: student._id,
    academicYear: academicYear,
    classLevel: classLevel,
    feeStructure: feeStructure._id,
    totalAmount: feeStructure.totalYearlyAmount,
    concessionAmount: 0,
    finalAmount: feeStructure.totalYearlyAmount,
    paidAmount: 0,
    dueAmount: feeStructure.totalYearlyAmount,
    status: "PENDING",
    installments
  }], { session });
  console.log("Studnest fee", studentFee[0]);

  return studentFee[0];
};