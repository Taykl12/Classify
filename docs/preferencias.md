# Preferencias de cuenta

Página para editar perfil del usuario autenticado. El diseño sigue los tokens de Classify; el **orden** de secciones tomó como guía `ejemplovisual/` (solo layout, no colores ni tipografía del ejemplo).

**Ruta:** `/preferencias`  
**Acceso:** botón *Preferencias* en el sidebar.

---

## Qué incluye

| Campo / acción | Origen de datos | Al guardar |
|----------------|-----------------|------------|
| Foto de perfil | `usuarios.foto_perfil` | Subida a Storage bucket `avatars` → URL en `foto_perfil` |
| Nombre | `usuarios.nombre` | `UPDATE usuarios` |
| Apellido | `usuarios.apellido` | `UPDATE usuarios` |
| DNI | `usuarios.dni` | `UPDATE usuarios` (vacío → `null`) |
| Correo | Supabase Auth | `auth.updateUser({ email })` |
| Contraseña | — (no se muestra) | `auth.updateUser({ password })` si se completan ambos campos |

Perfiles existentes (registro previo):

- Nombre y apellido cargan desde `usuarios`.
- DNI suele estar vacío (`null` → campo en blanco en el formulario).
- Correo desde la sesión de Auth.
- Foto: placeholder si `foto_perfil` es `null`.

---

## Layout de la página

Inspirado en `ejemplovisual/screen.png` y `code.html`, con estilos de Classify:

```
┌─────────────────────────────────────────────────────────┐
│  Configuración de la cuenta (título + subtítulo)        │
├──────────────┬──────────────────────────────────────────┤
│  Columna     │  Formulario                              │
│  izquierda   │                                          │
│              │  § Información personal                  │
│  [Avatar]    │    Nombre | Apellido                     │
│  Nombre      │    DNI                                   │
│  [Rol]       │                                          │
│              │  § Credenciales y acceso                 │
│              │    Correo (ancho completo)               │
│              │    Nueva contraseña | Confirmar          │
│              │                                          │
│              │         [Descartar]  [Guardar cambios]   │
└──────────────┴──────────────────────────────────────────┘
```

En móvil (`≤900px`) las columnas se apilan.

**No se copió del ejemplo:** celular, último acceso, sede, footer de copyright, paleta EduCore.

---

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/profile` | Perfil completo del usuario autenticado |
| `PATCH` | `/api/profile` | Actualiza perfil, credenciales y opcionalmente avatar |

### Body de `PATCH` (JSON)

```json
{
  "firstName": "string",
  "lastName": "string",
  "dni": "string",
  "email": "string",
  "newPassword": "string (opcional)",
  "confirmPassword": "string (opcional)",
  "avatarBase64": "string (opcional)",
  "avatarMimeType": "image/jpeg | image/png | image/webp (opcional)"
}
```

### Respuesta exitosa

```json
{
  "profile": { "id", "email", "firstName", "lastName", "dni", "profilePhotoUrl", "roleLabel" },
  "user": { "id", "email", "firstName", "lastName", "roleLabel" }
}
```

El frontend llama `refreshUser(data.user)` para actualizar sidebar y sesión local.

---

## Archivos nuevos

| Archivo | Rol |
|---------|-----|
| `src/pages/PreferencesPage.tsx` | Página principal |
| `src/styles/preferences.css` | Estilos (tokens `--color-*`, `--space-*`) |
| `src/types/profile.ts` | Tipos `UserProfile`, `ProfileFormState` |
| `server/src/routes/profile.ts` | Endpoints GET/PATCH |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/routes.ts` | `PREFERENCES: '/preferencias'` |
| `src/App.tsx` | Ruta protegida |
| `src/components/layout/Sidebar.tsx` | Link *Preferencias* → `/preferencias` |
| `src/contexts/AuthContext.tsx` | `refreshUser(nextUser)` |
| `server/src/app.ts` | `app.use("/api/profile", profileRouter)` |

---

## Migración SQL (solo fotos de perfil)

**Archivo:** `supabase/migrations/008_profile_avatars_storage.sql`

- Crea bucket público `avatars` (límite 2 MB, JPG/PNG/WebP).
- Políticas RLS: cada usuario sube/actualiza solo en `{user_id}/profile.{ext}`.

### ¿Hace falta para el resto del perfil?

**No.** Nombre, apellido, DNI, correo y contraseña funcionan **sin** esta migración.

### ¿Cómo aplicarla?

Copiar el contenido del archivo y ejecutarlo **una vez** en el SQL Editor de Supabase (o `supabase db push`). No modifica tablas existentes.

**Cuidado:** si se ejecuta dos veces, el `INSERT` del bucket no falla (`ON CONFLICT DO NOTHING`), pero los `CREATE POLICY` pueden fallar por nombres duplicados.

### Acople con la DB existente

- Usa columnas ya presentes en `usuarios`: `nombre`, `apellido`, `dni`, `foto_perfil`.
- No altera esquema de tablas.
- Compatible con perfiles creados en el registro (sin DNI ni foto).

---

## Comportamiento por campo

### Contraseña

- Campos vacíos → no se cambia la contraseña.
- Ambos campos obligatorios si se quiere cambiar; mínimo 6 caracteres; deben coincidir.
- Usa `auth.updateUser` con el JWT de la sesión activa → **debería funcionar** sin migración extra.

### Correo

- Si cambia respecto al actual → `auth.updateUser({ email })`.
- Supabase puede exigir confirmación por mail según configuración del proyecto.

### Foto

- Sin migración 008: error al subir imagen; el resto del formulario guarda bien si no se elige archivo.
- Con migración aplicada: preview local → base64 en PATCH → Storage → URL en `foto_perfil`.

---

## Iconos

`lucide-react`: `Camera`, `UserRound`, `Lock`, `Eye`, `EyeOff`, `CheckCircle` — mismo criterio que el resto de la app.

---

## Pendiente / mejoras futuras

- Mostrar foto de perfil en el avatar del sidebar.
- Validación de formato DNI.
- Mensaje explícito si falta fila en `usuarios` (usuario solo en Auth).
- Tests E2E del flujo guardar / descartar.
