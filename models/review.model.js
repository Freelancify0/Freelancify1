import mongoose from "mongoose";
const { Schema } = mongoose;

const ReviewSchema = new Schema(
  {
    gigId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    star: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    desc: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure a user can only have one review per gig
ReviewSchema.index({ gigId: 1, userId: 1 }, { unique: true });

export default mongoose.model("Review", ReviewSchema);