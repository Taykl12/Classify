import type { NextFunction, Request, Response } from "express";
import { userIsAdmin } from "../lib/roles.js";
import { createAdminClient } from "../lib/supabase.js";
import type { AuthedRequest } from "./auth.js";

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req as AuthedRequest;
    if (!userId) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }
    const isAdmin = await userIsAdmin(createAdminClient(), userId);
    if (!isAdmin) {
      res.status(403).json({ error: "Solo administradores" });
      return;
    }
    next();
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
}
