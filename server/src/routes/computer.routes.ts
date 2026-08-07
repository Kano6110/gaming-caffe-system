import { Router } from "express";
import {
  registerHandler,
  heartbeatHandler,
  listHandler,
  getByIdHandler,
  updateHandler,
  deleteHandler,
} from "../controllers/computer.controller";
import { requireAgentSecret } from "../middlware/agent.middleware";
import { requireAuth, requireRole } from "../middlware/auth.middleware ";

const router = Router();

// Launcher-facing — authenticated via shared secret, no user is logged in
router.post("/register", requireAgentSecret, registerHandler);
router.post("/heartbeat", requireAgentSecret, heartbeatHandler);

// Dashboard-facing — authenticated via user JWT. STAFF can view the fleet;
// only ADMIN can rename, change mode, or decommission a computer.
router.get("/", requireAuth, requireRole("ADMIN", "STAFF"), listHandler);
router.get("/:id", requireAuth, requireRole("ADMIN", "STAFF"), getByIdHandler);
router.patch("/:id", requireAuth, requireRole("ADMIN"), updateHandler);
router.delete("/:id", requireAuth, requireRole("ADMIN"), deleteHandler);

export default router;