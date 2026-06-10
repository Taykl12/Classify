import { Router } from "express";
import { buildAuthUser } from "../lib/authUser.js";
import { createAnonClient } from "../lib/supabase.js";
import { getUserSupabase, requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

interface ProfileRow {
  nombre: string | null;
  apellido: string | null;
  dni: string | null;
  foto_perfil: string | null;
  roles: { nombre_rol: string } | { nombre_rol: string }[] | null;
}

function roleNameFromJoin(
  roles: { nombre_rol: string } | { nombre_rol: string }[] | null | undefined
): string | undefined {
  if (!roles) return undefined;
  const raw = Array.isArray(roles) ? roles[0]?.nombre_rol : roles.nombre_rol;
  if (!raw) return undefined;
  const n = raw.trim().toLowerCase();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function avatarExtension(mimeType: string): string | null {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return null;
}

async function loadProfileRow(userClient: ReturnType<typeof getUserSupabase>, userId: string) {
  const { data, error } = await userClient
    .from("usuarios")
    .select("nombre, apellido, dni, foto_perfil, roles(nombre_rol)")
    .eq("id_usuario", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ProfileRow | null;
}

function mapProfile(
  userId: string,
  email: string | undefined,
  row: ProfileRow | null
) {
  return {
    id: userId,
    email: email ?? "",
    firstName: row?.nombre ?? "",
    lastName: row?.apellido ?? "",
    dni: row?.dni ?? "",
    profilePhotoUrl: row?.foto_perfil ?? null,
    roleLabel: roleNameFromJoin(row?.roles ?? null),
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const { userId, accessToken } = req as AuthedRequest;
    const supabase = createAnonClient();
    const { data: authData } = await supabase.auth.getUser(accessToken);
    const userClient = getUserSupabase(req as AuthedRequest);
    const row = await loadProfileRow(userClient, userId);
    res.json(mapProfile(userId, authData.user?.email, row));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

router.patch("/", requireAuth, async (req, res) => {
  try {
    const { userId, accessToken } = req as AuthedRequest;
    const body = req.body as {
      firstName?: string;
      lastName?: string;
      dni?: string;
      email?: string;
      newPassword?: string;
      confirmPassword?: string;
      avatarBase64?: string;
      avatarMimeType?: string;
    };

    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim();
    const dni = body.dni?.trim();
    const email = body.email?.trim();
    const newPassword = body.newPassword ?? "";
    const confirmPassword = body.confirmPassword ?? "";

    if (!firstName || !lastName) {
      res.status(400).json({ error: "Nombre y apellido son obligatorios" });
      return;
    }

    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) {
        res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: "Las contraseñas no coinciden" });
        return;
      }
    }

    const userClient = getUserSupabase(req as AuthedRequest);
    const supabase = createAnonClient();
    const { data: authData } = await supabase.auth.getUser(accessToken);
    const currentEmail = authData.user?.email ?? "";

    const updates: Record<string, string | null> = {
      nombre: firstName,
      apellido: lastName,
    };

    if (dni !== undefined) {
      updates.dni = dni || null;
    }

    if (body.avatarBase64 && body.avatarMimeType) {
      const ext = avatarExtension(body.avatarMimeType);
      if (!ext) {
        res.status(400).json({ error: "Formato de imagen no soportado" });
        return;
      }

      const buffer = Buffer.from(body.avatarBase64, "base64");
      if (buffer.byteLength > MAX_AVATAR_BYTES) {
        res.status(400).json({ error: "La imagen no puede superar 2 MB" });
        return;
      }

      const objectPath = `${userId}/profile.${ext}`;
      const { error: uploadError } = await userClient.storage
        .from(AVATAR_BUCKET)
        .upload(objectPath, buffer, {
          upsert: true,
          contentType: body.avatarMimeType,
        });

      if (uploadError) {
        res.status(400).json({ error: uploadError.message });
        return;
      }

      const { data: publicData } = userClient.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(objectPath);

      updates.foto_perfil = publicData.publicUrl;
    }

    const { error: profileError } = await userClient
      .from("usuarios")
      .update(updates)
      .eq("id_usuario", userId);

    if (profileError) {
      res.status(400).json({ error: profileError.message });
      return;
    }

    if (email && email !== currentEmail) {
      const { error: emailError } = await userClient.auth.updateUser({ email });
      if (emailError) {
        res.status(400).json({ error: emailError.message });
        return;
      }
    }

    if (newPassword) {
      const { error: passwordError } = await userClient.auth.updateUser({
        password: newPassword,
      });
      if (passwordError) {
        res.status(400).json({ error: passwordError.message });
        return;
      }
    }

    const row = await loadProfileRow(userClient, userId);
    const { data: refreshedAuth } = await supabase.auth.getUser(accessToken);
    const profile = mapProfile(userId, refreshedAuth.user?.email ?? email ?? currentEmail, row);
    const authUser = await buildAuthUser(userClient, userId, {
      email: profile.email,
      nombre: profile.firstName,
      apellido: profile.lastName,
    });

    res.json({ profile, user: authUser });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

export default router;
