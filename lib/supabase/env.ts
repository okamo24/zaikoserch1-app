const PUBLIC_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
} as const;

const SERVER_ENV = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
} as const;

type PublicEnvKey = keyof typeof PUBLIC_ENV;
type ServerEnvKey = keyof typeof SERVER_ENV;

function readPublicEnv(key: PublicEnvKey): string | undefined {
  const value = PUBLIC_ENV[key];
  return value && value.length > 0 ? value : undefined;
}

function readServerEnv(key: ServerEnvKey): string | undefined {
  const value = SERVER_ENV[key];
  return value && value.length > 0 ? value : undefined;
}

function requirePublicEnv(key: PublicEnvKey): string {
  const value = readPublicEnv(key);

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
}

function requireServerEnv(key: ServerEnvKey): string {
  const value = readServerEnv(key);

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
}

export function hasSupabaseEnv(): boolean {
  return Object.keys(PUBLIC_ENV).every((key) =>
    Boolean(readPublicEnv(key as PublicEnvKey)),
  );
}

export function missingSupabaseEnv(): PublicEnvKey[] {
  return (Object.keys(PUBLIC_ENV) as PublicEnvKey[]).filter(
    (key) => !readPublicEnv(key),
  );
}

export function hasSupabaseServerEnv(): boolean {
  return hasSupabaseEnv() && Boolean(readServerEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export function getSupabaseUrl(): string {
  return requirePublicEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublishableKey(): string {
  return requirePublicEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

export function getSupabaseServiceRoleKey(): string {
  return requireServerEnv("SUPABASE_SERVICE_ROLE_KEY");
}
