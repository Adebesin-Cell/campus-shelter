import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables schema.
   * These are not exposed to the client.
   */
  server: {
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
    JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 characters"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Client-side environment variables schema.
   * Prefix with NEXT_PUBLIC_ to expose to the browser.
   */
  client: {
    // NEXT_PUBLIC_APP_URL: z.string().url(),
  },

  /**
   * Runtime environment variables.
   * Destructure from process.env to enable validation.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  },

  /**
   * Skip validation in certain environments.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Treat empty strings as undefined for optional vars.
   */
  emptyStringAsUndefined: true,
});
