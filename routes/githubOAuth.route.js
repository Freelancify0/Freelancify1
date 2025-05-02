// routes/github.route.js
import express from "express";
import { getAuthUrl, completeAuth } from "../controllers/github.controller.js";

const router = express.Router();

// Get GitHub auth URL
router.get("/auth-url", getAuthUrl);

// Complete GitHub authentication
router.post("/complete-auth", completeAuth);

export default router;