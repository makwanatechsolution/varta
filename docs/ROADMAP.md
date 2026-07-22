# Varta — Zero-Cost Stack & Feature Roadmap

**Location:** `D:\Yash\Varta Application`

Unified messaging app combining **WhatsApp** (calls, DMs), **Telegram** (groups/channels), and **Instagram** (24h stories/status).

## Stack ($0/month)

| Layer | Service |
|---|---|
| Database, Auth, Realtime, Storage | Supabase (free tier) |
| Frontend hosting + SSL | Firebase Hosting (GoDaddy domain) |
| Push notifications | Firebase Cloud Messaging |
| Server functions | Firebase Cloud Functions |
| TURN (WebRTC NAT) | GCP Always-Free e2-micro + coturn |
| GIF search | Tenor + Giphy free API keys |
| CI/CD | GitHub Actions → `firebase deploy` |

## Quick start

```bash
cp .env.example .env
# Fill in Supabase + Firebase keys

npm install
npm run dev
```

### Supabase setup
1. Open Supabase SQL Editor
2. Run `supabase/migrations/001_initial_schema.sql`
3. Copy project URL + anon key to `.env`

### Firebase setup
1. Create Firebase project → enable Hosting, Cloud Messaging, Functions
2. Add custom domain in Firebase Hosting → point GoDaddy DNS (TXT + A records)
3. Copy web app config to `.env`
4. Set GitHub secrets for CI deploy (see `.github/workflows/deploy.yml`)

### Deploy
```bash
npm run build
firebase deploy
```
Or push to `main` — GitHub Actions deploys automatically.

---

## Feature maturity levels

### A. Presence / Online Status
| Level | Status | What it means |
|---|---|---|
| 0 | ✅ | `last_seen` on login/logout |
| 1 | ✅ | 30s heartbeat, header shows online/last seen |
| 2 | ✅ | Live pulse-ring via Supabase presence channel |
| 3 | 🔲 | Away/Busy/DND states with colored rings |
| 4 | 🔲 | Custom status messages + privacy controls |

### B. Calling (WhatsApp-style)
| Level | Status | What it means |
|---|---|---|
| 0 | ✅ | WebRTC + Supabase signaling scaffold |
| 1 | ✅ | TURN config + cross-network calls |
| 2 | ✅ | Mute/camera/speaker, incoming call UI |
| 3 | 🔲 | Call history, reconnect, screen share |
| 4 | 🔲 | Group calls, blur, one-tap callback |

### C. Meetings (Teams-style)
| Level | Status | What it means |
|---|---|---|
| 0 | 🔲 | Ad-hoc group call from group chat |
| 1 | 🔲 | Scheduled meetings + join links |
| 2 | 🔲 | Waiting room, raise hand |
| 3 | 🔲 | Screen share, in-meeting chat, recording |
| 4 | 🔲 | AI meeting summary |

### D. Message Reactions
| Level | Status | What it means |
|---|---|---|
| 0 | ✅ | Fixed emoji set, stored in DB |
| 1 | ✅ | Live sync via Realtime |
| 2 | ✅ | Own reaction highlighted, who reacted |
| 3 | 🔲 | Full emoji picker + frequently used |

### E. GIF Feature
| Level | Status | What it means |
|---|---|---|
| 0 | ✅ | Tenor search in composer |
| 1 | ✅ | Debounced search + trending default |
| 2 | ✅ | Giphy merged + deduplicated |
| 3 | ✅ | Streaming results, outage-resilient |

### F. Status (Instagram Stories)
| Level | Status | What it means |
|---|---|---|
| 0 | ✅ | Post text/photo status |
| 1 | 🔲 | 24h auto-expiry job |
| 2 | ✅ | Story rings + full-screen viewer |
| 3 | 🔲 | Viewer list, replies as DM |
| 4 | 🔲 | Close friends + quick reactions |

**Presentable = Level 2 on all features. Marketing vs WhatsApp/Teams/Instagram = Level 3.**
