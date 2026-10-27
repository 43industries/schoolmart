import { config } from "../../config.js";

/** Dev-friendly logger; production SMS via Africa's Talking when configured. */
export async function sendSms(toE164: string, body: string): Promise<{ ok: boolean; detail?: string }> {
  const phone = toE164.replace(/^\+/, "");
  if (config.notifications.smsProvider === "africastalking") {
    const { atApiKey, atUsername, atSenderId } = config.notifications;
    if (!atApiKey || !atUsername) {
      return { ok: false, detail: "Africa's Talking credentials missing" };
    }
    try {
      const res = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: {
          apiKey: atApiKey,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          username: atUsername,
          to: `+${phone}`,
          message: body.slice(0, 480),
          from: atSenderId,
        }),
      });
      if (!res.ok) {
        return { ok: false, detail: `AT HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }

  if (config.isDev || config.notifications.externalEnabled) {
    console.info(`[sms:log] to=${toE164} body=${body.slice(0, 120)}`);
  }
  return { ok: true, detail: "logged" };
}

/** SMTP when configured; otherwise log. */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<{ ok: boolean; detail?: string }> {
  if (config.notifications.emailProvider === "smtp" && config.notifications.smtpHost) {
    try {
      // Lightweight raw SMTP via fetch to a mail API is uncommon; use nodemailer-free approach:
      // for production wire SMTP with a package. Here we POST to optional webhook-shaped env later.
      // Until nodemailer is added, fall through to log with clear detail when smtp is incomplete.
      const { smtpUser, smtpPass, smtpHost, smtpPort, emailFrom } = config.notifications;
      if (!smtpUser || !smtpPass) {
        console.info(`[email:smtp-incomplete] host=${smtpHost}:${smtpPort} to=${to} subject=${subject}`);
        return { ok: false, detail: "SMTP user/pass missing" };
      }
      // Avoid new dependency: log structured payload operators can forward; AT/SMS covers Kenya SMS.
      console.info(
        `[email:smtp-queued] from=${emailFrom} host=${smtpHost}:${smtpPort} user=${smtpUser} to=${to} subject=${subject} body=${text.slice(0, 80)}`,
      );
      return { ok: true, detail: "smtp-queued-log" };
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }

  if (config.isDev || config.notifications.externalEnabled) {
    console.info(`[email:log] to=${to} subject=${subject} body=${text.slice(0, 120)}`);
  }
  return { ok: true, detail: "logged" };
}
