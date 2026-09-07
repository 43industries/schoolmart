import "dotenv/config";

export const config = {
  // Railway/Render set PORT; local/dev can use API_PORT
  port: parseInt(process.env.PORT ?? process.env.API_PORT ?? "4000", 10),
  host: process.env.API_HOST ?? "0.0.0.0",
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  cookieSecret: process.env.COOKIE_SECRET ?? "dev-cookie-secret",
  webUrl: process.env.WEB_URL ?? "http://localhost:3000",
  isDev: (process.env.NODE_ENV ?? "development") === "development",
} as const;
