import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthAvatar } from "../components/auth/AuthAvatar";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthNav } from "../components/auth/AuthNav";
import { useAuth } from "../contexts/AuthContext";
import { ApiError } from "../lib/api";
import { ROUTES } from "../routes";
import "../styles/auth.css";
import "../styles/login.css";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate(ROUTES.DASHBOARD, { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout variant="login" nav={<AuthNav alternateLink={{ to: ROUTES.REGISTER, label: "Registrarse" }} />}>
      <div className="container">
        <form className="login-box auth-box" onSubmit={handleSubmit}>
          <AuthAvatar size="form" />
          <p className="titulo">Iniciar Sesión</p>
          <p className="subtitulo">Ingrese sus Datos</p>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <input type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          <Link className="auth-link" to={ROUTES.RECOVER_PASSWORD}>Olvidé mi contraseña</Link>
          <button type="submit" className="auth-btn" disabled={submitting}>{submitting ? "Ingresando…" : "Iniciar Sesion"}</button>
          <p className="auth-form-footer">
            ¿No tienes una cuenta? <Link className="auth-link" to={ROUTES.REGISTER}>Regístrate aquí</Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
}
