// controllers/user.controller.js
import User from "../models/user.model.js";
import createError from "../utils/createError.js";

export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(createError(404, "User not found!"));

    if (req.userId !== user._id.toString()) {
      return next(createError(403, "You can delete only your account!"));
    }

    await User.findByIdAndDelete(req.params.id);
    res.status(200).send("User has been deleted.");
  } catch (err) {
    next(err);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(createError(404, "User not found!"));

    res.status(200).send(user);
  } catch (err) {
    next(err);
  }
};
// In user.controller.js - Add this new function

export const updateGithubUsername = async (req, res, next) => {
  try {
    const { userId, githubUsername } = req.body;
    
    console.log("Direct GitHub username update request:", { userId, githubUsername });
    
    if (!userId || !githubUsername) {
      return next(createError(400, "User ID and GitHub username are required"));
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return next(createError(404, "User not found"));
    }
    
    if (!user.isSeller) {
      return next(createError(403, "Only seller accounts can connect GitHub"));
    }
    
    // Update the GitHub username
    user.githubUsername = githubUsername;
    
    // Save the user
    await user.save();
    
    console.log("GitHub username updated successfully for user:", userId);
    
    // Return the updated user
    const { password, ...userWithoutPassword } = user._doc;
    
    res.status(200).send(userWithoutPassword);
  } catch (err) {
    console.error("GitHub username update error:", err);
    next(err);
  }
};
// In user.controller.js - Verify the allowedUpdates array includes githubUsername

export const updateUser = async (req, res, next) => {
  try {
    console.log("Update user request received:", req.params.id);
    console.log("Update user request body:", req.body);
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(createError(404, "User not found!"));
    }

    // Check if the requesting user is the owner of the account
    if (req.userId !== user._id.toString()) {
      return next(createError(403, "You can update only your account!"));
    }

    // Fields allowed to be updated
    const allowedUpdates = [
      "username",
      "email",
      "country",
      "phone",
      "desc",
      "img",
      "skills",
      "githubUsername" // Make sure this is included!
    ];

    // Filter out any fields that are not allowed
    const updates = Object.keys(req.body)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    // Don't send password in response
    const { password, ...userWithoutPassword } = updatedUser._doc;
    
    res.status(200).send(userWithoutPassword);
  } catch (err) {
    console.error("User update error:", err);
    next(err);
  }
};