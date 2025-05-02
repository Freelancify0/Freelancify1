import User from "../models/user.model.js";
import createError from "../utils/createError.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const register = async (req, res, next) => {
  try {
    // Validate the request
    if (!req.body.username || !req.body.email || !req.body.password || !req.body.country) {
      return next(createError(400, "All required fields must be provided"));
    }

    // Check if username or email already exists
    const existingUser = await User.findOne({
      $or: [
        { username: req.body.username },
        { email: req.body.email }
      ]
    });

    if (existingUser) {
      if (existingUser.username === req.body.username) {
        return next(createError(409, "Username already exists"));
      }
      if (existingUser.email === req.body.email) {
        return next(createError(409, "Email already exists"));
      }
    }

    // Hash the password
    const hash = bcrypt.hashSync(req.body.password, 5);
    
    // Create new user (without verification code)
    const newUser = new User({
      ...req.body,
      password: hash,
      emailVerified: true // Set to true by default
    });

    await newUser.save();
    
    res.status(201).send({
      message: "User has been created successfully.",
      success: true
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.body.username });

    if (!user) return next(createError(404, "User not found!"));

    const isCorrect = bcrypt.compareSync(req.body.password, user.password);
    if (!isCorrect)
      return next(createError(400, "Wrong password or username!"));
    
    // Email verification check removed

    const token = jwt.sign(
      {
        id: user._id,
        isSeller: user.isSeller,
      },
      process.env.JWT_SECRET
    );

    const { password, verificationCode, ...info } = user._doc;
    res
      .cookie("accessToken", token, {
        httpOnly: true,
      })
      .status(200)
      .send(info);
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res) => {
  res
    .clearCookie("accessToken", {
      httpOnly: true,
    })
    .status(200)
    .send("User has been logged out.");
};

// Check if a username is available (for use during registration)
export const checkUsername = async (req, res, next) => {
  try {
    const { username } = req.params;
    
    if (!username || username.length < 3) {
      return res.status(400).send("Username must be at least 3 characters");
    }
    
    const existingUser = await User.findOne({ username });
    
    if (existingUser) {
      return res.status(409).send("Username already taken");
    }
    
    res.status(200).send({ available: true });
  } catch (err) {
    next(err);
  }
};

// Get user by email (for verification flow)
export const getUserByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return next(createError(400, "Email is required"));
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return next(createError(404, "User not found"));
    }
    
    // Only return minimal information for security
    res.status(200).send({
      email: user.email,
      username: user.username,
      emailVerified: true // Always return as verified
    });
  } catch (err) {
    next(err);
  }
};

// Email verification endpoints are kept but simplified
export const resendVerificationCode = async (req, res, next) => {
  try {
    // This is no longer needed but kept for API compatibility
    res.status(200).send({
      success: true,
      message: "User is already verified."
    });
  } catch (err) {
    next(err);
  }
};