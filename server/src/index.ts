import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { Pool } from "pg";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { createWriteStream, mkdirSync } from "fs";
import { join } from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

// ─── Firebase Admin ─────────────────────────────────────────────────────────
if (!getApps().length) {
  try {
    const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (rawKey) {
      const serviceAccount = JSON.parse(rawKey);
      if (serviceAccount.project_id) {
        initializeApp({ credential: cert(serviceAccount) });
        console.log("[Firebase Admin] Initialized for project:", serviceAccount.project_id);
      }
    }
  } catch (err) {
    console.warn("[Firebase Admin] Init skipped:", err);
  }
}

// ─── PostgreSQL Pool ─────────────────────────────────────────────────────────
const db = new Pool({
  host: process.env.DB_HOST || "db",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "postgres",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || "varta_secure_free_db_pass_2026",
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

db.connect().then(() => console.log("[PostgreSQL] Connected")).catch(console.error);

// ─── Express Setup ───────────────────────────────────────────────────────────
const app = express();
const PORT = Number(process.env.PORT) || 4000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*").split(",").map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── File Upload (local disk) ────────────────────────────────────────────────
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/lib/varta/uploads";
try { mkdirSync(UPLOAD_DIR, { recursive: true }); } catch { /* already exists */ }

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split(".").pop() || "bin";
    cb(null, `${uuidv4()}.${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

// ─── Auth Middleware ─────────────────────────────────────────────────────────
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = await getAuth().verifyIdToken(token);
    (req as any).uid = decoded.uid;
    (req as any).email = decoded.email;
    (req as any).displayName = decoded.name || decoded.email;
    (req as any).avatarUrl = decoded.picture || null;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function uid(req: Request): string { return (req as any).uid; }

// ─── Profile Auto-Create Helper ───────────────────────────────────────────────
async function ensureProfile(req: Request) {
  const userId = uid(req);
  const { rows } = await db.query("SELECT id FROM profiles WHERE id = $1", [userId]);
  if (rows.length === 0) {
    const displayName = (req as any).displayName || "User";
    const avatarUrl = (req as any).avatarUrl || null;
    await db.query(
      `INSERT INTO profiles (id, display_name, avatar_url, is_approved, is_admin, created_at, updated_at)
       VALUES ($1, $2, $3, false, false, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
      [userId, displayName, avatarUrl],
    );
  }
}

// ─── WebSocket Manager ───────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// Map: uid → Set<WebSocket>
const connections = new Map<string, Set<WebSocket>>();
// Map: ws → uid
const wsToUid = new Map<WebSocket, string>();
// Map: channelName → Set<uid>
const channelSubs = new Map<string, Set<string>>();

function addSub(channel: string, uid: string) {
  if (!channelSubs.has(channel)) channelSubs.set(channel, new Set());
  channelSubs.get(channel)!.add(uid);
}

function removeSub(channel: string, uid: string) {
  channelSubs.get(channel)?.delete(uid);
}

function broadcast(channel: string, event: string, payload: unknown, excludeUid?: string) {
  const subs = channelSubs.get(channel);
  if (!subs) return;
  const msg = JSON.stringify({ type: "event", channel, event, payload });
  for (const subUid of subs) {
    if (subUid === excludeUid) continue;
    const sockets = connections.get(subUid);
    if (!sockets) continue;
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  }
}

function sendToUser(targetUid: string, channel: string, event: string, payload: unknown) {
  const sockets = connections.get(targetUid);
  if (!sockets) return;
  const msg = JSON.stringify({ type: "event", channel, event, payload });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

wss.on("connection", async (ws, req) => {
  // Auth via token in query string
  const url = new URL(req.url || "/", `http://localhost`);
  const token = url.searchParams.get("token");
  let userId: string | null = null;

  if (token) {
    try {
      const decoded = await getAuth().verifyIdToken(token);
      userId = decoded.uid;
    } catch { /* anonymous */ }
  }

  if (!userId) {
    ws.close(4001, "Unauthorized");
    return;
  }

  wsToUid.set(ws, userId);
  if (!connections.has(userId)) connections.set(userId, new Set());
  connections.get(userId)!.add(ws);

  // Auto-subscribe to personal channel
  addSub(`calls:${userId}`, userId);
  addSub(`presence:${userId}`, userId);

  console.log(`[WS] User ${userId} connected (total: ${connections.size})`);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString()) as any;
      if (msg.type === "ping") { ws.send(JSON.stringify({ type: "pong" })); return; }
      if (msg.type === "subscribe") addSub(msg.channel, userId!);
      if (msg.type === "unsubscribe") removeSub(msg.channel, userId!);
      if (msg.type === "broadcast") {
        broadcast(msg.channel, msg.event, msg.payload, userId!);
      }
    } catch { /* ignore */ }
  });

  ws.on("close", () => {
    connections.get(userId!)?.delete(ws);
    if (connections.get(userId!)?.size === 0) connections.delete(userId!);
    wsToUid.delete(ws);
    // Remove from all channel subscriptions
    for (const [, subs] of channelSubs) subs.delete(userId!);
    console.log(`[WS] User ${userId} disconnected`);
  });
});

// ─── Health ──────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "varta-backend",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cloud: "Google Cloud Platform (Always Free - 0 Rupee)",
    wsClients: connections.size,
  });
});

app.get("/api/status", (_req, res) => {
  res.json({
    status: "healthy",
    cloudProvider: "Google Cloud Platform",
    pricingTier: "Always Free Lifetime ($0.00 / 0 INR)",
    killSwitchActive: true,
    watchdogInterval: "15 minutes",
    storageSafeGuards: "Automated Daily Backup + Offsite Snapshot",
    timestamp: new Date().toISOString(),
  });
});

// ─── PROFILES ────────────────────────────────────────────────────────────────

// GET /api/profiles/me
app.get("/api/profiles/me", requireAuth, async (req, res) => {
  await ensureProfile(req);
  const { rows } = await db.query("SELECT * FROM profiles WHERE id = $1", [uid(req)]);
  res.json(rows[0] || null);
});

// PATCH /api/profiles/me
app.patch("/api/profiles/me", requireAuth, async (req, res) => {
  await ensureProfile(req);
  const allowed = ["display_name", "username", "bio", "avatar_url", "phone", "custom_status", "custom_status_expires_at", "status_privacy"];
  const updates: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = $${i++}`);
      vals.push(req.body[key]);
    }
  }
  if (!updates.length) return res.json({ ok: true });
  updates.push(`updated_at = NOW()`);
  vals.push(uid(req));
  await db.query(`UPDATE profiles SET ${updates.join(", ")} WHERE id = $${i}`, vals);
  const { rows } = await db.query("SELECT * FROM profiles WHERE id = $1", [uid(req)]);
  // Broadcast profile update
  broadcast(`profiles`, "updated", rows[0]);
  res.json(rows[0]);
});

// PATCH /api/profiles/me/presence
app.patch("/api/profiles/me/presence", requireAuth, async (req, res) => {
  const { presence } = req.body;
  await db.query(
    "UPDATE profiles SET presence = $1, last_seen = NOW(), updated_at = NOW() WHERE id = $2",
    [presence, uid(req)],
  );
  // Broadcast to presence channel
  broadcast(`presence:${uid(req)}`, "presence_update", { uid: uid(req), presence });
  res.json({ ok: true });
});

// GET /api/profiles/:id
app.get("/api/profiles/:id", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    "SELECT id, display_name, username, avatar_url, bio, presence, last_seen, custom_status, is_approved, is_admin FROM profiles WHERE id = $1",
    [req.params.id],
  );
  res.json(rows[0] || null);
});

// GET /api/profiles/search?q=
app.get("/api/profiles/search", requireAuth, async (req, res) => {
  const q = (req.query.q as string || "").trim();
  if (!q) return res.json([]);
  const { rows } = await db.query(
    `SELECT id, display_name, username, avatar_url, presence FROM profiles
     WHERE (display_name ILIKE $1 OR username ILIKE $1 OR id = $2) AND id != $3 LIMIT 20`,
    [`%${q}%`, q, uid(req)],
  );
  res.json(rows);
});

// ─── UPLOAD ───────────────────────────────────────────────────────────────────

const APP_URL = process.env.APP_URL || process.env.VITE_APP_URL || "http://localhost";

app.post("/api/upload/avatar", requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const url = `${APP_URL}/uploads/${req.file.filename}`;
  res.json({ url });
});

app.post("/api/upload/media", requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const url = `${APP_URL}/uploads/${req.file.filename}`;
  res.json({ url });
});

// Serve uploaded files
app.use("/uploads", express.static(UPLOAD_DIR));

// ─── CONVERSATIONS ────────────────────────────────────────────────────────────

// GET /api/conversations
app.get("/api/conversations", requireAuth, async (req, res) => {
  const myId = uid(req);
  const { rows: convRows } = await db.query(
    `SELECT c.*, 
      (SELECT json_agg(json_build_object(
        'id', cm.id, 'user_id', cm.user_id, 'role', cm.role,
        'profile', json_build_object('id', p.id, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'presence', p.presence, 'last_seen', p.last_seen, 'custom_status', p.custom_status)
      )) FROM conversation_members cm JOIN profiles p ON p.id = cm.user_id WHERE cm.conversation_id = c.id) AS members,
      (SELECT row_to_json(m) FROM messages m WHERE m.conversation_id = c.id AND m.is_deleted = false ORDER BY m.created_at DESC LIMIT 1) AS last_message
     FROM conversations c
     JOIN conversation_members my ON my.conversation_id = c.id AND my.user_id = $1
     ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
    [myId],
  );
  res.json(convRows);
});

// POST /api/conversations
app.post("/api/conversations", requireAuth, async (req, res) => {
  const myId = uid(req);
  const { type, title, memberIds } = req.body as { type: string; title?: string; memberIds: string[] };

  // For direct chats, check if one already exists
  if (type === "direct" && memberIds.length === 1) {
    const otherId = memberIds[0];
    const { rows: existing } = await db.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = $1
       JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = $2
       WHERE c.type = 'direct' LIMIT 1`,
      [myId, otherId],
    );
    if (existing.length) return res.json(existing[0]);
  }

  const convId = uuidv4();
  await db.query(
    "INSERT INTO conversations (id, type, title, created_by, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())",
    [convId, type, title || null, myId],
  );

  const allMembers = [myId, ...memberIds.filter((id) => id !== myId)];
  for (const memberId of allMembers) {
    const role = memberId === myId ? "owner" : "member";
    await db.query(
      "INSERT INTO conversation_members (id, conversation_id, user_id, role, joined_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT DO NOTHING",
      [uuidv4(), convId, memberId, role],
    );
  }

  const { rows } = await db.query("SELECT * FROM conversations WHERE id = $1", [convId]);
  broadcast("conversations", "updated", rows[0]);
  res.json(rows[0]);
});

// GET /api/conversations/:id
app.get("/api/conversations/:id", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.*, (SELECT json_agg(json_build_object('id', cm.id, 'user_id', cm.user_id, 'role', cm.role, 'profile', json_build_object('id', p.id, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'presence', p.presence))) FROM conversation_members cm JOIN profiles p ON p.id = cm.user_id WHERE cm.conversation_id = c.id) AS members FROM conversations c WHERE c.id = $1`,
    [req.params.id],
  );
  res.json(rows[0] || null);
});

// PATCH /api/conversations/:id
app.patch("/api/conversations/:id", requireAuth, async (req, res) => {
  const allowed = ["title", "description", "avatar_url", "is_archived"];
  const updates: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const key of allowed) {
    if (req.body[key] !== undefined) { updates.push(`${key} = $${i++}`); vals.push(req.body[key]); }
  }
  if (!updates.length) return res.json({ ok: true });
  updates.push(`updated_at = NOW()`);
  vals.push(req.params.id);
  await db.query(`UPDATE conversations SET ${updates.join(", ")} WHERE id = $${i}`, vals);
  const { rows } = await db.query("SELECT * FROM conversations WHERE id = $1", [req.params.id]);
  broadcast("conversations", "updated", rows[0]);
  res.json(rows[0]);
});

// GET /api/conversations/:id/members
app.get("/api/conversations/:id/members", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT cm.*, row_to_json(p) AS profile FROM conversation_members cm JOIN profiles p ON p.id = cm.user_id WHERE cm.conversation_id = $1`,
    [req.params.id],
  );
  res.json(rows);
});

// POST /api/conversations/:id/members
app.post("/api/conversations/:id/members", requireAuth, async (req, res) => {
  const { userId } = req.body;
  await db.query(
    "INSERT INTO conversation_members (id, conversation_id, user_id, role, joined_at) VALUES ($1, $2, $3, 'member', NOW()) ON CONFLICT DO NOTHING",
    [uuidv4(), req.params.id, userId],
  );
  res.json({ ok: true });
});

// DELETE /api/conversations/:id/members/:userId
app.delete("/api/conversations/:id/members/:userId", requireAuth, async (req, res) => {
  await db.query(
    "DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
    [req.params.id, req.params.userId],
  );
  res.json({ ok: true });
});

// ─── MESSAGES ─────────────────────────────────────────────────────────────────

// GET /api/conversations/:id/messages
app.get("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  const convId = req.params.id;
  const pinned = req.query.pinned === "true";
  const cursor = req.query.cursor as string | undefined;

  let query = `SELECT m.*,
    row_to_json(p) AS sender,
    (SELECT json_agg(json_build_object('id', r.id, 'emoji', r.emoji, 'user_id', r.user_id, 'profile', json_build_object('id', rp.id, 'display_name', rp.display_name))) FROM message_reactions r JOIN profiles rp ON rp.id = r.user_id WHERE r.message_id = m.id) AS reactions,
    (SELECT row_to_json(rm) FROM messages rm WHERE rm.id = m.reply_to_id) AS reply_to
   FROM messages m LEFT JOIN profiles p ON p.id = m.sender_id
   WHERE m.conversation_id = $1 AND m.is_deleted = false`;

  const vals: any[] = [convId];
  if (pinned) { query += ` AND m.is_pinned = true`; }
  if (cursor) { query += ` AND m.created_at < $${vals.length + 1}`; vals.push(cursor); }
  query += ` ORDER BY m.created_at ${pinned ? "DESC" : "ASC"} LIMIT 100`;

  const { rows } = await db.query(query, vals);
  res.json(rows);
});

// POST /api/conversations/:id/messages
app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  const convId = req.params.id;
  const myId = uid(req);
  const { content, type = "text", media_url, gif_url, reply_to_id } = req.body;

  const msgId = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO messages (id, conversation_id, sender_id, type, content, media_url, gif_url, reply_to_id, is_edited, is_deleted, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,false,NOW(),NOW()) RETURNING *`,
    [msgId, convId, myId, type, content || null, media_url || null, gif_url || null, reply_to_id || null],
  );
  const msg = rows[0];

  // Fetch sender profile
  const { rows: profRows } = await db.query("SELECT id, display_name, avatar_url FROM profiles WHERE id = $1", [myId]);
  const fullMsg = { ...msg, sender: profRows[0] || null, reactions: [], reply_to: null };

  // Update conversation last_message_at
  await db.query("UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1", [convId]);

  // Broadcast to conversation channel
  broadcast(`messages:${convId}`, "insert", fullMsg, undefined);
  broadcast("conversations", "new_message", fullMsg);

  // Auto push notification (backend handles it directly via Firebase)
  _triggerMessagePush(convId, myId, profRows[0]?.display_name || "Someone", type === "text" ? content : `Sent a ${type}`).catch(() => {});

  res.json(fullMsg);
});

// PATCH /api/messages/:id
app.patch("/api/messages/:id", requireAuth, async (req, res) => {
  const { content, is_starred, is_pinned } = req.body;
  const updates: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (content !== undefined) { updates.push(`content = $${i++}`, `is_edited = true`); vals.push(content); }
  if (is_starred !== undefined) { updates.push(`is_starred = $${i++}`); vals.push(is_starred); }
  if (is_pinned !== undefined) { updates.push(`is_pinned = $${i++}`); vals.push(is_pinned); }
  if (!updates.length) return res.json({ ok: true });
  updates.push(`updated_at = NOW()`);
  vals.push(req.params.id);
  const { rows } = await db.query(`UPDATE messages SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`, vals);
  if (rows[0]) {
    broadcast(`messages:${rows[0].conversation_id}`, "update", rows[0]);
  }
  res.json(rows[0] || null);
});

// DELETE /api/messages/:id (soft delete)
app.delete("/api/messages/:id", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    "UPDATE messages SET is_deleted = true, updated_at = NOW() WHERE id = $1 AND sender_id = $2 RETURNING *",
    [req.params.id, uid(req)],
  );
  if (rows[0]) broadcast(`messages:${rows[0].conversation_id}`, "update", rows[0]);
  res.json({ ok: true });
});

// PATCH /api/messages/:id/star
app.patch("/api/messages/:id/star", requireAuth, async (req, res) => {
  const { starred } = req.body;
  const { rows } = await db.query(
    "UPDATE messages SET is_starred = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    [starred, req.params.id],
  );
  if (rows[0]) broadcast(`messages:${rows[0].conversation_id}`, "update", rows[0]);
  res.json(rows[0] || null);
});

// GET /api/messages/starred
app.get("/api/messages/starred", requireAuth, async (req, res) => {
  const myId = uid(req);
  const { rows } = await db.query(
    `SELECT m.*, row_to_json(p) AS sender FROM messages m
     LEFT JOIN profiles p ON p.id = m.sender_id
     JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = $1
     WHERE m.is_starred = true AND m.is_deleted = false ORDER BY m.created_at DESC`,
    [myId],
  );
  res.json(rows);
});

// GET /api/messages/search
app.get("/api/messages/search", requireAuth, async (req, res) => {
  const q = (req.query.q as string || "").trim();
  if (!q) return res.json([]);
  const myId = uid(req);
  const { rows } = await db.query(
    `SELECT m.*, row_to_json(p) AS sender FROM messages m
     LEFT JOIN profiles p ON p.id = m.sender_id
     JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = $1
     WHERE m.content ILIKE $2 AND m.is_deleted = false ORDER BY m.created_at DESC LIMIT 50`,
    [myId, `%${q}%`],
  );
  res.json(rows);
});

// GET /api/messages/:id
app.get("/api/messages/:id", requireAuth, async (req, res) => {
  const { rows } = await db.query("SELECT * FROM messages WHERE id = $1", [req.params.id]);
  res.json(rows[0] || null);
});

// POST /api/messages/read
app.post("/api/messages/read", requireAuth, async (req, res) => {
  const { messageIds } = req.body as { messageIds: string[] };
  const myId = uid(req);
  for (const mid of messageIds) {
    await db.query(
      `INSERT INTO message_read_receipts (message_id, user_id, read_at) VALUES ($1,$2,NOW()) ON CONFLICT (message_id, user_id) DO UPDATE SET read_at = NOW()`,
      [mid, myId],
    );
  }
  res.json({ ok: true });
});

// ─── REACTIONS ────────────────────────────────────────────────────────────────

// POST /api/messages/:id/reactions (toggle)
app.post("/api/messages/:id/reactions", requireAuth, async (req, res) => {
  const { emoji } = req.body;
  const myId = uid(req);
  const msgId = req.params.id;

  const { rows: existing } = await db.query(
    "SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3",
    [msgId, myId, emoji],
  );

  if (existing.length) {
    await db.query("DELETE FROM message_reactions WHERE id = $1", [existing[0].id]);
    const { rows: msgRows } = await db.query("SELECT conversation_id FROM messages WHERE id = $1", [msgId]);
    if (msgRows[0]) {
      broadcast(`messages:${msgRows[0].conversation_id}`, "reaction_remove", { id: existing[0].id, message_id: msgId, emoji, user_id: myId });
    }
    return res.json({ action: "removed" });
  }

  const rxId = uuidv4();
  await db.query(
    "INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at) VALUES ($1,$2,$3,$4,NOW())",
    [rxId, msgId, myId, emoji],
  );

  const { rows: profRows } = await db.query("SELECT id, display_name FROM profiles WHERE id = $1", [myId]);
  const { rows: msgRows } = await db.query("SELECT conversation_id FROM messages WHERE id = $1", [msgId]);

  const reaction = { id: rxId, message_id: msgId, user_id: myId, emoji, profile: profRows[0] || null };
  if (msgRows[0]) {
    broadcast(`messages:${msgRows[0].conversation_id}`, "reaction_add", reaction);
  }
  res.json({ action: "added", reaction });
});

// GET /api/messages/:id/reactions
app.get("/api/messages/:id/reactions", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.*, row_to_json(p) AS profile FROM message_reactions r JOIN profiles p ON p.id = r.user_id WHERE r.message_id = $1`,
    [req.params.id],
  );
  res.json(rows);
});

// ─── CALLS ───────────────────────────────────────────────────────────────────

// GET /api/calls
app.get("/api/calls", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.*, row_to_json(p) AS initiator FROM calls c JOIN profiles p ON p.id = c.initiator_id
     JOIN call_participants cp ON cp.call_id = c.id AND cp.user_id = $1
     ORDER BY c.created_at DESC LIMIT 50`,
    [uid(req)],
  );
  res.json(rows);
});

// POST /api/calls
app.post("/api/calls", requireAuth, async (req, res) => {
  const myId = uid(req);
  const { conversation_id, type, participant_ids } = req.body as { conversation_id: string; type: string; participant_ids: string[] };

  const callId = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO calls (id, conversation_id, initiator_id, type, status, started_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'ringing',NOW(),NOW(),NOW()) RETURNING *`,
    [callId, conversation_id, myId, type],
  );
  const call = rows[0];

  // Add initiator as participant
  await db.query(
    "INSERT INTO call_participants (id, call_id, user_id, joined_at, is_muted, is_video_off) VALUES ($1,$2,$3,NOW(),false,false)",
    [uuidv4(), callId, myId],
  );

  // Get initiator profile
  const { rows: profRows } = await db.query("SELECT * FROM profiles WHERE id = $1", [myId]);

  // Notify all participants via WebSocket
  for (const pid of participant_ids) {
    if (pid !== myId) {
      sendToUser(pid, `calls:${pid}`, "incoming_call", { call, initiatorProfile: profRows[0] });
    }
  }

  res.json(call);
});

// PATCH /api/calls/:id
app.patch("/api/calls/:id", requireAuth, async (req, res) => {
  const allowed = ["status", "answered_at", "ended_at", "duration_seconds"];
  const updates: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const key of allowed) {
    if (req.body[key] !== undefined) { updates.push(`${key} = $${i++}`); vals.push(req.body[key]); }
  }
  if (!updates.length) return res.json({ ok: true });
  updates.push(`updated_at = NOW()`);
  vals.push(req.params.id);
  const { rows } = await db.query(`UPDATE calls SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`, vals);

  // Notify participants of call update
  if (rows[0]) {
    const { rows: parts } = await db.query("SELECT user_id FROM call_participants WHERE call_id = $1", [req.params.id]);
    for (const p of parts) {
      sendToUser(p.user_id, `calls:${p.user_id}`, "call_updated", rows[0]);
    }
  }

  res.json(rows[0] || null);
});

// POST /api/calls/:id/signals
app.post("/api/calls/:id/signals", requireAuth, async (req, res) => {
  const callId = req.params.id;
  const myId = uid(req);
  const { to_user_id, signal_type, payload } = req.body;

  const sigId = uuidv4();
  await db.query(
    `INSERT INTO call_signals (id, call_id, from_user_id, to_user_id, signal_type, payload, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
    [sigId, callId, myId, to_user_id || null, signal_type, JSON.stringify(payload)],
  );

  // Broadcast signal to call participants via WS
  if (to_user_id) {
    sendToUser(to_user_id, `call_signals:${callId}`, "signal", { id: sigId, call_id: callId, from_user_id: myId, signal_type, payload });
  } else {
    broadcast(`call_signals:${callId}`, "signal", { id: sigId, call_id: callId, from_user_id: myId, signal_type, payload }, myId);
  }

  res.json({ ok: true });
});

// GET /api/calls/:id/signals
app.get("/api/calls/:id/signals", requireAuth, async (req, res) => {
  const after = req.query.after as string | undefined;
  let q = "SELECT * FROM call_signals WHERE call_id = $1";
  const vals: any[] = [req.params.id];
  if (after) { q += ` AND id > $2`; vals.push(after); }
  q += " ORDER BY created_at ASC";
  const { rows } = await db.query(q, vals);
  res.json(rows);
});

// DELETE /api/calls/:id
app.delete("/api/calls/:id", requireAuth, async (req, res) => {
  await db.query("DELETE FROM calls WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

// DELETE /api/calls/mine
app.delete("/api/calls/mine", requireAuth, async (req, res) => {
  await db.query("DELETE FROM calls WHERE initiator_id = $1 AND status IN ('ringing','calling')", [uid(req)]);
  res.json({ ok: true });
});

// ─── MEETINGS ─────────────────────────────────────────────────────────────────

app.get("/api/meetings", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT m.*, row_to_json(p) AS host FROM meetings m JOIN profiles p ON p.id = m.host_id
     JOIN meeting_participants mp ON mp.meeting_id = m.id AND mp.user_id = $1
     ORDER BY m.scheduled_at DESC`,
    [uid(req)],
  );
  res.json(rows);
});

app.post("/api/meetings", requireAuth, async (req, res) => {
  const myId = uid(req);
  const { title, description, scheduled_at, duration_minutes, conversation_id, waiting_room_enabled } = req.body;
  const meetId = uuidv4();
  const joinLink = `/meetings/${meetId}`;
  const { rows } = await db.query(
    `INSERT INTO meetings (id, conversation_id, host_id, title, description, scheduled_at, duration_minutes, join_link, status, waiting_room_enabled, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',$9,NOW(),NOW()) RETURNING *`,
    [meetId, conversation_id || null, myId, title, description || null, scheduled_at, duration_minutes || 60, joinLink, waiting_room_enabled ?? false],
  );
  await db.query(
    "INSERT INTO meeting_participants (id, meeting_id, user_id, rsvp, admitted_at, raised_hand_at) VALUES ($1,$2,$3,'accepted',NULL,NULL)",
    [uuidv4(), meetId, myId],
  );
  res.json(rows[0]);
});

app.patch("/api/meetings/:id", requireAuth, async (req, res) => {
  const allowed = ["status", "title", "description", "scheduled_at", "duration_minutes", "waiting_room_enabled", "recording_url"];
  const updates: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const key of allowed) {
    if (req.body[key] !== undefined) { updates.push(`${key} = $${i++}`); vals.push(req.body[key]); }
  }
  if (!updates.length) return res.json({ ok: true });
  updates.push(`updated_at = NOW()`);
  vals.push(req.params.id);
  const { rows } = await db.query(`UPDATE meetings SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`, vals);
  res.json(rows[0] || null);
});

app.delete("/api/meetings/:id", requireAuth, async (req, res) => {
  await db.query("UPDATE meetings SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

// ─── STATUSES / STORIES ───────────────────────────────────────────────────────

app.get("/api/statuses", requireAuth, async (req, res) => {
  const myId = uid(req);
  const now = new Date().toISOString();
  const { rows } = await db.query(
    `SELECT s.*, row_to_json(p) AS profile,
      EXISTS(SELECT 1 FROM status_views sv WHERE sv.status_id = s.id AND sv.viewer_id = $1) AS viewed
     FROM statuses s JOIN profiles p ON p.id = s.user_id
     WHERE s.is_deleted = false AND s.expires_at > $2
     ORDER BY s.created_at DESC`,
    [myId, now],
  );
  res.json(rows);
});

app.post("/api/statuses", requireAuth, async (req, res) => {
  const { media_type, media_url, text_content, background_color, expires_at } = req.body;
  const sId = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO statuses (id, user_id, media_type, media_url, text_content, background_color, expires_at, is_deleted, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false,NOW()) RETURNING *`,
    [sId, uid(req), media_type, media_url || null, text_content || null, background_color || "#1E88C7", expires_at],
  );
  res.json(rows[0]);
});

app.post("/api/statuses/:id/views", requireAuth, async (req, res) => {
  const { reactionEmoji } = req.body;
  await db.query(
    `INSERT INTO status_views (status_id, viewer_id, viewed_at, reaction_emoji) VALUES ($1,$2,NOW(),$3)
     ON CONFLICT (status_id, viewer_id) DO UPDATE SET viewed_at = NOW(), reaction_emoji = $3`,
    [req.params.id, uid(req), reactionEmoji || null],
  );
  res.json({ ok: true });
});

app.get("/api/statuses/:id/views", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT sv.*, row_to_json(p) AS viewer FROM status_views sv JOIN profiles p ON p.id = sv.viewer_id WHERE sv.status_id = $1 ORDER BY sv.viewed_at ASC`,
    [req.params.id],
  );
  res.json(rows);
});

app.delete("/api/statuses/:id", requireAuth, async (req, res) => {
  await db.query("UPDATE statuses SET is_deleted = true WHERE id = $1 AND user_id = $2", [req.params.id, uid(req)]);
  res.json({ ok: true });
});

// ─── CONTACTS ─────────────────────────────────────────────────────────────────

app.get("/api/contacts", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.*, row_to_json(p) AS profile FROM contacts c JOIN profiles p ON p.id = c.contact_id WHERE c.user_id = $1`,
    [uid(req)],
  );
  res.json(rows);
});

app.post("/api/contacts", requireAuth, async (req, res) => {
  const myId = uid(req);
  const { contacts } = req.body as { contacts: Array<{ contact_id: string; nickname?: string; is_close_friend?: boolean }> };
  for (const c of contacts) {
    await db.query(
      `INSERT INTO contacts (id, user_id, contact_id, nickname, is_close_friend, created_at) VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (user_id, contact_id) DO UPDATE SET nickname = $4, is_close_friend = $5`,
      [uuidv4(), myId, c.contact_id, c.nickname || null, c.is_close_friend ?? false],
    );
  }
  res.json({ ok: true });
});

// ─── INVITATIONS ──────────────────────────────────────────────────────────────

app.get("/api/invitations", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    "SELECT * FROM invitations WHERE inviter_id = $1 ORDER BY created_at DESC",
    [uid(req)],
  );
  res.json(rows);
});

app.post("/api/invitations", requireAuth, async (req, res) => {
  const { email, customMessage } = req.body;
  const inviteCode = Math.random().toString(36).substring(2, 14).toUpperCase();
  const invId = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO invitations (id, inviter_id, email, invite_code, custom_message, status, created_at)
     VALUES ($1,$2,$3,$4,$5,'pending',NOW()) RETURNING *`,
    [invId, uid(req), email, inviteCode, customMessage || null],
  );
  res.json(rows[0]);
});

app.get("/api/invitations/lookup", async (req, res) => {
  const code = req.query.code as string;
  const { rows } = await db.query(
    `SELECT i.*, row_to_json(p) AS inviter FROM invitations i JOIN profiles p ON p.id = i.inviter_id WHERE i.invite_code = $1 AND i.status = 'pending'`,
    [code],
  );
  res.json(rows[0] || null);
});

app.post("/api/invitations/accept", requireAuth, async (req, res) => {
  const { code } = req.body;
  const myId = uid(req);
  const { rows } = await db.query("SELECT * FROM invitations WHERE invite_code = $1 AND status = 'pending'", [code]);
  if (!rows[0]) return res.status(404).json({ error: "Invalid or expired invite" });
  await db.query(
    "UPDATE invitations SET status = 'accepted', accepted_at = NOW() WHERE invite_code = $1",
    [code],
  );
  // Auto-add as contacts
  const inviterId = rows[0].inviter_id;
  if (inviterId !== myId) {
    await db.query(`INSERT INTO contacts (id, user_id, contact_id, nickname, is_close_friend, created_at) VALUES ($1,$2,$3,NULL,false,NOW()) ON CONFLICT DO NOTHING`, [uuidv4(), myId, inviterId]);
    await db.query(`INSERT INTO contacts (id, user_id, contact_id, nickname, is_close_friend, created_at) VALUES ($1,$2,$3,NULL,false,NOW()) ON CONFLICT DO NOTHING`, [uuidv4(), inviterId, myId]);
  }
  res.json({ ok: true });
});

app.delete("/api/invitations/:id", requireAuth, async (req, res) => {
  await db.query("UPDATE invitations SET status = 'revoked' WHERE id = $1 AND inviter_id = $2", [req.params.id, uid(req)]);
  res.json({ ok: true });
});

// ─── PUSH TOKENS ──────────────────────────────────────────────────────────────

app.post("/api/push-tokens", requireAuth, async (req, res) => {
  const { token, platform } = req.body;
  await db.query(
    `INSERT INTO push_tokens (id, user_id, token, platform, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW())
     ON CONFLICT (user_id, token) DO UPDATE SET updated_at = NOW()`,
    [uuidv4(), uid(req), token, platform || "web"],
  );
  res.json({ ok: true });
});

// ─── GIF FAVORITES ────────────────────────────────────────────────────────────

app.get("/api/gif-favorites", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    "SELECT * FROM gif_favorites WHERE user_id = $1 ORDER BY last_used_at DESC LIMIT 50",
    [uid(req)],
  );
  res.json(rows);
});

app.post("/api/gif-favorites", requireAuth, async (req, res) => {
  const { gif_url, provider } = req.body;
  await db.query(
    `INSERT INTO gif_favorites (user_id, gif_url, provider, used_count, last_used_at) VALUES ($1,$2,$3,1,NOW())
     ON CONFLICT (user_id, gif_url) DO UPDATE SET used_count = gif_favorites.used_count + 1, last_used_at = NOW()`,
    [uid(req), gif_url, provider || null],
  );
  res.json({ ok: true });
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { rows } = await db.query("SELECT is_admin FROM profiles WHERE id = $1", [uid(req)]);
  if (!rows[0]?.is_admin) return res.status(403).json({ error: "Forbidden" });
  next();
}

app.get("/api/admin/users", requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await db.query("SELECT * FROM profiles ORDER BY created_at DESC");
  res.json(rows);
});

app.post("/api/admin/users/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  await db.query("UPDATE profiles SET is_approved = true, updated_at = NOW() WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

app.post("/api/admin/users/:id/revoke", requireAuth, requireAdmin, async (req, res) => {
  await db.query("UPDATE profiles SET is_approved = false, updated_at = NOW() WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

app.post("/api/admin/users/:id/admin", requireAuth, requireAdmin, async (req, res) => {
  const { is_admin } = req.body;
  await db.query("UPDATE profiles SET is_admin = $1, is_approved = true, updated_at = NOW() WHERE id = $2", [is_admin, req.params.id]);
  res.json({ ok: true });
});

app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  await db.query("DELETE FROM profiles WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

app.get("/api/admin/settings", requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await db.query("SELECT * FROM admin_settings LIMIT 1");
  res.json(rows[0] || {});
});

app.patch("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
  const allowed = Object.keys(req.body);
  if (!allowed.length) return res.json({ ok: true });
  const updates: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const key of allowed) { updates.push(`${key} = $${i++}`); vals.push(req.body[key]); }
  await db.query(`INSERT INTO admin_settings (id, ${allowed.join(",")}) VALUES ($${i}, ${allowed.map((_,j) => `$${j+1}`).join(",")}) ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}`, [...vals, "singleton"]);
  res.json({ ok: true });
});

// ─── NOTIFICATIONS (FCM via Firebase Admin) ───────────────────────────────────

app.post("/api/sendMessagePush", async (req, res) => {
  const { conversationId, senderId, senderName, preview, recipientIds } = req.body || {};
  if (!conversationId || !recipientIds?.length) return res.status(400).json({ error: "Missing fields" });

  try {
    const targetIds = recipientIds.filter((id: string) => id !== senderId);
    const { rows: tokens } = await db.query("SELECT token FROM push_tokens WHERE user_id = ANY($1)", [targetIds]);

    if (!tokens.length) return res.json({ sent: 0, reason: "No tokens" });
    if (!getApps().length) return res.status(503).json({ error: "Firebase not configured" });

    const result = await getMessaging().sendEachForMulticast({
      tokens: tokens.map((t: any) => t.token),
      notification: { title: senderName || "New message", body: preview || "You have a new message" },
      data: { conversationId, type: "message", click_action: "/chat", icon: "/favicon.svg" },
      webpush: { notification: { title: senderName || "New message", body: preview || "You have a new message", icon: "/favicon.svg" }, fcmOptions: { link: "/chat" } },
    });
    res.json({ sent: result.successCount, failed: result.failureCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/sendCallPush", async (req, res) => {
  const { callId, conversationId, initiatorId, initiatorName, callType, recipientIds } = req.body || {};
  if (!callId || !recipientIds?.length) return res.status(400).json({ error: "Missing fields" });

  try {
    const targetIds = recipientIds.filter((id: string) => id !== initiatorId);
    const { rows: tokens } = await db.query("SELECT token FROM push_tokens WHERE user_id = ANY($1)", [targetIds]);

    if (!tokens.length) return res.json({ sent: 0, reason: "No tokens" });
    if (!getApps().length) return res.status(503).json({ error: "Firebase not configured" });

    const title = `Incoming ${callType === "video" ? "Video" : "Voice"} Call`;
    const body = `${initiatorName || "Someone"} is calling you on Varta...`;

    const result = await getMessaging().sendEachForMulticast({
      tokens: tokens.map((t: any) => t.token),
      notification: { title, body },
      data: { callId, conversationId: conversationId || "", type: "incoming_call", callType: callType || "voice" },
    });
    res.json({ sent: result.successCount, failed: result.failureCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EMAIL NOTIFICATIONS (via Resend) ────────────────────────────────────────

function escapeHtml(text: string) {
  return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "Varta <noreply@varta.app>", to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(await res.text());
}

app.post("/api/notifyAdminSignup", async (req, res) => {
  const { userName } = req.body || {};
  const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || "http://localhost";
  try {
    const adminEmail = process.env.ADMIN_EMAIL || "yash.makwana.b@gmail.com";
    await sendEmail(
      adminEmail,
      `Approval Required: New user ${escapeHtml(userName || "A new user")}`,
      `<h2>New User Registration</h2><p><strong>${escapeHtml(userName || "A new user")}</strong> just signed up for Varta.</p><a href="${appUrl}/admin" style="background:#1E88C7;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;">Go to Admin Dashboard</a>`,
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/notifyUserApproved", requireAuth, async (req, res) => {
  const { userId, name } = req.body || {};
  const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || "http://localhost";
  try {
    const { rows } = await db.query("SELECT * FROM profiles WHERE id = $1", [userId]);
    if (!rows[0]) return res.status(404).json({ error: "User not found" });
    // Get email from Firebase
    const fbUser = await getAuth().getUser(userId);
    if (!fbUser.email) throw new Error("No email for user");
    await sendEmail(
      fbUser.email,
      "Your Varta Account is Approved! 🎉",
      `<h2>Account Approved! 🎉</h2><p>Hi <strong>${escapeHtml(name || "Friend")}</strong>,</p><p>Your Varta account has been approved!</p><a href="${appUrl}/login" style="background:#25D366;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Log In to Varta</a>`,
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/sendInviteEmail", async (req, res) => {
  const { inviteCode, inviterName, toEmail, customMessage } = req.body || {};
  const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || "https://varta.app";
  const joinLink = `${appUrl}/join?token=${encodeURIComponent(inviteCode)}`;
  try {
    await sendEmail(
      toEmail,
      `${escapeHtml(inviterName)} invited you to join Varta`,
      `<h2>You're invited to Varta!</h2><p><strong>${escapeHtml(inviterName)}</strong> invited you to join Varta — the secure chat & video app.</p>${customMessage ? `<blockquote>"${escapeHtml(customMessage)}"</blockquote>` : ""}<a href="${joinLink}" style="background:#1E88C7;color:white;padding:16px 36px;border-radius:14px;text-decoration:none;font-weight:bold;">Accept Invitation & Join</a>`,
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Internal push helper ─────────────────────────────────────────────────────
async function _triggerMessagePush(convId: string, senderId: string, senderName: string, preview: string) {
  if (!getApps().length) return;
  const { rows: members } = await db.query(
    "SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2",
    [convId, senderId],
  );
  const recipientIds = members.map((m: any) => m.user_id);
  if (!recipientIds.length) return;
  const { rows: tokens } = await db.query("SELECT token FROM push_tokens WHERE user_id = ANY($1)", [recipientIds]);
  if (!tokens.length) return;
  await getMessaging().sendEachForMulticast({
    tokens: tokens.map((t: any) => t.token),
    notification: { title: senderName, body: preview || "New message" },
    data: { conversationId: convId, type: "message" },
    webpush: { notification: { title: senderName, body: preview || "New message", icon: "/favicon.svg" }, fcmOptions: { link: "/chat" } },
  }).catch(() => {});
}

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: err?.message || "Internal server error" });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[Varta Backend] Running on port ${PORT}`);
  console.log(`[WebSocket] WS server ready at /ws`);
  console.log(`[Zero-Cost Safeguard] GCP Always Free Lifetime Host Active`);
  console.log(`[Domain] APP_URL = ${process.env.APP_URL || "http://localhost"}`);
});
