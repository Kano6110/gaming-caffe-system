import { Router } from "express";
import { registerHandler, loginHandler, logoutHandler } from "../controllers/auth.controller";
import { requireAuth, requireRole } from "../middlware/auth.middleware ";

const router = Router();

// Public
router.post("/login", loginHandler);

// Admin/staff only — customers don't self-register in a gaming café model,
// staff creates their accounts at the counter
router.post("/register", requireAuth, requireRole("ADMIN","USER"), registerHandler);

// Any authenticated user can log themselves out
router.post("/logout", requireAuth, logoutHandler);

export default router;