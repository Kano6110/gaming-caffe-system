import { Request, Response } from "express";
import { z } from "zod";
import { registerComputer ,heartbeatComputer,ComputerNotFoundError  } from "../services/computer.service";

const registerSchema = z.object({
  machineId: z.string().min(1),
  ipAddress: z.string().min(1), // could tighten to z.string().ip() if you want strict IPv4/IPv6 validation
  name: z.string().min(1).max(64).optional(),
});
const heartbeatSchema = z.object({
  machineId: z.string().min(1),
  ipAddress: z.string().min(1), // could tighten to z.string().ip() if you want strict IPv4/IPv6 validation
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
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try{
        const computer= await heartbeatComputer(parsed.data);
        return res.status(200).json({ computer });
    }catch(err){
       if(err instanceof ComputerNotFoundError){
        return res.status(404).json({ error: err.message });
       }
       console.error("heartbeatHandler error:", err);
       return res.status(500).json({ error: "Internal server error" });
    }
}