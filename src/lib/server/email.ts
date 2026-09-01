import nodemailer, { type Transporter } from "nodemailer";

/**
 * Transactional email (plan.md §23). One thin service module: route handlers
 * call the named helpers, never nodemailer directly, so the transport can change
 * without touching callers. SMTP config comes from env
 * (SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / EMAIL_FROM); APP_ORIGIN
 * builds absolute links. Booking / payment emails
 * (sendBookingConfirmation, …) will be added here in later chunks.
 */

let cached: Transporter | null = null;

function getTransporter(): Transporter {
  if (cached) return cached;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS).");
  }
  const port = Number(SMTP_PORT) || 587;
  cached = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cached;
}

/** Canonical site origin for links in emails and redirects, no trailing slash. */
export function appOrigin(): string {
  return (process.env.APP_ORIGIN || "http://localhost:3000").replace(/\/+$/, "");
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || "Jagdamba Travellers <no-reply@jagdambatravellers.local>";
}

const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;",
  );

async function send(
  to: string,
  subject: string,
  heading: string,
  body: string,
  cta: { label: string; url: string },
): Promise<void> {
  const text = `${heading}\n\n${body}\n\n${cta.label}: ${cta.url}\n\nIf you didn't request this, you can ignore this email.`;

  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;padding:32px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e8eb">
      <tr><td style="background:#0b1220;padding:20px 28px;color:#ffffff;font-weight:700;font-size:16px;letter-spacing:.02em">Jagdamba Travellers</td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 12px;font-size:19px;color:#0b1220">${esc(heading)}</h1>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#4b5563">${esc(body)}</p>
        <a href="${cta.url}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px">${esc(cta.label)}</a>
        <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#9ca3af;word-break:break-all">Or paste this link into your browser:<br>${cta.url}</p>
        <p style="margin:18px 0 0;font-size:12px;color:#9ca3af">If you didn't request this, you can safely ignore this email.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  await getTransporter().sendMail({ from: fromAddress(), to, subject, text, html });

  if (process.env.NODE_ENV !== "production") {
    console.log(`[email] "${subject}" -> ${to}\n        ${cta.url}`);
  }
}

export async function sendVerificationEmail(
  to: string,
  name: string,
  url: string,
): Promise<void> {
  await send(
    to,
    "Verify your email — Jagdamba Travellers",
    "Confirm your email address",
    `Hi ${name || "there"}, welcome to Jagdamba Travellers. Confirm this address to activate your account. This link expires in 24 hours.`,
    { label: "Verify email address", url },
  );
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  url: string,
): Promise<void> {
  await send(
    to,
    "Reset your password — Jagdamba Travellers",
    "Reset your password",
    `Hi ${name || "there"}, we received a request to reset your Jagdamba Travellers password. This link expires in 1 hour. If it wasn't you, ignore this email and your password stays the same.`,
    { label: "Choose a new password", url },
  );
}
