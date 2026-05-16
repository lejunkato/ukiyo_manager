import "dotenv/config";

const required = ["DATABASE_URL", "JWT_SECRET", "FRONTEND_URL", "ADMIN_EMAIL", "ADMIN_PASSWORD"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  frontendUrl: process.env.FRONTEND_URL!,
  backendUrl: process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 3001}`,
  adminEmail: process.env.ADMIN_EMAIL!.trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD!
};
