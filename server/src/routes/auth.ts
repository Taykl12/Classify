import { Router } from "express";
import { buildAuthUser } from "../lib/authUser.js";
import { mapAuthError } from "../lib/authMessages.js";
import {
  createAdminClient,
  createAnonClient,
  createUserClient,
} from "../lib/supabase.js";
import { config } from "../config.js";
import {
  getUserSupabase,
  requireAuth,
  type AuthedRequest,
} from "../middleware/auth.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email y contraseña requeridos" });
      return;
    }
    const supabase = createAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      res.status(401).json({
        error: mapAuthError(error, "Email o contraseña incorrectos."),
      });
      return;
    }
    const userClient = createUserClient(data.session.access_token);
    const authUser = await buildAuthUser(userClient, data.user.id, {
      email: data.user.email,
      nombre: data.user.user_metadata?.nombre as string | undefined,
      apellido: data.user.user_metadata?.apellido as string | undefined,
    });
    res.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: authUser,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const { userId, accessToken } = req as AuthedRequest;
    const supabase = createAnonClient();
    const { data: authData } = await supabase.auth.getUser(accessToken);
    const userClient = getUserSupabase(req as AuthedRequest);
    const authUser = await buildAuthUser(userClient, userId, {
      email: authData.user?.email,
      nombre: authData.user?.user_metadata?.nombre as string | undefined,
      apellido: authData.user?.user_metadata?.apellido as string | undefined,
    });
    res.json({ user: authUser });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

router.post("/logout", async (_req, res) => {
  res.json({ ok: true });
});

router.post("/recover-password", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "Email requerido" });
      return;
    }
    const supabase = createAnonClient();
    const redirectTo = `${config.appOrigin}/restablecer-contrasena`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      res.status(400).json({ error: mapAuthError(error, "No se pudo enviar el enlace") });
      return;
    }
    res.json({ message: "Si el correo existe, enviamos instrucciones" });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

/**
 * Completa el flujo de recuperación: recibe el access token del enlace de
 * Supabase (fragmento `#access_token=...&type=recovery`) y fija la nueva
 * contraseña. Devuelve la sesión para iniciar sesión directamente.
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { accessToken, password } = req.body as {
      accessToken?: string;
      password?: string;
    };
    if (!accessToken) {
      res.status(400).json({ error: "Token de recuperación requerido" });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }

    const anon = createAnonClient();
    const { data: authData, error: tokenError } = await anon.auth.getUser(accessToken);
    if (tokenError || !authData.user) {
      res.status(401).json({ error: "El enlace es inválido o expiró" });
      return;
    }

    const userClient = createUserClient(accessToken);
    // El token ya se validó con getUser; forzamos el cambio con service role para
    // no depender del estado de sesión del cliente GoTrue.
    const admin = createAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(
      authData.user.id,
      { password }
    );
    if (updateError) {
      res.status(400).json({
        error: mapAuthError(updateError, "No se pudo actualizar la contraseña"),
      });
      return;
    }

    const authUser = await buildAuthUser(userClient, authData.user.id, {
      email: authData.user.email,
      nombre: authData.user.user_metadata?.nombre as string | undefined,
      apellido: authData.user.user_metadata?.apellido as string | undefined,
    });
    res.json({ accessToken, user: authUser });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

export default router;
