import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const resendApiKey = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.VITE_APP_URL || "http://localhost:5174";

  if (!resendApiKey) return res.status(500).json({ error: "Email service not configured" });
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: "Supabase service role missing" });

  const { userId, name } = req.body || {};
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    // 1. Fetch user's email using Supabase Admin API
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    const { data: userAuth, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError || !userAuth?.user?.email) throw new Error("Could not find user email");
    
    const userEmail = userAuth.user.email;

    // 2. Send the approval email
    const htmlBody = `
      <h2>Account Approved! 🎉</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your Varta account has been approved by the administrator.</p>
      <p>You can now log in and start chatting!</p>
      <a href="${appUrl}/login" style="display:inline-block;background:#25D366;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Log In to Varta</a>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Varta Admin <admin@varta.app>",
        to: [userEmail],
        subject: "Your Varta Account is Approved!",
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
