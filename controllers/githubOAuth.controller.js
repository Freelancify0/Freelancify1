// controllers/github.controller.js
import axios from "axios";
import createError from "../utils/createError.js";

// Generate GitHub OAuth URL
export const getAuthUrl = async (req, res, next) => {
  try {
    // Get client ID from environment variable
    const clientId = process.env.GITHUB_CLIENT_ID;
    
    if (!clientId) {
      return next(createError(500, "GitHub API not properly configured"));
    }
    
    // Generate a random state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15);
    
    // Store state in session if you have sessions configured
    // If not, you can store it in a temporary database entry
    if (req.session) {
      req.session.githubState = state;
    }
    
    // Define redirect URI - must match what you've registered with GitHub
    const redirectUri = `${process.env.CLIENT_URL}/github-callback`;
    
    // Define scopes
    const scopes = ['user'];
    
    // Build GitHub OAuth URL
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes.join('%20')}&state=${state}`;
    
    console.log("Generated GitHub auth URL:", url);
    
    return res.status(200).json({ url });
  } catch (err) {
    console.error("Failed to generate GitHub auth URL:", err);
    return next(createError(500, "Failed to generate GitHub authentication URL"));
  }
};

// Complete GitHub authentication
export const completeAuth = async (req, res, next) => {
  try {
    const { code, state } = req.body;
    
    if (!code) {
      return next(createError(400, "Authorization code is required"));
    }
    
    // Verify state if using sessions
    if (req.session && req.session.githubState !== state) {
      return next(createError(403, "Invalid state parameter"));
    }
    
    // Exchange code for access token
    try {
      console.log("Exchanging code for access token...");
      
      const tokenResponse = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${process.env.CLIENT_URL}/github-callback`
        },
        {
          headers: {
            Accept: "application/json"
          }
        }
      );
      
      const { access_token, error } = tokenResponse.data;
      
      if (error || !access_token) {
        console.error("Failed to get access token:", error);
        return next(createError(400, error || "Failed to get access token"));
      }
      
      // Get GitHub user information
      console.log("Getting GitHub user information...");
      
      const userResponse = await axios.get("https://api.github.com/user", {
        headers: {
          Authorization: `token ${access_token}`
        }
      });
      
      // Extract GitHub username (login)
      const githubUsername = userResponse.data.login;
      
      if (!githubUsername) {
        return next(createError(400, "Could not retrieve GitHub username"));
      }
      
      console.log("GitHub username retrieved:", githubUsername);
      
      // Return GitHub username and basic profile information
      return res.status(200).json({
        githubUsername,
        name: userResponse.data.name,
        avatar: userResponse.data.avatar_url,
        profileUrl: userResponse.data.html_url
      });
    } catch (apiError) {
      console.error("GitHub API error:", apiError);
      
      if (apiError.response) {
        console.error("Response status:", apiError.response.status);
        console.error("Response data:", apiError.response.data);
      }
      
      return next(createError(500, "Failed to authenticate with GitHub API"));
    }
  } catch (err) {
    console.error("GitHub authentication error:", err);
    return next(createError(500, "Failed to complete GitHub authentication"));
  }
};