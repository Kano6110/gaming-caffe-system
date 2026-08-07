import { Request, Response } from "express";
import { z } from "zod";
import {
  registerComputer,
  heartbeatComputer,
  listComputers,
  getComputerById,
  updateComputer,
  deleteComputer,
  ComputerNotFoundError,
} from "../services/computer.service";

// Some Express/@types/express setups type route params as `string | string[]`
// (params can technically repeat depending on route pattern). Normalize once
// here rather than fighting the type at every call site.
function getIdParam(req: Request): string {
  const { id } = req.params;
  return Array.isArray(id) ? id[0] : id;
}

const registerSchema = z.object({
  machineId: z.string().min(1),
  ipAddress: z.string().min(1), // could tighten to z.string().ip() if you want strict IPv4/IPv6 validation
  name: z.string().min(1).max(64).optional(),
});

const heartbeatSchema = z.object({
  machineId: z.string().min(1),
  ipAddress: z.string().min(1),
});

// At least one field required — an empty PATCH body is a no-op the client
// almost certainly didn't intend, better to reject it than silently succeed.
const updateSchema = z
  .object({
    name: z.string().min(1).max(64).optional(),
    mode: z.enum(["AVAILABLE", "MAINTENANCE", "DISABLED"]).optional(),
  })
  .refine((data) => data.name !== undefined || data.mode !== undefined, {
    message: "Provide at least one of: name, mode",
  });

export async function registerHandler(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const computer = await registerComputer(parsed.data);
    return res.status(200).json({ computer });
  } catch (err) {
    console.error("registerHandler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function heartbeatHandler(req: Request, res: Response) {
  const parsed = heartbeatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const computer = await heartbeatComputer(parsed.data);
    return res.status(200).json({ computer });
  } catch (err) {
    if (err instanceof ComputerNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    console.error("heartbeatHandler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function listHandler(_req: Request, res: Response) {
  try {
    const computers = await listComputers();
    return res.status(200).json({ computers });
  } catch (err) {
    console.error("listHandler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getByIdHandler(req: Request, res: Response) {
  try {
    const computer = await getComputerById(getIdParam(req));
    if (!computer) {
      return res.status(404).json({ error: "Computer not found" });
    }
    return res.status(200).json({ computer });
  } catch (err) {
    console.error("getByIdHandler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateHandler(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const computer = await updateComputer(getIdParam(req), parsed.data);
    return res.status(200).json({ computer });
  } catch (err) {
    if (err instanceof ComputerNotFoundError) {
      return res.status(404).json({ error: "Computer not found" });
    }
    console.error("updateHandler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteHandler(req: Request, res: Response) {
  try {
    await deleteComputer(getIdParam(req));
    return res.status(204).send();
  } catch (err) {
    if (err instanceof ComputerNotFoundError) {
      return res.status(404).json({ error: "Computer not found" });
    }
    console.error("deleteHandler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}