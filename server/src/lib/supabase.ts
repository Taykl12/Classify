import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";

export function createAnonClient(): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey);
}

export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
