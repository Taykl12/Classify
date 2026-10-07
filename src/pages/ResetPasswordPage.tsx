import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthAvatar } from "../components/auth/AuthAvatar";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthNav } from "../components/auth/AuthNav";
import { useAuth } from "../contexts/AuthContext";
import { ApiError } from "../lib/api";
import { landingRouteForRole } from "../lib/roles";
import { ROUTES } from "../routes";
import "../styles/auth.css";
import "../styles/login.css";
import "../styles/recover-password.css";

interface RecoveryParams {
  accessToken: string | null;
  type: string | null;
  error: string | null;
  errorDescription: string | null;
}

function readRecoveryParams(): RecoveryParams {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(window.location.search);
  const get = (key: string): string | null =>
    hashParams.get(key) ?? queryParams.get(key);

  return {
    accessToken: get("access_token"),
    type: get("type"),
    error: get("error") ?? get("error_code"),
    errorDescription: get("error_description"),
  };
}

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const params = useMemo(() => readRecoveryParams(), []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasToken = Boolean(params.accessToken) && params.type === "recovery";
  const linkError =
    params.error === "otp_expired"
      ? "El enlace expiró. Pedí uno nuevo."
      : params.errorDescription
        ? decodeURIComponent(params.errorDescription.replaceAll("+", " "))
        : !hasToken
          ? "El enlace es inválido o ya fue usado. Pedí un nuevo correo de recuperación."
          : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (!params.accessToken) return;
    setSubmitting(true);
    try {
      const user = await resetPassword(params.accessToken, password);
      navigate(landingRouteForRole(user.roleLabel), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar la contraseña");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      variant="recover"
      nav={<AuthNav alternateLink={{ to: ROUTES.LOGIN, label: "Iniciar Sesión" }} />}
    >
      <div className="container">
        <form className="login-box auth-box" onSubmit={handleSubmit}>
          <AuthAvatar size="form" icon="mail" />
          <p className="titulo">Nueva contraseña</p>
          <p className="subtitulo">Ingresá tu nueva contraseña para tu cuenta</p>

          {linkError ? (
            <p className="auth-error" role="alert">
              {linkError}
            </p>
          ) : null}
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          {hasToken ? (
            <>
              <input
                type="password"
                placeholder="Nueva contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <input
                type="password"
                placeholder="Repetir contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <button type="submit" className="auth-btn" disabled={submitting}>
                {submitting ? "Guardando…" : "Cambiar contraseña"}
              </button>
            </>
          ) : (
            <Link className="auth-btn" to={ROUTES.RECOVER_PASSWORD}>
              Pedir nuevo enlace
            </Link>
          )}

          <p className="auth-form-footer">
            <Link className="auth-link" to={ROUTES.LOGIN}>
              Volver a iniciar sesión
            </Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
}
