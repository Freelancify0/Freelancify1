import express from "express";
import { verifyToken } from "../middleware/jwt.js";
import {
  createJob,
  deleteJob,
  getJob,
  getJobs,
  getMyJobs,
  addBid,
  acceptBid,
  completeJob,
  jobPaymentIntent,
  confirmJobPayment
} from "../controllers/job.controller.js";

const router = express.Router();

// Create a new job
router.post("/", verifyToken, createJob);

// Delete a job
router.delete("/:id", verifyToken, deleteJob);

// Get a single job
router.get("/single/:id", getJob);

// Get all jobs with filters
router.get("/", getJobs);

// Get jobs posted by the current user
router.get("/myjobs", verifyToken, getMyJobs);

// Add a bid to a job
router.post("/bid/:id", verifyToken, addBid);

// Accept a bid
router.put("/accept/:jobId/:bidId", verifyToken, acceptBid);

// Complete a job
router.put("/complete/:id", verifyToken, completeJob);

// Payment routes
router.post("/payment/:jobId/:bidId", verifyToken, jobPaymentIntent);
router.post("/payment-confirm", verifyToken, confirmJobPayment);

export default router;