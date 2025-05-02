import createError from "../utils/createError.js";
import JobReview from "../models/jobReview.model.js";
import User from "../models/user.model.js";

export const createJobReview = async (req, res, next) => {
  try {
    // Validate request body
    const { jobId, reviewedId, rating, comment, reviewType } = req.body;
    
    if (!jobId || !reviewedId || !rating || !comment || !reviewType) {
      return next(createError(400, "Missing required fields for review"));
    }
    
    // Check if the user already submitted a review for this job with this type
    const existingReview = await JobReview.findOne({
      jobId,
      reviewerId: req.userId,
      reviewType
    });
    
    if (existingReview) {
      return next(createError(400, "You have already submitted a review for this job"));
    }
    
    // Create the new review
    const newReview = new JobReview({
      jobId,
      reviewerId: req.userId,
      reviewedId,
      rating,
      reviewType,
      comment,
      isPublic: req.body.isPublic !== undefined ? req.body.isPublic : true
    });
    
    // Save the review
    const savedReview = await newReview.save();
    
    // Update the user's total rating
    await User.findByIdAndUpdate(reviewedId, {
      $inc: { 
        totalRating: rating,
        reviewCount: 1
      }
    });
    
    res.status(201).json(savedReview);
  } catch (err) {
    next(err);
  }
};

export const getJobReviews = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return next(createError(400, "Job ID is required"));
    }
    
    const reviews = await JobReview.find({ jobId });
    res.status(200).json(reviews);
  } catch (err) {
    next(err);
  }
};

export const getUserReviews = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return next(createError(400, "User ID is required"));
    }
    
    // Get reviews where this user was reviewed
    const reviews = await JobReview.find({ 
      reviewedId: userId,
      isPublic: true  // Only return public reviews
    });
    
    res.status(200).json(reviews);
  } catch (err) {
    next(err);
  }
};

export const getReviewsByUser = async (req, res, next) => {
  try {
    // Get reviews created by the authenticated user
    const reviews = await JobReview.find({ reviewerId: req.userId });
    res.status(200).json(reviews);
  } catch (err) {
    next(err);
  }
};

export const updateJobReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment, isPublic } = req.body;
    
    // Find the review to update
    const review = await JobReview.findById(reviewId);
    
    if (!review) {
      return next(createError(404, "Review not found"));
    }
    
    // Check if the user is the owner of the review
    if (review.reviewerId !== req.userId) {
      return next(createError(403, "You can only update your own reviews"));
    }
    
    // Calculate rating change for user update
    const ratingDiff = rating - review.rating;
    
    // Update the review
    const updatedReview = await JobReview.findByIdAndUpdate(
      reviewId,
      {
        $set: {
          rating: rating !== undefined ? rating : review.rating,
          comment: comment !== undefined ? comment : review.comment,
          isPublic: isPublic !== undefined ? isPublic : review.isPublic
        }
      },
      { new: true }
    );
    
    // If rating changed, update the user's total rating
    if (ratingDiff !== 0) {
      await User.findByIdAndUpdate(review.reviewedId, {
        $inc: { totalRating: ratingDiff }
      });
    }
    
    res.status(200).json(updatedReview);
  } catch (err) {
    next(err);
  }
};

export const deleteJobReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    
    // Find the review to delete
    const review = await JobReview.findById(reviewId);
    
    if (!review) {
      return next(createError(404, "Review not found"));
    }
    
    // Check if the user is the owner of the review
    if (review.reviewerId !== req.userId) {
      return next(createError(403, "You can only delete your own reviews"));
    }
    
    // Delete the review
    await JobReview.findByIdAndDelete(reviewId);
    
    // Update the user's total rating
    await User.findByIdAndUpdate(review.reviewedId, {
      $inc: { 
        totalRating: -review.rating,
        reviewCount: -1
      }
    });
    
    res.status(200).send("Review has been deleted");
  } catch (err) {
    next(err);
  }
};