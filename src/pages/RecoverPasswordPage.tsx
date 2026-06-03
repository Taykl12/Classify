import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthAvatar } from "../components/auth/AuthAvatar";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthNav } from "../components/auth/AuthNav";
import { useAuth } from "../contexts/AuthContext";
import { ApiError } from "../lib/api";
import { ROUTES } from "../routes";
import "../styles/auth.css";
import "../styles/login.css";
import "../styles/recover-password.css";

export default function RecoverPasswordPage() {
  const { recoverPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const message = await recoverPassword(email);
      setInfo(message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar el enlace");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout variant="recover" nav={<AuthNav alternateLink={{ to: ROUTES.LOGIN, label: "Iniciar Sesión" }} />}>
      <div className="container">
        <form className="login-box auth-box" onSubmit={handleSubmit}>
          <AuthAvatar size="form" icon="mail" />
          <p className="titulo">Recuperar contraseña</p>
          <p className="subtitulo">Ingresá tu correo electrónico y te enviaremos instrucciones</p>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          {info ? <p className="auth-info" role="status">{info}</p> : null}
          <input type="email" placeholder="Tu correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? "Enviando…" : "Enviar enlace"}
          </button>
          <p className="auth-form-footer">
            <Link className="auth-link" to={ROUTES.LOGIN}>Volver a iniciar sesión</Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
}
