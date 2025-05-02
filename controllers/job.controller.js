import Job from "../models/job.model.js";
import User from "../models/user.model.js";
import createError from "../utils/createError.js";
import Stripe from "stripe";

// Create a new job
export const createJob = async (req, res, next) => {
  try {
    // Check if user is a seller (sellers can't post jobs)
    if (req.isSeller) {
      return next(createError(403, "Sellers cannot create job postings!"));
    }

    const newJob = new Job({
      userId: req.userId,
      ...req.body,
    });

    const savedJob = await newJob.save();
    res.status(201).json(savedJob);
  } catch (err) {
    next(err);
  }
};

// Delete a job
export const deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return next(createError(404, "Job not found!"));
    }
    
    if (job.userId !== req.userId) {
      return next(createError(403, "You can only delete your own job postings!"));
    }

    // Check if the job has an accepted bid
    if (job.acceptedBid) {
      return next(createError(403, "Cannot delete job with an accepted bid!"));
    }

    await Job.findByIdAndDelete(req.params.id);
    res.status(200).send("Job has been deleted!");
  } catch (err) {
    next(err);
  }
};

// Get a single job
export const getJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return next(createError(404, "Job not found!"));
    }
    
    res.status(200).send(job);
  } catch (err) {
    next(err);
  }
};

// Get all jobs with filters
export const getJobs = async (req, res, next) => {
  const q = req.query;
  const filters = {
    ...(q.userId && { userId: q.userId }),
    ...(q.category && { category: q.category }),
    ...(q.status && { status: q.status }),
    ...((q.min || q.max) && {
      budget: {
        ...(q.min && { $gt: parseInt(q.min) }),
        ...(q.max && { $lt: parseInt(q.max) }),
      },
    }),
    ...(q.search && { title: { $regex: q.search, $options: "i" } }),
  };

  try {
    const jobs = await Job.find(filters).sort({ createdAt: -1 });
    res.status(200).send(jobs);
  } catch (err) {
    next(err);
  }
};

// Get jobs posted by the current user
export const getMyJobs = async (req, res, next) => {
  try {
    // Sellers cannot post jobs
    if (req.isSeller) {
      return next(createError(403, "Sellers cannot post jobs!"));
    }

    const jobs = await Job.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.status(200).send(jobs);
  } catch (err) {
    next(err);
  }
};

// Add a bid to a job
export const addBid = async (req, res, next) => {
  try {
    // Only sellers can bid
    if (!req.isSeller) {
      return next(createError(403, "Only sellers can bid on jobs!"));
    }

    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return next(createError(404, "Job not found!"));
    }

    // Check if job is open
    if (job.status !== "open") {
      return next(createError(400, "This job is no longer accepting bids!"));
    }

    // Check if seller has already bid
    const existingBid = job.bids.find(bid => bid.sellerId === req.userId);
    if (existingBid) {
      return next(createError(400, "You have already bid on this job!"));
    }

    // Check if seller is the job poster
    if (job.userId === req.userId) {
      return next(createError(403, "You cannot bid on your own job!"));
    }

    // Create new bid
    const newBid = {
      sellerId: req.userId,
      price: req.body.price,
      deliveryTime: req.body.deliveryTime,
      message: req.body.message,
    };

    // Add bid to job
    job.bids.push(newBid);
    await job.save();

    res.status(201).send(job);
  } catch (err) {
    next(err);
  }
};

// Accept a bid
export const acceptBid = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.jobId);
    
    if (!job) {
      return next(createError(404, "Job not found!"));
    }

    // Check if user is the job poster
    if (job.userId !== req.userId) {
      return next(createError(403, "You can only accept bids on your own jobs!"));
    }

    // Check if job is open
    if (job.status !== "open") {
      return next(createError(400, "This job is no longer open!"));
    }

    // Find the bid
    const bidIndex = job.bids.findIndex(bid => bid._id.toString() === req.params.bidId);
    
    if (bidIndex === -1) {
      return next(createError(404, "Bid not found!"));
    }

    // Update bid status to accepted
    job.bids[bidIndex].status = "accepted";
    
    // Update other bids to rejected
    job.bids.forEach((bid, index) => {
      if (index !== bidIndex) {
        bid.status = "rejected";
      }
    });

    // Update job status to in-progress
    job.status = "in-progress";
    job.acceptedBid = job.bids[bidIndex]._id.toString();

    await job.save();
    res.status(200).send(job);
  } catch (err) {
    next(err);
  }
};

// Create payment intent for a job
export const jobPaymentIntent = async (req, res, next) => {
  try {
    const { jobId, bidId } = req.params;
    
    // Get job information
    const job = await Job.findById(jobId);
    
    if (!job) {
      return next(createError(404, "Job not found!"));
    }
    
    // Check if user is the job owner
    if (job.userId !== req.userId) {
      return next(createError(403, "Only the job owner can make payments!"));
    }
    
    // Find the accepted bid
    const acceptedBid = job.bids.find(bid => bid._id.toString() === bidId);
    
    if (!acceptedBid || acceptedBid.status !== "accepted") {
      return next(createError(400, "No accepted bid found!"));
    }
    
    // Get seller information for display
    const seller = await User.findById(acceptedBid.sellerId);
    if (!seller) {
      return next(createError(404, "Seller not found!"));
    }
    
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE);
    
    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(acceptedBid.price * 100), // Convert to cents
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        jobId: job._id.toString(),
        bidId: acceptedBid._id.toString(),
        sellerId: acceptedBid.sellerId,
        buyerId: job.userId
      }
    });
    
    // Return the client secret and job details
    res.status(200).send({
      clientSecret: paymentIntent.client_secret,
      jobDetails: {
        title: job.title,
        sellerName: seller.username,
        price: acceptedBid.price
      }
    });
  } catch (err) {
    next(err);
  }
};

// Confirm job payment and mark as completed
export const confirmJobPayment = async (req, res, next) => {
  try {
    const { payment_intent } = req.body;
    
    // Get the payment intent from Stripe to verify completion
    const stripe = new Stripe(process.env.STRIPE);
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent);
    
    if (paymentIntent.status !== "succeeded") {
      return next(createError(400, "Payment has not been completed"));
    }
    
    // Get metadata from payment intent
    const { jobId, bidId, sellerId } = paymentIntent.metadata;
    
    // Update job status to completed
    const job = await Job.findByIdAndUpdate(
      jobId,
      {
        $set: {
          status: "completed",
          completedAt: new Date()
        }
      },
      { new: true }
    );
    
    if (!job) {
      return next(createError(404, "Job not found"));
    }
    
    // Get seller information
    const seller = await User.findById(sellerId);
    
    // Return job details for the success page
    res.status(200).send({
      message: "Job has been completed and payment processed.",
      jobDetails: {
        jobId: job._id,
        title: job.title,
        sellerId: sellerId,
        sellerName: seller ? seller.username : "Freelancer",
        price: parseFloat(paymentIntent.amount) / 100 // Convert cents back to dollars
      }
    });
  } catch (err) {
    next(err);
  }
};

// Mark job as completed (now redirects to payment)
export const completeJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return next(createError(404, "Job not found!"));
    }

    // Check if user is the job poster
    if (job.userId !== req.userId) {
      return next(createError(403, "You can only complete your own jobs!"));
    }

    // Check if job is in progress
    if (job.status !== "in-progress") {
      return next(createError(400, "This job is not in progress!"));
    }

    // Find the accepted bid
    const acceptedBid = job.bids.find(bid => 
      bid._id.toString() === job.acceptedBid && bid.status === "accepted"
    );
    
    if (!acceptedBid) {
      return next(createError(404, "No accepted bid found for this job"));
    }

    // Instead of immediately marking the job as completed,
    // return information for redirecting to the payment page
    res.status(200).send({
      jobId: job._id,
      bidId: acceptedBid._id,
      message: "Ready for payment processing"
    });
  } catch (err) {
    next(err);
  }
};