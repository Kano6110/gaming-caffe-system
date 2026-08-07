import { Router } from "express";
import {
  endHandler,
  activeHandler,
  historyHandler,
  myMonthlyTotalHandler,
  getByIdHandler,
  remainingHandler,
} from "../controllers/session.controller";
import { requireAuth, requireRole } from "../middlware/auth.middleware ";

const router = Router();

// NOTE ON ORDERING: Express matches routes top-to-bottom. Static segments
// like "/active" and "/history" MUST be registered before "/:id", or a
// request to /sessions/active would incorrectly match :id = "active".

router.post("/end", requireAuth, requireRole("ADMIN"), endHandler);
router.get("/active", requireAuth, requireRole("ADMIN", "STAFF"), activeHandler);
router.get("/history", requireAuth, requireRole("ADMIN", "STAFF"), historyHandler);
router.get("/me/total", requireAuth, myMonthlyTotalHandler); // any authenticated user, own data only

router.get("/:id/remaining", requireAuth, requireRole("ADMIN", "STAFF"), remainingHandler);
router.get("/:id", requireAuth, requireRole("ADMIN", "STAFF"), getByIdHandler);

export default router;