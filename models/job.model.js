import mongoose from "mongoose";
const { Schema } = mongoose;

const JobSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    budget: {
      type: Number,
      required: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "in-progress", "completed", "cancelled"],
      default: "open",
    },
    bids: {
      type: [
        {
          sellerId: {
            type: String,
            required: true,
          },
          price: {
            type: Number,
            required: true,
          },
          deliveryTime: {
            type: Number,
            required: true,
          },
          message: {
            type: String,
            required: true,
          },
          status: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "pending",
          },
          createdAt: {
            type: Date,
            default: Date.now,
          }
        }
      ],
      default: [],
    },
    acceptedBid: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Job", JobSchema);