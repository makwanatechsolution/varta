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
  <title>You are invited to Varta</title>
</head>
<body style="margin:0;padding:0;background:#0b141a;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b141a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="540" cellpadding="0" cellspacing="0" style="background:#111b21;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.6);border:1px solid #202c33;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1E88C7 0%,#0f4c75 100%);padding:40px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:20px;margin-bottom:16px;box-shadow:0 8px 24px rgba(0,0,0,0.2);">
                <span style="font-size:32px;color:#ffffff;">💬</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:30px;font-weight:800;letter-spacing:-0.5px;">Varta</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;font-weight:500;">Next-Gen Realtime Voice, Video &amp; Messaging</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 10px;color:#1E88C7;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Personal Invite</p>
              <h2 style="margin:0 0 20px;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">
                ${escapeHtml(inviterName)} invited you to join Varta
              </h2>
              ${customMessage ? `
              <div style="background:#1b242a;border-left:4px solid #1E88C7;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0;color:#e9edef;font-size:14px;line-height:1.6;font-style:italic;">"${escapeHtml(customMessage)}"</p>
              </div>` : ""}
              <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 28px;">
                Join ${escapeHtml(inviterName)} on Varta to enjoy HD video calls, encrypted messaging, status stories, and real-time collaboration.
              </p>
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${joinLink}"
                   style="display:inline-block;background:#1E88C7;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:16px 36px;border-radius:14px;box-shadow:0 8px 24px rgba(30,136,199,0.35);">
                  Accept Invitation &amp; Join →
                </a>
              </div>
              <p style="margin:0;color:#64748b;font-size:12px;text-align:center;line-height:1.6;">
                Or copy this direct link into your browser:<br/>
                <a href="${joinLink}" style="color:#1E88C7;word-break:break-all;">${joinLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #202c33;padding:24px 40px;text-align:center;background:#0b141a;">
              <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
                This invitation was sent by ${escapeHtml(inviterName)} via Varta.<br/>
                If you did not request this invitation, you can safely ignore this email.
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
        subject: `${inviterName} invited you to Varta`,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Resend API error:", errText);
      return res.status(500).json({ error: "Failed to send email" });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Email send handler failed:", err);
    return res.status(500).json({ error: err.message || "Failed to send email" });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
