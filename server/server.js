import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { connectDB } from './config/db.js';


import authRouter from "./routes/authRoutes.js";
import inquiryRouter from "./routes/inquiryRoutes.js";
import coreRouter from "./routes/coreRoutes.js";
import studentRouter from "./routes/studentRoutes.js";
import teacherRouter from "./routes/teacherRoutes.js";
import sectionRouter from "./routes/sectionRoutes.js";
import attendanceRouter from "./routes/attendanceRoutes.js";
import examRouter from "./routes/examRoutes.js";
import { seedFullDatabase } from './utils/seedData.js';

const app = express();
dotenv.config();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000', 
  credentials: true, 
}));
app.use(express.json());

const PORT = process.env.PORT;

// Connect to database
connectDB();


//seedFullDatabase()

// auth Routes
app.use("/api/v1/auth", authRouter);

// Inquiry Routes
app.use("/api/v1/inquiries", inquiryRouter);

// Core Routes
app.use("/api/v1/core", coreRouter);

// Student Routes
app.use("/api/v1/students", studentRouter);


// Teacher Routes
app.use("/api/v1/teachers", teacherRouter);

// Section Routes
app.use("/api/v1/sections", sectionRouter);


// Attendance Routes
app.use("/api/v1/attendance", attendanceRouter);


// Exam Routes
app.use("/api/v1/exams", examRouter);


app.get('/test', (req, res) => {
  res.send('Hello World!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});