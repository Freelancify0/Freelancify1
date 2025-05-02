// controllers/firebase.controller.js
import admin from "../utils/firebaseAdmin.js";
import User from "../models/user.model.js";
import createError from "../utils/createError.js";
import jwt from "jsonwebtoken";
import axios from "axios";
import mongoose from "mongoose";

// Verify Firebase token and authenticate/register user
export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const { idToken, email, name, photo, isRegistration } = req.body;

    if (!idToken) {
      return next(createError(400, "Firebase ID token is required"));
    }

    // Verify the token with Firebase
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Check if this user already exists in our database
    let user = await User.findOne({
      $or: [
        { firebaseUid: uid },
        { email: email }
      ]
    });

    // If registration and user exists, return error
    if (isRegistration && user) {
      return next(createError(409, "User already exists. Please log in instead."));
    }

    // If user exists, update the last login and return user data
    if (user) {
      // Create JWT token
      const token = jwt.sign(
        {
          id: user._id,
          isSeller: user.isSeller,
        },
        process.env.JWT_SECRET
      );

      // Remove sensitive data before sending
      const { password, ...userWithoutPassword } = user._doc;

      // Set JWT in cookie and return user data
      return res
        .cookie("accessToken", token, { httpOnly: true })
        .status(200)
        .send(userWithoutPassword);
    }

    // For new registration without additional info, create minimal user
    if (isRegistration) {
      // Return data for the registration form to fill in
      return res.status(200).send({
        needsAdditionalInfo: true,
        userData: {
          email,
          name,
          photo,
          firebaseUid: uid,
        }
      });
    }

    // For login attempt with non-existent user
    return next(createError(404, "User not found. Please register first."));

  } catch (err) {
    console.error("Firebase token verification error:", err);
    return next(createError(401, "Invalid or expired Firebase token"));
  }
};

// Complete registration with additional user info
export const completeRegistration = async (req, res, next) => {
  try {
    const { userData, additionalInfo } = req.body;

    if (!userData || !additionalInfo) {
      return next(createError(400, "User data and additional info are required"));
    }

    // Check for required fields
    if (!additionalInfo.username || !additionalInfo.country) {
      return next(createError(400, "Username and country are required"));
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username: additionalInfo.username });
    if (existingUser) {
      return next(createError(409, "Username already exists"));
    }

    // Create new user with combined data
    const newUser = new User({
      username: additionalInfo.username,
      email: userData.email,
      // Use a placeholder password for OAuth users
      password: Math.random().toString(36).slice(-10), 
      img: userData.photo || "",
      country: additionalInfo.country,
      isSeller: additionalInfo.isSeller || false,
      desc: additionalInfo.desc || "",
      firebaseUid: userData.firebaseUid,
      googleId: userData.googleId || null,
      githubId: userData.githubId || null,
      // OAuth users are automatically verified
      emailVerified: true
    });

    // Save the new user
    await newUser.save();

    // Create JWT token
    const token = jwt.sign(
      {
        id: newUser._id,
        isSeller: newUser.isSeller,
      },
      process.env.JWT_SECRET
    );

    // Remove sensitive data before sending
    const { password, ...userWithoutPassword } = newUser._doc;

    // Set JWT in cookie and return user data
    return res
      .cookie("accessToken", token, { httpOnly: true })
      .status(201)
      .send(userWithoutPassword);
  } catch (err) {
    console.error("Registration error:", err);
    return next(createError(500, "Error completing registration"));
  }
};

// GitHub Authentication
export const githubAuth = async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code) {
      return next(createError(400, "GitHub authorization code is required"));
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code
      },
      {
        headers: {
          Accept: 'application/json'
        }
      }
    );

    const { access_token } = tokenResponse.data;

    if (!access_token) {
      return next(createError(401, "Failed to get GitHub access token"));
    }

    // Get user info from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${access_token}`
      }
    });

    const githubUser = userResponse.data;

    // Get user's email from GitHub (might be private)
    let userEmail = githubUser.email;
    
    if (!userEmail) {
      try {
        const emailResponse = await axios.get('https://api.github.com/user/emails', {
          headers: {
            Authorization: `token ${access_token}`
          }
        });
        
        // Find primary email
        const primaryEmail = emailResponse.data.find(email => email.primary);
        if (primaryEmail) {
          userEmail = primaryEmail.email;
        } else if (emailResponse.data.length > 0) {
          userEmail = emailResponse.data[0].email;
        }
      } catch (emailErr) {
        console.error("Could not fetch GitHub emails:", emailErr);
      }
    }

    if (!userEmail) {
      return next(createError(400, "Could not retrieve email from GitHub"));
    }

    // Check if user exists in our database
    let user = await User.findOne({
      $or: [
        { githubId: githubUser.id.toString() },
        { email: userEmail }
      ]
    });

    // If user exists, update GitHub info
    if (user) {
      user.githubId = githubUser.id.toString();
      user.githubUsername = githubUser.login;
      user.githubToken = access_token;
      user.img = user.img || githubUser.avatar_url;
      
      await user.save();

      // Create JWT token
      const token = jwt.sign(
        {
          id: user._id,
          isSeller: user.isSeller,
        },
        process.env.JWT_SECRET
      );

      // Remove sensitive data before sending
      const { password, ...userWithoutPassword } = user._doc;

      // Set JWT in cookie and return user data
      return res
        .cookie("accessToken", token, { httpOnly: true })
        .status(200)
        .send(userWithoutPassword);
    }

    // For new user, return data for registration
    return res.status(200).send({
      needsAdditionalInfo: true,
      userData: {
        email: userEmail,
        name: githubUser.name || githubUser.login,
        photo: githubUser.avatar_url,
        githubId: githubUser.id.toString(),
        githubUsername: githubUser.login,
        githubToken: access_token
      }
    });
  } catch (err) {
    console.error("GitHub auth error:", err);
    return next(createError(500, "GitHub authentication failed"));
  }
};

// Complete GitHub registration with additional info
export const completeGithubRegistration = async (req, res, next) => {
  try {
    const { userData, additionalInfo } = req.body;

    if (!userData || !additionalInfo) {
      return next(createError(400, "User data and additional info are required"));
    }

    // Check for required fields
    if (!additionalInfo.username || !additionalInfo.country) {
      return next(createError(400, "Username and country are required"));
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username: additionalInfo.username });
    if (existingUser) {
      return next(createError(409, "Username already exists"));
    }

    // Create new user with combined data
    const newUser = new User({
      username: additionalInfo.username,
      email: userData.email,
      // Use a placeholder password for OAuth users
      password: Math.random().toString(36).slice(-10), 
      img: userData.photo || "",
      country: additionalInfo.country,
      isSeller: additionalInfo.isSeller || false,
      desc: additionalInfo.desc || "",
      githubId: userData.githubId,
      githubUsername: userData.githubUsername,
      githubToken: userData.githubToken,
      // OAuth users are automatically verified
      emailVerified: true
    });

    // Save the new user
    await newUser.save();

    // Create JWT token
    const token = jwt.sign(
      {
        id: newUser._id,
        isSeller: newUser.isSeller,
      },
      process.env.JWT_SECRET
    );

    // Remove sensitive data before sending
    const { password, ...userWithoutPassword } = newUser._doc;

    // Set JWT in cookie and return user data
    return res
      .cookie("accessToken", token, { httpOnly: true })
      .status(201)
      .send(userWithoutPassword);
  } catch (err) {
    console.error("GitHub registration error:", err);
    return next(createError(500, "Error completing GitHub registration"));
  }
};

// Link GitHub account to existing user
export const linkGithubAccount = async (req, res, next) => {
  try {
    console.log("GitHub account linking request received:", req.body);
    const { userId, githubUsername } = req.body;
    
    // Validate required fields
    if (!userId) {
      console.error("Missing userId in request");
      return next(createError(400, "User ID is required"));
    }
    
    if (!githubUsername) {
      console.error("Missing githubUsername in request");
      return next(createError(400, "GitHub username is required"));
    }
    
    // Check if userId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error(`Invalid userId format: ${userId}`);
      return next(createError(400, "Invalid user ID format"));
    }
    
    // Find the user
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        console.error(`User with ID ${userId} not found`);
        return next(createError(404, "User not found"));
      }
      
      console.log(`User found: ${user.username}, isSeller: ${user.isSeller}`);
      
      // Verify user is a seller/freelancer
      if (!user.isSeller) {
        console.error("User is not a seller/freelancer");
        return next(createError(403, "Only freelancer accounts can have GitHub profiles"));
      }
      
      // Update GitHub username
      console.log(`Updating GitHub username to: ${githubUsername}`);
      user.githubUsername = githubUsername;
      
      // Save user
      const savedUser = await user.save();
      console.log(`User saved with GitHub username: ${savedUser.githubUsername}`);
      
      // Return updated user
      const { password, ...userWithoutPassword } = savedUser._doc;
      return res.status(200).send(userWithoutPassword);
    } catch (dbError) {
      console.error("Database error:", dbError.message);
      return next(createError(500, `Database error: ${dbError.message}`));
    }
  } catch (err) {
    console.error("GitHub linking error:", err.message);
    return next(createError(500, `Failed to link GitHub account: ${err.message}`));
  }
};


// Unlink GitHub account from user
export const unlinkGithubAccount = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return next(createError(400, "Firebase ID token is required"));
    }
    
    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    // Find user by Firebase UID
    const user = await User.findOne({ $or: [
      { firebaseUid: uid },
      { _id: req.userId }
    ]});
    
    if (!user) {
      return next(createError(404, "User not found"));
    }
    
    // Remove GitHub info
    user.githubUsername = null;
    user.githubToken = null;
    
    await user.save();
    
    // Return updated user data
    const { password, ...userWithoutPassword } = user._doc;
    
    return res.status(200).send(userWithoutPassword);
  } catch (err) {
    console.error("GitHub unlinking error:", err);
    return next(createError(500, "Failed to unlink GitHub account"));
  }
};

// Extract GitHub username from token or profile
export const extractGithubUsername = async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return next(createError(400, "GitHub token is required"));
    }
    
    // Get user info from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${token}`
      }
    });
    
    const username = userResponse.data.login;
    
    if (!username) {
      return next(createError(404, "Could not extract GitHub username"));
    }
    
    // Log the GitHub username
    console.log("Extracted GitHub username:", username);
    
    return res.status(200).send({ username });
  } catch (err) {
    console.error("GitHub username extraction error:", err);
    return next(createError(500, "Failed to extract GitHub username"));
  }
};

// Send email verification for non-OAuth users
export const sendEmailVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next(createError(400, "Email is required"));
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return next(createError(404, "User not found"));
    }
    
    // Check if email is already verified
    if (user.emailVerified) {
      return next(createError(400, "Email is already verified"));
    }
    
    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Update user with new code
    user.verificationCode = verificationCode;
    await user.save();
    
    // In a production environment, send an email with this code
    // For now, just return the code for testing
    return res.status(200).send({
      success: true,
      message: "Verification code has been sent to your email",
      // Only include code in development environment
      ...(process.env.NODE_ENV !== 'production' && { code: verificationCode })
    });
  } catch (err) {
    console.error("Email verification error:", err);
    return next(createError(500, "Failed to send verification email"));
  }
};

// Get GitHub username for a user
export const getGithubUsername = async (req, res, next) => {
  try {
    // Find user by ID
    const user = await User.findById(req.userId);
    
    if (!user) {
      return next(createError(404, "User not found"));
    }
    
    // Check if user has GitHub username
    if (!user.githubUsername) {
      return next(createError(404, "GitHub username not found for this user"));
    }
    
    // Log the GitHub username
    console.log("GitHub username retrieved:", user.githubUsername);
    
    return res.status(200).send({ githubUsername: user.githubUsername });
  } catch (err) {
    console.error("Get GitHub username error:", err);
    return next(createError(500, "Failed to get GitHub username"));
  }
};

// Verify email with code for non-OAuth users
export const verifyEmail = async (req, res, next) => {
  try {
    const { email, verificationCode } = req.body;
    
    if (!email || !verificationCode) {
      return next(createError(400, "Email and verification code are required"));
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return next(createError(404, "User not found"));
    }
    
    // Check if verification code matches
    if (user.verificationCode !== verificationCode) {
      return next(createError(400, "Invalid verification code"));
    }
    
    // Mark email as verified
    user.emailVerified = true;
    user.verificationCode = null; // Clear the code
    await user.save();
    
    // Create JWT token
    const token = jwt.sign(
      {
        id: user._id,
        isSeller: user.isSeller,
      },
      process.env.JWT_SECRET
    );
    
    // Remove sensitive data before sending
    const { password, ...userWithoutPassword } = user._doc;
    
    // Set JWT in cookie and return user data
    return res
      .cookie("accessToken", token, { httpOnly: true })
      .status(200)
      .send(userWithoutPassword);
  } catch (err) {
    console.error("Email verification error:", err);
    return next(createError(500, "Failed to verify email"));
  }
};

// Enhanced syncGithubAccount function with explicit validation and logging
export const syncGithubAccount = async (req, res, next) => {
  try {
    console.log("GitHub sync request received:", req.body);
    const { userId, githubUsername } = req.body;
    
    if (!userId) {
      console.log("Error: Missing userId in request");
      return next(createError(400, "User ID is required"));
    }
    
    if (!githubUsername) {
      console.log("Error: Missing githubUsername in request");
      return next(createError(400, "GitHub username is required"));
    }
    
    console.log(`Finding user with ID: ${userId}`);
    
    // Find the user
    const user = await User.findById(userId);
    
    if (!user) {
      console.log(`Error: User with ID ${userId} not found`);
      return next(createError(404, "User not found"));
    }
    
    console.log(`User found: ${user.username}, isSeller: ${user.isSeller}`);
    
    // Verify user is a seller/freelancer
    if (!user.isSeller) {
      console.log("Error: User is not a seller/freelancer");
      return next(createError(403, "Only freelancer accounts can have GitHub profiles"));
    }
    
    // Update GitHub username
    console.log(`Updating GitHub username from '${user.githubUsername}' to '${githubUsername}'`);
    user.githubUsername = githubUsername;
    
    // Save user
    console.log("Saving user with updated GitHub username");
    const savedUser = await user.save();
    
    // Verify the save was successful
    if (savedUser.githubUsername !== githubUsername) {
      console.log(`Error: GitHub username not updated. Expected '${githubUsername}' but got '${savedUser.githubUsername}'`);
      return next(createError(500, "Failed to update GitHub username"));
    }
    
    console.log(`GitHub username successfully updated to: ${savedUser.githubUsername}`);
    
    // Return updated user
    const { password, ...userWithoutPassword } = savedUser._doc;
    console.log("Sending response with updated user data");
    
    return res.status(200).send(userWithoutPassword);
  } catch (err) {
    console.error("GitHub sync error:", err);
    if (err.name === 'CastError') {
      return next(createError(400, "Invalid user ID format"));
    }
    return next(createError(500, "Failed to sync GitHub account: " + err.message));
  }
};
// Add these functions to your existing firebase.controller.js
// Keep all your other functions the same

export const getGithubAuthUrl = async (req, res, next) => {
  try {
    console.log("Generating GitHub auth URL...");
    
    if (!process.env.GITHUB_CLIENT_ID) {
      console.error("Missing GITHUB_CLIENT_ID environment variable");
      return next(createError(500, "GitHub API not properly configured"));
    }
    
    if (!process.env.CLIENT_URL) {
      console.error("Missing CLIENT_URL environment variable");
      return next(createError(500, "Application URL not configured"));
    }
    
    const clientId = process.env.GITHUB_CLIENT_ID;
    
    // Generate a random state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15);
    
    // Define redirect URI
    const redirectUri = `${process.env.CLIENT_URL}/github-callback`;
    
    // Define scopes - we only need user scope
    const scopes = ['user'];
    
    // Build GitHub OAuth URL
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes.join('%20')}&state=${state}`;
    
    console.log("Redirect URI:", redirectUri);
    console.log("Generated GitHub auth URL (client_id redacted)");
    
    return res.status(200).json({ url });
  } catch (err) {
    console.error("Failed to generate GitHub auth URL:", err.message);
    return next(createError(500, `Failed to generate GitHub authentication URL: ${err.message}`));
  }
};

// In firebase.controller.js - Fix the completeGithubAuth function



export const completeGithubAuth = async (req, res, next) => {
  try {
    console.log("Processing GitHub auth callback with payload:", req.body);
    const { code, state, userId } = req.body;
    
    if (!code) {
      console.error("Missing code parameter in request");
      return next(createError(400, "Authorization code is required"));
    }
    
    // Simple in-memory cache to prevent code reuse
    if (!global.usedGithubCodes) {
      global.usedGithubCodes = new Map();
    }
    
    // Check if code was already used
    if (global.usedGithubCodes.has(code)) {
      const cachedUsername = global.usedGithubCodes.get(code);
      console.log("Using cached GitHub username:", cachedUsername);
      
      // If userId is provided, ensure the user record is updated
      let autoSaved = false;
      if (userId && cachedUsername) {
        try {
          await updateUserWithGithubUsername(userId, cachedUsername);
          autoSaved = true;
          console.log("User profile updated with cached GitHub username");
        } catch (err) {
          console.error("Error updating user with cached username:", err.message);
          // Continue anyway to return the username
        }
      }
      
      return res.status(200).json({
        githubUsername: cachedUsername,
        message: "Using cached GitHub username",
        autoSaved
      });
    }
    
    try {
      console.log("Exchanging code for GitHub access token...");
      
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
      
      if (error) {
        console.error("Failed to get access token:", error);
        return next(createError(400, error));
      }
      
      if (!access_token) {
        console.error("No access token received");
        return next(createError(400, "Failed to get access token"));
      }
      
      console.log("Token response received successfully");
      
      // Get GitHub user information
      console.log("Fetching GitHub user profile...");
      const userResponse = await axios.get("https://api.github.com/user", {
        headers: {
          Authorization: `token ${access_token}`
        }
      });
      
      // Extract GitHub username (login)
      const githubUsername = userResponse.data.login;
      
      if (!githubUsername) {
        console.error("No GitHub username in API response");
        return next(createError(400, "Could not retrieve GitHub username"));
      }
      
      console.log("GitHub username successfully retrieved:", githubUsername);
      
      // Cache the username for this code
      global.usedGithubCodes.set(code, githubUsername);
      
      // Set up cache cleanup after 15 minutes
      setTimeout(() => {
        if (global.usedGithubCodes.has(code)) {
          global.usedGithubCodes.delete(code);
        }
      }, 15 * 60 * 1000);
      
      // If userId is provided, update the user directly
      let autoSaved = false;
      if (userId) {
        try {
          const updatedUser = await updateUserWithGithubUsername(userId, githubUsername);
          autoSaved = true;
          console.log("User profile auto-updated with GitHub username");
        } catch (updateError) {
          console.error("Failed to auto-update user profile:", updateError.message);
          // Continue - we'll still return the username even if auto-save fails
        }
      }
      
      // Return GitHub username and basic profile information
      return res.status(200).json({
        githubUsername,
        name: userResponse.data.name || githubUsername,
        avatar: userResponse.data.avatar_url,
        autoSaved
      });
    } catch (apiError) {
      console.error("GitHub API error:", apiError.message);
      
      if (apiError.response) {
        console.error("Response status:", apiError.response.status);
        console.error("Response data:", JSON.stringify(apiError.response.data));
      }
      
      return next(createError(500, `GitHub API error: ${apiError.message}`));
    }
  } catch (err) {
    console.error("GitHub authentication error:", err.message);
    return next(createError(500, `GitHub authentication failed: ${err.message}`));
  }
};

async function updateUserWithGithubUsername(userId, githubUsername) {
  try {
    console.log(`Auto-updating user ${userId} with GitHub username: ${githubUsername}`);
    
    // Check if userId is valid
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID format");
    }
    
    // Find the user
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error(`User not found with ID: ${userId}`);
    }
    
    // Check if user is a seller (freelancer)
    if (!user.isSeller) {
      throw new Error("Only freelancer accounts can have GitHub profiles");
    }
    
    // Update GitHub username
    user.githubUsername = githubUsername;
    
    // Save user
    const savedUser = await user.save();
    
    // Verify save was successful
    if (savedUser.githubUsername !== githubUsername) {
      throw new Error("GitHub username update did not persist correctly");
    }
    
    console.log(`Successfully updated user ${userId} with GitHub username ${githubUsername}`);
    return savedUser;
  } catch (error) {
    console.error("Error updating user with GitHub username:", error.message);
    throw error;
  }
}

export default {
  verifyFirebaseToken,
  completeRegistration,
  githubAuth,
  completeGithubAuth,
  completeGithubRegistration,
  linkGithubAccount,
  unlinkGithubAccount,
  extractGithubUsername,
  sendEmailVerification,
  getGithubUsername,
  verifyEmail,
  syncGithubAccount
};