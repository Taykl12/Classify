import type { NextFunction, Request, Response } from "express";
import { createUserClient } from "../lib/supabase.js";
import { createAnonClient } from "../lib/supabase.js";

export interface AuthedRequest extends Request {
  accessToken: string;
  userId: string;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  const token = header.slice(7);
  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Sesión inválida" });
    return;
  }
  (req as AuthedRequest).accessToken = token;
  (req as AuthedRequest).userId = data.user.id;
  next();
}

export function getUserSupabase(req: AuthedRequest) {
  return createUserClient(req.accessToken);
}
