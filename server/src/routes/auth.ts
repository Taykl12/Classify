import { Router } from "express";
import { createAnonClient, createUserClient } from "../lib/supabase.js";
import { config } from "../config.js";

const router = Router();

async function getProfesorRoleId(): Promise<number> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id_rol")
    .eq("nombre_rol", "profesor")
    .single();
  if (error || !data) throw new Error("Rol profesor no configurado");
  return data.id_rol as number;
}

router.post("/register", async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body as {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
    };
    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: "Datos incompletos" });
      return;
    }
    const supabase = createAnonClient();
    const { data: signUp, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre: firstName, apellido: lastName } },
    });
    if (signUpError) {
      res.status(400).json({ error: signUpError.message });
      return;
    }
    const user = signUp.user;
    const session = signUp.session;
    if (!user) {
      res.status(400).json({ error: "No se pudo crear el usuario" });
      return;
    }
    const idRol = await getProfesorRoleId();
    if (!session?.access_token) {
      res.json({
        message: "Revisá tu correo para confirmar la cuenta",
        user: { id: user.id, email },
      });
      return;
    }
    const userClient = createUserClient(session.access_token);
    const { error: profileError } = await userClient.from("usuarios").insert({
      id_usuario: user.id,
      nombre: firstName,
      apellido: lastName,
      id_rol: idRol,
    });
    if (profileError) {
      res.status(400).json({ error: profileError.message });
      return;
    }
    res.json({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user: { id: user.id, email, firstName, lastName },
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

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
      res.status(401).json({ error: error?.message ?? "Credenciales inválidas" });
      return;
    }
    const userClient = createUserClient(data.session.access_token);
    const { data: perfil } = await userClient
      .from("usuarios")
      .select("nombre, apellido")
      .eq("id_usuario", data.user.id)
      .maybeSingle();
    res.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        firstName: perfil?.nombre ?? (data.user.user_metadata?.nombre as string | undefined),
        lastName: perfil?.apellido ?? (data.user.user_metadata?.apellido as string | undefined),
      },
    });
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
    const redirectTo = `${config.appOrigin}/login`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ message: "Si el correo existe, enviamos instrucciones" });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

export default router;
