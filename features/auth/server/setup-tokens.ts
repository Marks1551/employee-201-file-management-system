// Server-only helpers for one-time account-setup / password-reset links.
// The raw token is only ever emailed to the user — only its SHA-256 hash is
// persisted, so a leaked database can't be used to take over accounts.
import { randomUUID, randomBytes, createHash } from 'crypto';
import { query, execute } from '@/shared/server/db';

export type TokenPurpose = 'setup' | 'reset';

interface TokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  purpose: TokenPurpose;
  expires_at: string;
  used_at: string | null;
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Creates a new setup/reset token for a user and returns the RAW token
 *  (put this in the emailed link — never store it). Any previous unused
 *  tokens of the same purpose for this user are invalidated first, so only
 *  the most recently emailed link works. */
export async function createSetupToken(userId: string, purpose: TokenPurpose, ttlHours: number): Promise<string> {
  await execute('DELETE FROM account_setup_tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL', [userId, purpose]);
  const rawToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  await execute(
    'INSERT INTO account_setup_tokens (id, user_id, token_hash, purpose, expires_at) VALUES (?,?,?,?,?)',
    [`tok-${randomUUID()}`, userId, hashToken(rawToken), purpose, expiresAt]
  );
  return rawToken;
}

/** Looks up a token without consuming it — used to validate a link and show
 *  a friendly error before the person has typed anything. */
export async function peekSetupToken(rawToken: string): Promise<{ userId: string; purpose: TokenPurpose } | null> {
  if (!rawToken) return null;
  const rows = await query<TokenRow>('SELECT * FROM account_setup_tokens WHERE token_hash = ?', [hashToken(rawToken)]);
  const row = rows[0];
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) return null;
  return { userId: row.user_id, purpose: row.purpose };
}

/** Validates and marks a token used in one step. Returns the associated user
 *  id, or null if the token is missing/expired/already used. */
export async function consumeSetupToken(rawToken: string): Promise<{ userId: string; purpose: TokenPurpose } | null> {
  const found = await peekSetupToken(rawToken);
  if (!found) return null;
  await execute('UPDATE account_setup_tokens SET used_at = NOW() WHERE token_hash = ?', [hashToken(rawToken)]);
  return found;
}
