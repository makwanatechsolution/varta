import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createClient } from "@supabase/supabase-js";

if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
    if (serviceAccount.project_id) {
      initializeApp({ credential: cert(serviceAccount) });
    }
  } catch (err) {
    console.error("Firebase Admin initialization failed for call push", err);
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const { callId, conversationId, initiatorId, initiatorName, callType, recipientIds } = req.body || {};
  if (!callId || !recipientIds?.length) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase config");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const targetUserIds = recipientIds.filter((id: string) => id !== initiatorId);

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token")
      .in("user_id", targetUserIds);

    if (!tokens?.length) {
      return res.json({ sent: 0 });
    }

    const uniqueTokens = Array.from(new Set(tokens.map((t: any) => t.token).filter(Boolean)));
    if (!uniqueTokens.length) {
      return res.json({ sent: 0 });
    }

    const title = `Incoming ${callType === "video" ? "Video" : "Voice"} Call`;
    const body = `${initiatorName || "Someone"} is calling you on Varta...`;

    const result = await getMessaging().sendEachForMulticast({
      tokens: uniqueTokens,
      notification: { title, body },
      data: {
        callId,
        conversationId: conversationId || "",
        type: "incoming_call",
        callType: callType || "voice",
        icon: "/logo.svg",
        click_action: conversationId ? `/chat/${conversationId}` : "/calls",
      },
      webpush: {
        notification: {
          title,
          body,
          icon: "/logo.svg",
          badge: "/logo.svg",
        },
        fcmOptions: {
          link: conversationId ? `/chat/${conversationId}` : "/calls",
        },
      },
    });

    return res.json({ sent: result.successCount, failed: result.failureCount });
  } catch (err: any) {
    console.error("sendCallPush error:", err);
    return res.status(500).json({ error: err.message });
  }
}
