export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.VITE_APP_URL || "https://varta.app";

  if (!resendApiKey) {
    return res.status(500).json({ error: "Email service not configured" });
  }

  const { inviteCode, inviterName, toEmail, customMessage } = req.body || {};
  if (!inviteCode || !toEmail || !inviterName) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const joinLink = `${appUrl}/join?token=${inviteCode}`;

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to Varta</title>
</head>
<body style="margin:0;padding:0;background:#0b141a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b141a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#111b21;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a3c2e 0%,#0d2318 100%);padding:36px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:60px;height:60px;background:rgba(37,211,102,0.15);border-radius:16px;margin-bottom:16px;">
                <span style="font-size:28px;">💬</span>
              </div>
              <h1 style="margin:0;color:#25D366;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Varta</h1>
              <p style="margin:8px 0 0;color:#8aad99;font-size:13px;">WhatsApp · Telegram · Instagram — unified</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;color:#8696a0;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Personal invite</p>
              <h2 style="margin:0 0 20px;color:#e9edef;font-size:22px;font-weight:600;">
                ${escapeHtml(inviterName)} invited you to join Varta
              </h2>
              ${customMessage ? `
              <div style="background:#1a2a35;border-left:3px solid #25D366;border-radius:4px;padding:14px 16px;margin-bottom:24px;">
                <p style="margin:0;color:#d1d7db;font-size:15px;line-height:1.5;font-style:italic;">"${escapeHtml(customMessage)}"</p>
              </div>` : ""}
              <p style="color:#8696a0;font-size:15px;line-height:1.6;margin:0 0 28px;">
                Varta brings together the best of messaging — voice &amp; video calls like WhatsApp, groups &amp; channels like Telegram, and stories like Instagram — all in one beautiful, privacy-first app.
              </p>
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${joinLink}"
                   style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 40px;border-radius:12px;letter-spacing:0.2px;">
                  Accept Invite &amp; Join →
                </a>
              </div>
              <p style="margin:0;color:#4a5568;font-size:12px;text-align:center;line-height:1.6;">
                Or copy this link:<br/>
                <a href="${joinLink}" style="color:#25D366;word-break:break-all;">${joinLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #2a3942;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#4a5568;font-size:12px;">
                This invite was sent by ${escapeHtml(inviterName)} via Varta.<br/>
                If you didn't expect this, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Varta <invite@varta.app>",
        to: [toEmail],
        subject: `${inviterName} invited you to join Varta 💬`,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `Resend error: ${err}` });
    }

    const data = await response.json();
    return res.json({ ok: true, id: data.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

function escapeHtml(str: any) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
