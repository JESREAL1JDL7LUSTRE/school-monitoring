import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import { supabaseTiming } from "./timing";
import type { Database } from "@/types/database";

export const createSchoolClient = async () => {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Configure the Supabase URL and publishable key in .env.local.");

  const cookieStore = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    global: { fetch: supabaseTiming("server") },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components read cookies. The proxy persists refreshed cookies.
        }
      },
    },
  });
};
