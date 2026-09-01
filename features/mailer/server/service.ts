// Server-only outgoing mail helper.
// Import this only from API routes / server code, never from client components.
import nodemailer, { type Transporter } from 'nodemailer';
import { isProduction } from '@/shared/lib/env';

let transporter: Transporter | null | undefined;

/** Lazily builds (and caches) the SMTP transporter. Returns null if SMTP
 *  isn't configured, in which case callers fall back to logging the email. */
function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Sends an email via SMTP if configured; otherwise logs it to the server
 *  console so the flow still works end-to-end in local dev. Never throws —
 *  a mail failure shouldn't break the request that triggered it. */
export async function sendMail({ to, subject, html, text }: SendMailInput): Promise<boolean> {
  const from = process.env.SMTP_FROM || 'LSSTI 201 File System <no-reply@lssti.edu.ph>';
  const t = getTransporter();
  if (!t) {
    if (isProduction) {
      // Don't dump full email bodies (which include account-setup/password-reset links) into
      // production logs. Just flag loudly that mail isn't actually being delivered.
      console.error(`[mailer] SMTP is not configured — email to ${to} ("${subject}") was NOT sent. Set SMTP_HOST/SMTP_USER/SMTP_PASSWORD.`);
    } else {
      console.log(`\n[mailer] SMTP not configured — logging email instead of sending it.\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
    }
    return false;
  }
  try {
    await t.sendMail({ from, to, subject, html, text });
    return true;
  } catch (err) {
    console.error('[mailer] Failed to send email:', err);
    return false;
  }
}

const brandHeader = `
  <div style="font-family:Georgia,'Times New Roman',serif;color:#1c2333;max-width:480px;margin:0 auto;">
    <div style="text-align:center;padding:8px 0 18px;">
      <div style="font-size:1.05rem;font-weight:700;color:#7A1F2B;">Lanao School of Science and Technology, Inc.</div>
      <div style="font-size:0.85rem;color:#6b6f7c;">Employee 201 File Management System</div>
    </div>
`;
const brandFooter = `
    <p style="font-size:0.78rem;color:#8a8f9c;margin-top:28px;">
      If you weren't expecting this email, you can safely ignore it — no changes will be made to any account.
    </p>
  </div>
`;

/** Email sent when an employee's record is added and an account is
 *  auto-created for them. `link` should already be a full, absolute URL. */
export async function sendAccountSetupEmail(params: { to: string; name: string; username: string; link: string; expiresInHours: number }): Promise<boolean> {
  const { to, name, username, link, expiresInHours } = params;
  const subject = 'Set up your Employee 201 File System account';
  const html = `${brandHeader}
    <p>Hi ${escapeHtml(name)},</p>
    <p>An Employee 201 file and account have been created for you. Use the button below to set your password and finish setting up your account.</p>
    <p style="margin:24px 0;text-align:center;">
      <a href="${link}" style="background:#1c2b4a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">Set Up My Account</a>
    </p>
    <p style="font-size:0.85rem;color:#6b6f7c;">Your username is <strong>${escapeHtml(username)}</strong>. This link expires in ${expiresInHours} hours. If it expires, you (or HR) can request a new one from the sign-in page.</p>
    <p style="font-size:0.8rem;color:#8a8f9c;word-break:break-all;">Button not working? Paste this link into your browser:<br/>${link}</p>
    ${brandFooter}`;
  const text = `Hi ${name},\n\nAn Employee 201 file and account have been created for you.\nYour username is: ${username}\n\nSet up your account (link expires in ${expiresInHours} hours):\n${link}\n\nIf you weren't expecting this, you can ignore this email.`;
  return sendMail({ to, subject, html, text });
}

/** Email sent for a self-service or admin-triggered password reset. */
export async function sendPasswordResetEmail(params: { to: string; name: string; link: string; expiresInHours: number }): Promise<boolean> {
  const { to, name, link, expiresInHours } = params;
  const subject = 'Reset your Employee 201 File System password';
  const html = `${brandHeader}
    <p>Hi ${escapeHtml(name)},</p>
    <p>We received a request to reset the password for your account. Use the button below to choose a new password.</p>
    <p style="margin:24px 0;text-align:center;">
      <a href="${link}" style="background:#1c2b4a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">Reset My Password</a>
    </p>
    <p style="font-size:0.85rem;color:#6b6f7c;">This link expires in ${expiresInHours} hours. If you didn't request this, your password hasn't been changed and you can ignore this email.</p>
    <p style="font-size:0.8rem;color:#8a8f9c;word-break:break-all;">Button not working? Paste this link into your browser:<br/>${link}</p>
    ${brandFooter}`;
  const text = `Hi ${name},\n\nWe received a request to reset your password.\n\nReset your password (link expires in ${expiresInHours} hours):\n${link}\n\nIf you didn't request this, you can ignore this email.`;
  return sendMail({ to, subject, html, text });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
