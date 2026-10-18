import { getMessaging } from 'firebase-admin/messaging';
import type { Pool } from 'pg';

/** One display path (data messages), bounded batches, and expired-device cleanup. */
export async function deliverPush(db: Pool, userIds: string[], data: Record<string, string>) {
  if (!userIds.length) return { sent: 0, failed: 0 };
  const { rows } = await db.query('SELECT DISTINCT token FROM push_tokens WHERE user_id = ANY($1)', [userIds]);
  let sent = 0;
  let failed = 0;
  for (let offset = 0; offset < rows.length; offset += 500) {
    const tokens: string[] = rows.slice(offset, offset + 500).map(row => row.token);
    const result = await getMessaging().sendEachForMulticast({
      tokens, data: { ...data, title: (data.title || "Varta").slice(0, 100), body: (data.body || "New update").slice(0, 240) },
      webpush: { headers: { Urgency: 'high', TTL: data.type === 'incoming_call' ? '60' : '86400' } },
    });
    sent += result.successCount;
    failed += result.failureCount;
    const expired: string[] = [];
    result.responses.forEach((response, index) => {
      const code = response.error?.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') expired.push(tokens[index]);
      else if (code) console.warn('[Push] Delivery failed:', code);
    });
    if (expired.length) await db.query('DELETE FROM push_tokens WHERE token = ANY($1)', [expired]);
  }
  return { sent, failed };
}
