import app from "../app";
import { Request, Response } from "express";
import { generateToken } from "../utils/jwt";

export const login = (req: Request, res: Response) => {
  const{userid,username,password}=req.body;
  const token=generateToken(userid);
  res.json({ token });
}