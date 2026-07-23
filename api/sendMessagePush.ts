import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createClient } from "@supabase/supabase-js";

// Initialize Firebase Admin (only once)
if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
    if (serviceAccount.project_id) {
      initializeApp({ credential: cert(serviceAccount) });
    }
  } catch (err) {
    console.error("Firebase Admin initialization failed for message push", err);
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

  const { conversationId, senderId, senderName, preview, recipientIds } = req.body || {};
  if (!conversationId || !recipientIds?.length) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase config");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const targetUserIds = recipientIds.filter((id: string) => id !== senderId);

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token")
      .in("user_id", targetUserIds);

    if (!tokens?.length) {
      return res.json({ sent: 0 });
    }

    const title = senderName ? `${senderName}` : "New message";
    const body = preview ?? "You have a new message";

    const result = await getMessaging().sendEachForMulticast({
      tokens: tokens.map((t: any) => t.token),
      notification: { title, body },
      data: {
        title,
        body,
        conversationId,
        type: "message",
        click_action: `/chat`,
        icon: `/favicon.svg`,
      },
      webpush: {
        notification: {
          title,
          body,
          icon: `/favicon.svg`,
          badge: `/favicon.svg`,
        },
        fcmOptions: {
          link: `/chat`,
        },
      },
    });

    return res.json({ sent: result.successCount, failed: result.failureCount });
  } catch (err: any) {
    console.error("sendMessagePush error:", err);
    return res.status(500).json({ error: err.message });
  }
}
