// import githubOauthRoute from "./routes/githubOauth.route.js";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import userRoute from "./routes/user.route.js";
import gigRoute from "./routes/gig.route.js";
import orderRoute from "./routes/order.route.js";
import conversationRoute from "./routes/conversation.route.js";
// import githubRoutes from "./routes/github.route.js";

import messageRoute from "./routes/message.route.js";
import reviewRoute from "./routes/review.route.js";
import authRoute from "./routes/auth.route.js";
import jobRoute from "./routes/job.route.js";
import jobReviewRoute from "./routes/jobReview.route.js";
import firebaseRoute from "./routes/firebase.route.js";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();
dotenv.config();
mongoose.set("strictQuery", true);

const connect = async () => {
  try {
    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
    
    await mongoose.connect(process.env.MONGO);
    console.log("Connected to MongoDB successfully!");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
};
// Fixed for ES Modules
// Add this to your server.js file

/**
 * Environment Variable Check for GitHub OAuth
 * This will help diagnose 500 errors in the GitHub OAuth flow
 */

// Check GitHub OAuth environment variables
const checkGitHubConfig = () => {
  console.log("\n--- GitHub OAuth Configuration Check ---");
  
  // Check CLIENT_URL
  if (!process.env.CLIENT_URL) {
    console.error("❌ CLIENT_URL environment variable is missing");
    console.error("   This is needed for the OAuth redirect URI");
    console.error("   Example: CLIENT_URL=http://localhost:5173");
  } else {
    console.log(`✅ CLIENT_URL is set to: ${process.env.CLIENT_URL}`);
  }
  
  // Check GITHUB_CLIENT_ID
  if (!process.env.GITHUB_CLIENT_ID) {
    console.error("❌ GITHUB_CLIENT_ID environment variable is missing");
    console.error("   This is required for GitHub OAuth");
    console.error("   Get this from your GitHub OAuth App settings");
  } else {
    console.log(`✅ GITHUB_CLIENT_ID is set (value hidden for security)`);
  }
  
  // Check GITHUB_CLIENT_SECRET
  if (!process.env.GITHUB_CLIENT_SECRET) {
    console.error("❌ GITHUB_CLIENT_SECRET environment variable is missing");
    console.error("   This is required for GitHub OAuth");
    console.error("   Get this from your GitHub OAuth App settings");
  } else {
    console.log(`✅ GITHUB_CLIENT_SECRET is set (value hidden for security)`);
  }
  
  // Check for proper redirect URL configuration
  if (process.env.CLIENT_URL && process.env.GITHUB_CLIENT_ID) {
    console.log(`ℹ️ Make sure your GitHub OAuth App has this redirect URL:`);
    console.log(`   ${process.env.CLIENT_URL}/github-callback`);
    console.log(`   Verify this in your GitHub OAuth App settings`);
  }
  
  console.log("---------------------------------------\n");
};

// Run the check
checkGitHubConfig();
  
// Export for ES modules
export { checkGitHubConfig };
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});
// app.use("/api/github", githubOauthRoute);
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
}));

app.use(express.json());
app.use(cookieParser());

app.get('/api/test', (req, res) => {
  res.status(200).send('API is working!');
});

app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/gigs", gigRoute);
app.use("/api/orders", orderRoute);
app.use("/api/conversations", conversationRoute);
app.use("/api/messages", messageRoute);
app.use("/api/reviews", reviewRoute);
app.use("/api/jobs", jobRoute);
app.use("/api/job-reviews", jobReviewRoute);
app.use("/api/firebase", firebaseRoute);

app.use((err, req, res, next) => {
  console.error("API Error:", err);
  const errorStatus = err.status || 500;
  const errorMessage = err.message || "Something went wrong!";

  return res.status(errorStatus).send(errorMessage);
});

const PORT = process.env.PORT || 8800;
app.listen(PORT, () => {
  connect();
  console.log(`Backend server is running on port ${PORT}!`);
});
