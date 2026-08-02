import { Router } from "express";
import { registerHandler,heartbeatHandler } from "../controllers/computer.controller";
import { requireAgentSecret } from "../middlware/agent.middleware";

const router = Router();

router.post("/register", requireAgentSecret, registerHandler);
router.post("/heartbeat", requireAgentSecret, heartbeatHandler);

export default router;