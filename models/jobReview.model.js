import mongoose from "mongoose";
const { Schema } = mongoose;

const JobReviewSchema = new Schema(
  {
    jobId: {
      type: String,
      required: true,
    },
    reviewerId: {
      type: String,
      required: true,
    },
    reviewedId: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    reviewType: {
      type: String,
      enum: ["client", "seller"],
      required: true,
    },
    comment: {
      type: String,
      required: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    }
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one review per job per reviewer per type
JobReviewSchema.index({ jobId: 1, reviewerId: 1, reviewType: 1 }, { unique: true });

export default mongoose.model("JobReview", JobReviewSchema);