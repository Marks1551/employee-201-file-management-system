// Runs once when the Next.js server process starts (both `next dev` and `next start`).
// See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
//
// Used here to: (1) print which mode the app is running in, and (2) fail fast in
// production if a required secret is missing or still set to its insecure dev default,
// instead of silently running an unsafe configuration in front of real users.
export async function register() {
  // This module is bundled for the edge runtime too; only run on the actual Node server.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { APP_ENV, isProduction } = await import('@/shared/lib/env');

  const problems: string[] = [];

  if (isProduction) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-me-in-.env.local') {
      problems.push('JWT_SECRET is missing or still set to its default dev value — set a long random string.');
    }
    if (!process.env.DB_PASSWORD) {
      problems.push('DB_PASSWORD is empty — set the production database password.');
    }
    if (!process.env.APP_URL || process.env.APP_URL.includes('localhost')) {
      problems.push('APP_URL is unset or still points at localhost — set it to your real deployed URL (used in emails).');
    }
    if (!process.env.SMTP_HOST) {
      // Not fatal — the app falls back to logging emails to the console — but worth flagging
      // since that means account-setup/password-reset links never actually reach anyone.
      console.warn('[startup] SMTP_HOST is not set — outgoing emails will only be logged to the server console, not sent.');
    }
  }

  console.log(`[startup] Running in ${APP_ENV.toUpperCase()} mode.`);

  if (problems.length > 0) {
    console.error('[startup] Refusing to start in production mode with insecure/incomplete configuration:');
    for (const p of problems) console.error(`  - ${p}`);
    throw new Error('Production startup checks failed — see errors above. Fix your environment variables and restart.');
  }
}
