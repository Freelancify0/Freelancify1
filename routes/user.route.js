import express from "express";
import { deleteUser, getUser, updateUser,updateGithubUsername } from "../controllers/user.controller.js";
import { verifyToken } from "../middleware/jwt.js";

const router = express.Router();

router.delete("/:id", verifyToken, deleteUser);
router.get("/:id", getUser);
router.put("/:id", verifyToken, updateUser);
// In user.route.js - Add this route:

router.post("/github-username", updateGithubUsername);
export default router;