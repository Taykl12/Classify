import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:5173",
};
