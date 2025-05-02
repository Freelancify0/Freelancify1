// routes/firebase.route.js
import express from "express";
// routes/firebase.route.js
// import express from "express";
import { 
  verifyFirebaseToken, 
  completeRegistration, 
  githubAuth, 
  completeGithubRegistration, 
  linkGithubAccount, 
  unlinkGithubAccount,
  extractGithubUsername,
  sendEmailVerification,
  verifyEmail,
  getGithubAuthUrl,
  completeGithubAuth,
  getGithubUsername,
  syncGithubAccount // New import
} from "../controllers/firebase.controller.js";

import { verifyToken } from "../middleware/jwt.js";

const router = express.Router();
router.get("/github-auth-url", getGithubAuthUrl);
router.post("/github-auth-callback", completeGithubAuth);
// Test route to verify the route is accessible
router.get("/test", (req, res) => {
  res.status(200).send("Firebase route is working");
});
// Add to firebase.route.js
router.post("/extract-github-username", verifyToken, extractGithubUsername);
// Google OAuth routes
router.post("/auth", verifyFirebaseToken);
router.post("/complete-registration", completeRegistration);

// GitHub OAuth routes
router.post("/github-auth", githubAuth);
router.post("/github-complete-registration", completeGithubRegistration);
router.post("/github-link", verifyToken, linkGithubAccount);
router.post("/github-unlink", verifyToken, unlinkGithubAccount);

// Email verification routes for non-OAuth users
router.post("/send-verification", sendEmailVerification);
router.post("/verify-email", verifyEmail);
router.post("/get-github-username", verifyToken, getGithubUsername);
// New route for GitHub sync
router.post("/sync-github", verifyToken, syncGithubAccount);
export default router;