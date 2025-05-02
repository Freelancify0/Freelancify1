import express from "express";
import { 
  register, 
  login, 
  logout, 
  checkUsername, 
  getUserByEmail,
  resendVerificationCode
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/check-username/:username", checkUsername);
router.get("/email/:email", getUserByEmail);
router.post("/resend-verification", resendVerificationCode);

export default router;