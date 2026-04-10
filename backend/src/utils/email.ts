import { Resend } from "resend";
import { env } from "../config/env.js";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(env.RESEND_API_KEY);
  return resend;
}

export async function sendVerificationEmail(
  toEmail: string,
  toName: string,
  token: string,
): Promise<void> {
  const client = getResend();
  if (!client) {
    // Dev fallback: log to console when Resend is not configured
    console.log(`[EMAIL] Verification link for ${toEmail}: ${env.APP_URL}/verify-email?token=${token}`);
    return;
  }

  const link = `${env.APP_URL}/verify-email?token=${token}`;

  await client.emails.send({
    from: "Restaurante <noreply@humerez.dev>",
    to: toEmail,
    subject: "Verifica tu correo electrónico",
    html: `
      <p>Hola ${toName},</p>
      <p>Gracias por registrarte. Haz clic en el enlace para verificar tu correo:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Este enlace expira en 24 horas.</p>
      <p>Si no creaste una cuenta, ignora este correo.</p>
    `,
  });
}
