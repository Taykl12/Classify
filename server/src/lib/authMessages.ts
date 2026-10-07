/**
 * Traduce los mensajes de error de Supabase Auth (GoTrue) al español y los
 * vuelve más accionables para el usuario. Se mapea primero por `code` y, si no
 * está disponible, por patrones del mensaje en inglés.
 */

interface AuthErrorLike {
  message?: string;
  code?: string;
  status?: number;
  error_description?: string;
}

const CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  email_not_confirmed:
    "Tu correo todavía no está confirmado. Revisá tu bandeja de entrada.",
  email_exists: "Ya existe una cuenta registrada con ese correo.",
  user_already_exists: "Ya existe una cuenta registrada con ese correo.",
  weak_password: "La contraseña es demasiado débil (mínimo 6 caracteres).",
  same_password: "La nueva contraseña debe ser distinta a la actual.",
  over_email_send_rate_limit:
    "Demasiados intentos. Esperá unos minutos antes de pedir otro enlace.",
  over_request_rate_limit: "Demasiadas solicitudes. Esperá unos minutos e intentá de nuevo.",
  over_sms_send_rate_limit: "Demasiados intentos por SMS. Esperá unos minutos.",
  signup_disabled: "El registro de nuevas cuentas está deshabilitado.",
  email_provider_disabled: "El registro con email está deshabilitado.",
  phone_provider_disabled: "El registro con teléfono está deshabilitado.",
  email_address_invalid: "El correo ingresado no es válido.",
  email_address_not_authorized: "Ese correo no está autorizado para registrarse.",
  otp_expired: "El enlace expiró. Pedí uno nuevo.",
  user_not_found: "No encontramos una cuenta con esos datos.",
  session_not_found: "La sesión expiró. Volvé a iniciar sesión.",
  refresh_token_not_found: "La sesión expiró. Volvé a iniciar sesión.",
  reauthentication_needed: "Por seguridad, volvé a iniciar sesión para continuar.",
  provider_disabled: "Ese método de inicio de sesión no está habilitado.",
  bad_jwt: "La sesión es inválida o expiró. Volvé a iniciar sesión.",
  no_authorization: "No autorizado.",
  captcha_failed: "No se pudo validar el captcha. Intentá de nuevo.",
  validation_failed: "Los datos enviados no son válidos.",
};

const MESSAGE_PATTERNS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Email o contraseña incorrectos."],
  [/email not confirmed/i, "Tu correo todavía no está confirmado. Revisá tu bandeja de entrada."],
  [/already registered|already been registered|user already registered/i, "Ya existe una cuenta registrada con ese correo."],
  [/password should be at least|password is too short/i, "La contraseña es demasiado débil (mínimo 6 caracteres)."],
  [/new password should be different|should be different from the old password/i, "La nueva contraseña debe ser distinta a la actual."],
  [/for security purposes, you can only request this after/i, "Demasiados intentos. Esperá unos minutos antes de pedir otro enlace."],
  [/rate limit|too many requests/i, "Demasiadas solicitudes. Esperá unos minutos e intentá de nuevo."],
  [/unable to validate email address|invalid email/i, "El correo ingresado no es válido."],
  [/email address not authorized/i, "Ese correo no está autorizado para registrarse."],
  [/token has expired|link is invalid or has expired|has expired|otp.*expired/i, "El enlace expiró o ya fue usado. Pedí uno nuevo."],
  [/user not found/i, "No encontramos una cuenta con esos datos."],
  [/signups not allowed|signup.*disabled|signups.*disabled/i, "El registro de nuevas cuentas está deshabilitado."],
  [/auth session missing/i, "La sesión expiró. Volvé a iniciar sesión."],
  [/invalid claim|invalid jwt|jwt expired/i, "La sesión es inválida o expiró. Volvé a iniciar sesión."],
  [/captcha/i, "No se pudo validar el captcha. Intentá de nuevo."],
  [/database error/i, "Ocurrió un error en el servidor. Intentá de nuevo más tarde."],
];

function extract(error: unknown): AuthErrorLike {
  if (!error) return {};
  if (typeof error === "string") return { message: error };
  if (typeof error === "object") {
    const value = error as AuthErrorLike;
    return {
      message: value.message ?? value.error_description,
      code: value.code,
      status: value.status,
    };
  }
  return {};
}

export function mapAuthError(error: unknown, fallback: string): string {
  const { message, code } = extract(error);

  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code];
  }

  if (message) {
    for (const [pattern, translated] of MESSAGE_PATTERNS) {
      if (pattern.test(message)) return translated;
    }
  }

  return fallback;
}
