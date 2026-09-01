// Centralized app-mode config. Safe to import from BOTH server and client code.
//
// Why not just use NODE_ENV directly?
// Next.js hard-codes NODE_ENV itself (`next dev` -> development, `next build`/`next start`
// -> production) and ignores any NODE_ENV you put in .env files. That's fine for most
// hosts, but some deployment setups (custom Node servers, some shared-hosting Node.js
// panels, Docker images that reuse the same start command for staging + prod, etc.) don't
// give you an easy way to flip that. So this app defines its own explicit switch,
// NEXT_PUBLIC_APP_ENV, that you set in the environment (.env.local for local dev, your
// host's environment variables panel for deployment). It's read the same way on the
// server and in the browser, and falls back to NODE_ENV if it isn't set, so nothing
// breaks if you never touch it.
//
// To deploy in production mode: set NEXT_PUBLIC_APP_ENV=production wherever you configure
// environment variables for the deployment, then run `npm run build && npm start`.

export type AppEnv = 'development' | 'production';

function resolveAppEnv(): AppEnv {
  const raw = (process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  return raw === 'production' ? 'production' : 'development';
}

export const APP_ENV: AppEnv = resolveAppEnv();
export const isProduction = APP_ENV === 'production';
export const isDevelopment = !isProduction;
