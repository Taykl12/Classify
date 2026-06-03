import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthAvatar } from "../components/auth/AuthAvatar";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthNav } from "../components/auth/AuthNav";
import { useAuth } from "../contexts/AuthContext";
import { ApiError } from "../lib/api";
import { ROUTES } from "../routes";
import "../styles/auth.css";
import "../styles/register.css";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setSubmitting(true);
    try {
      const result = await register({ email, password, firstName, lastName });
      if (result.needsConfirmation) {
        setInfo("Revisá tu correo para confirmar la cuenta.");
        return;
      }
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      variant="register"
      nav={<AuthNav alternateLink={{ to: ROUTES.LOGIN, label: "Iniciar Sesión" }} />}
    >
      <div className="container">
        <form className="register-box auth-box" onSubmit={handleSubmit}>
          <AuthAvatar size="form" />
          <p className="titulo">Registrarse</p>
          <p className="subtitulo">Completa tus datos para registrarte</p>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          {info ? <p className="auth-info" role="status">{info}</p> : null}
          <div className="form-nombre-apellido">
            <input type="text" placeholder="Tu nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
            <input type="text" placeholder="Tu apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required />
          </div>
          <input type="email" placeholder="Tu correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <input type="password" placeholder="Tu contraseña" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          <input type="password" placeholder="Confirmar contraseña" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? "Creando…" : "Crear cuenta"}
          </button>
          <p className="auth-form-footer">
            ¿Ya tenes una cuenta?{" "}
            <Link className="auth-link" to={ROUTES.LOGIN}>Inicia sesión aquí</Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
}
