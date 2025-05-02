import Review from "../models/review.model.js";
import Gig from "../models/gig.model.js";
import Order from "../models/order.model.js";
import createError from "../utils/createError.js";

export const createReview = async (req, res, next) => {
  try {
    // Check if there is a completed order for this gig by this user
    const orders = await Order.find({
      gigId: req.body.gigId,
      buyerId: req.userId,
      isCompleted: true,
    });

    if (orders.length === 0) {
      return next(
        createError(403, "You can only review a gig after completing an order")
      );
    }

    // Check if user has already reviewed this gig
    const existingReview = await Review.findOne({
      gigId: req.body.gigId,
      userId: req.userId,
    });

    if (existingReview) {
      return next(
        createError(403, "You have already created a review for this gig")
      );
    }

    // Create the review
    const newReview = new Review({
      userId: req.userId,
      gigId: req.body.gigId,
      desc: req.body.desc,
      star: req.body.star,
    });

    // Save the review
    const savedReview = await newReview.save();

    // Update the gig's rating totals
    await Gig.findByIdAndUpdate(req.body.gigId, {
      $inc: { totalStars: req.body.star, starNumber: 1 },
    });

    res.status(201).json(savedReview);
  } catch (err) {
    next(err);
  }
};

export const getReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ gigId: req.params.gigId }).sort({ createdAt: -1 });
    res.status(200).json(reviews);
  } catch (err) {
    next(err);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return next(createError(404, "Review not found"));
    }
    
    if (review.userId !== req.userId) {
      return next(createError(403, "You can only delete your own review"));
    }

    // Find the star value before deleting
    const starValue = review.star;
    
    // Delete the review
    await Review.findByIdAndDelete(req.params.id);
    
    // Update the gig rating totals - decrement both totalStars and starNumber
    await Gig.findByIdAndUpdate(review.gigId, {
      $inc: { totalStars: -starValue, starNumber: -1 },
    });
    
    res.status(200).send("Review has been deleted");
  } catch (err) {
    next(err);
  }
};