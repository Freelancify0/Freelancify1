import express from "express";
import { verifyToken } from "../middleware/jwt.js";
import {
  createJobReview,
  getJobReviews,
  getUserReviews,
  getReviewsByUser,
  updateJobReview,
  deleteJobReview,
} from "../controllers/jobReview.controller.js";

const router = express.Router();

// Create a review
router.post("/", verifyToken, createJobReview);

// Get reviews for a job
router.get("/job/:jobId", getJobReviews);

// Get reviews for a user (received reviews)
router.get("/user/:userId", getUserReviews);

// Get reviews by a user (given reviews)
router.get("/by-user/:userId", verifyToken, getReviewsByUser);

// Update a review
router.put("/:reviewId", verifyToken, updateJobReview);

// Delete a review
router.delete("/:reviewId", verifyToken, deleteJobReview);

export default router;