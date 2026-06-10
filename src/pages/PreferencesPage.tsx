import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, CheckCircle, Eye, EyeOff, Lock, UserRound } from "lucide-react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { ApiError, apiFetch, apiFetchWithRetry, isUnauthorizedError } from "../lib/api";
import type { ProfileFormState, UserProfile } from "../types/profile";
import { profileToForm } from "../types/profile";
import "../styles/dashboard.css";
import "../styles/preferences.css";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

interface PendingAvatar {
  previewUrl: string;
  base64: string;
  mimeType: string;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("No se pudo leer la imagen"));
        return;
      }
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Imagen inválida"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

export default function PreferencesPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loadProfile = useCallback(async () => {
    const data = await apiFetchWithRetry<UserProfile>("/api/profile");
    setProfile(data);
    setForm(profileToForm(data));
    setPendingAvatar(null);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        await loadProfile();
      } catch (e) {
        if (!cancelled && !isUnauthorizedError(e)) {
          setError(e instanceof Error ? e.message : "No se pudo cargar el perfil");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, loadProfile]);

  useEffect(() => {
    return () => {
      if (pendingAvatar?.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pendingAvatar.previewUrl);
      }
    };
  }, [pendingAvatar]);

  function updateField<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSuccess(null);
  }

  function handleDiscard() {
    if (!profile) return;
    if (pendingAvatar?.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(pendingAvatar.previewUrl);
    }
    setForm(profileToForm(profile));
    setPendingAvatar(null);
    setError(null);
    setSuccess(null);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }

  async function handleAvatarChange(file: File | undefined) {
    if (!file) return;
    setError(null);
    setSuccess(null);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("Usá una imagen JPG, PNG o WebP");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("La imagen no puede superar 2 MB");
      return;
    }

    try {
      const base64 = await readFileAsBase64(file);
      if (pendingAvatar?.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pendingAvatar.previewUrl);
      }
      setPendingAvatar({
        previewUrl: URL.createObjectURL(file),
        base64,
        mimeType: file.type,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la imagen");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;

    setError(null);
    setSuccess(null);

    if (form.newPassword || form.confirmPassword) {
      if (form.newPassword !== form.confirmPassword) {
        setError("Las contraseñas no coinciden");
        return;
      }
      if (form.newPassword.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres");
        return;
      }
    }

    setSubmitting(true);
    try {
      const data = await apiFetch<{
        profile: UserProfile;
        user: {
          id: string;
          email?: string;
          firstName?: string;
          lastName?: string;
          roleLabel?: string;
          profilePhotoUrl?: string | null;
        };
      }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          dni: form.dni,
          email: form.email,
          newPassword: form.newPassword || undefined,
          confirmPassword: form.confirmPassword || undefined,
          avatarBase64: pendingAvatar?.base64,
          avatarMimeType: pendingAvatar?.mimeType,
        }),
      });

      if (pendingAvatar?.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pendingAvatar.previewUrl);
      }

      setProfile(data.profile);
      setForm(profileToForm(data.profile));
      setPendingAvatar(null);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      refreshUser(data.user);
      setSuccess("Cambios guardados correctamente");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron guardar los cambios");
    } finally {
      setSubmitting(false);
    }
  }

  const displayName = form
    ? [form.firstName, form.lastName].filter(Boolean).join(" ") || "Usuario"
    : "Usuario";
  const avatarSrc = pendingAvatar?.previewUrl ?? profile?.profilePhotoUrl ?? null;
  const roleLabel = profile?.roleLabel ?? user?.roleLabel;

  return (
    <DashboardLayout>
      <section className="preferences-page dashboard-panel">
        <header className="preferences-page__header dashboard-panel__header">
          <h1 className="dashboard-panel__title">Configuración de la cuenta</h1>
          <p className="dashboard-panel__subtitle">
            Actualizá tu información personal y gestioná tus credenciales de acceso.
          </p>
        </header>

        {loading ? (
          <p className="dashboard-panel__empty">Cargando perfil…</p>
        ) : !form || !profile ? (
          <p className="dashboard-panel__empty" role="alert">
            {error ?? "No se pudo cargar el perfil"}
          </p>
        ) : (
          <div className="preferences-page__layout">
            <aside className="preferences-page__aside">
              <div className="preferences-card preferences-card--profile">
                <div className="preferences-avatar">
                  <div className="preferences-avatar__image-wrap">
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt=""
                        className="preferences-avatar__image"
                      />
                    ) : (
                      <div className="preferences-avatar__placeholder" aria-hidden>
                        <UserRound size={48} />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="preferences-avatar__camera-btn"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Cambiar foto de perfil"
                  >
                    <Camera size={18} aria-hidden />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(",")}
                    className="sr-only"
                    onChange={(e) => {
                      void handleAvatarChange(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
                <h2 className="preferences-card__name">{displayName}</h2>
                {roleLabel ? (
                  <span className="preferences-card__badge">{roleLabel}</span>
                ) : null}
              </div>
            </aside>

            <form className="preferences-page__form" onSubmit={handleSubmit}>
              {error ? (
                <p className="preferences-page__message preferences-page__message--error" role="alert">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="preferences-page__message preferences-page__message--success" role="status">
                  {success}
                </p>
              ) : null}

              <section className="preferences-section">
                <div className="preferences-section__heading">
                  <UserRound size={20} aria-hidden />
                  <h3 className="preferences-section__title">Información personal</h3>
                </div>
                <div className="preferences-section__grid">
                  <label className="preferences-field">
                    <span className="preferences-field__label">Nombre</span>
                    <input
                      className="preferences-field__input"
                      type="text"
                      value={form.firstName}
                      onChange={(e) => updateField("firstName", e.target.value)}
                      autoComplete="given-name"
                      required
                    />
                  </label>
                  <label className="preferences-field">
                    <span className="preferences-field__label">Apellido</span>
                    <input
                      className="preferences-field__input"
                      type="text"
                      value={form.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                      autoComplete="family-name"
                      required
                    />
                  </label>
                  <label className="preferences-field">
                    <span className="preferences-field__label">DNI</span>
                    <input
                      className="preferences-field__input"
                      type="text"
                      value={form.dni}
                      onChange={(e) => updateField("dni", e.target.value)}
                      autoComplete="off"
                      inputMode="numeric"
                    />
                  </label>
                </div>
              </section>

              <section className="preferences-section">
                <div className="preferences-section__heading">
                  <Lock size={20} aria-hidden />
                  <h3 className="preferences-section__title">Credenciales y acceso</h3>
                </div>
                <div className="preferences-section__stack">
                  <label className="preferences-field">
                    <span className="preferences-field__label">Correo electrónico</span>
                    <input
                      className="preferences-field__input"
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </label>
                  <div className="preferences-section__grid">
                    <label className="preferences-field">
                      <span className="preferences-field__label">Nueva contraseña</span>
                      <div className="preferences-field__password-wrap">
                        <input
                          className="preferences-field__input"
                          type={showNewPassword ? "text" : "password"}
                          value={form.newPassword}
                          onChange={(e) => updateField("newPassword", e.target.value)}
                          autoComplete="new-password"
                          placeholder="Dejar vacío para no cambiar"
                        />
                        <button
                          type="button"
                          className="preferences-field__toggle-password"
                          onClick={() => setShowNewPassword((v) => !v)}
                          aria-label={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </label>
                    <label className="preferences-field">
                      <span className="preferences-field__label">Confirmar contraseña</span>
                      <div className="preferences-field__password-wrap">
                        <input
                          className="preferences-field__input"
                          type={showConfirmPassword ? "text" : "password"}
                          value={form.confirmPassword}
                          onChange={(e) => updateField("confirmPassword", e.target.value)}
                          autoComplete="new-password"
                          placeholder="Repetir nueva contraseña"
                        />
                        <button
                          type="button"
                          className="preferences-field__toggle-password"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </label>
                  </div>
                </div>
              </section>

              <footer className="preferences-page__actions">
                <button
                  type="button"
                  className="preferences-btn preferences-btn--muted"
                  onClick={handleDiscard}
                  disabled={submitting}
                >
                  Descartar cambios
                </button>
                <button
                  type="submit"
                  className="preferences-btn preferences-btn--primary"
                  disabled={submitting}
                >
                  {submitting ? "Guardando…" : "Guardar cambios"}
                  {!submitting ? <CheckCircle size={18} aria-hidden /> : null}
                </button>
              </footer>
            </form>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}
