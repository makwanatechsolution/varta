export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const resendApiKey = process.env.RESEND_API_KEY;
  const adminEmail = "yash.makwana.b@gmail.com";
  const appUrl = process.env.VITE_APP_URL || "http://localhost:5174";

  if (!resendApiKey) return res.status(500).json({ error: "Email service not configured" });

  const { userName } = req.body || {};

  const htmlBody = `
    <h2>New User Registration</h2>
    <p><strong>${userName}</strong> has just signed up for Varta.</p>
    <p>Their account requires your approval before they can log in.</p>
    <a href="${appUrl}/admin" style="display:inline-block;background:#1E88C7;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;">Go to Admin Dashboard</a>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Varta Admin <admin@varta.app>",
        to: [adminEmail],
        subject: `Approval Required: New user ${userName}`,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `Resend error: ${err}` });
    }
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
