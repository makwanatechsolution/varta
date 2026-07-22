import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createClient } from "@supabase/supabase-js";

// Initialize Firebase Admin (only once)
if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  } catch (err) {
    console.error("Firebase Admin initialization failed", err);
  }
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const { conversationId, senderId, preview, recipientIds } = req.body || {};
  if (!conversationId || !recipientIds?.length) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase config");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token")
      .in("user_id", recipientIds.filter((id: string) => id !== senderId));

    if (!tokens?.length) {
      return res.json({ sent: 0 });
    }

    const result = await getMessaging().sendEachForMulticast({
      tokens: tokens.map((t: any) => t.token),
      notification: { title: "New message", body: preview ?? "You have a new message" },
      data: { conversationId, type: "message" },
    });

    return res.json({ sent: result.successCount, failed: result.failureCount });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
