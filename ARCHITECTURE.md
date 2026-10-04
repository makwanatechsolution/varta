# Varta Platform — Enterprise Architecture & System Design Document

**System Version:** 3.0.0 (Google Cloud Platform Always Free Lifetime Release)  
**Architectural Pattern:** Self-Hosted Microservices on GCP Always Free (e2-micro + Swap) + Reactive SPA  
**Target Scale:** Enterprise SaaS Multi-Tenant Support ($0.00 / 0 INR Infrastructure)  

---

## 1. High-Level Architectural Overview

Varta is a modern real-time communication platform designed to deliver unified messaging, WebRTC audio/video calling, disappearing status updates, and administrative workflow controls at zero infrastructure cost (**$0.00 / 0 INR lifetime**).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Varta Web & Desktop SPA                          │
│        React 19 + TypeScript + Tailwind CSS + Framer Motion + WebAudio      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                         HTTPS / WSS   │ (Port 80 / 443)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Nginx Edge Gateway & Reverse Proxy                      │
│             - SSL Termination (Let's Encrypt / Certbot)                     │
│             - Static Client SPA Hosting (/var/www/html)                     │
│             - WebSocket Connection Upgrades (/realtime/v1)                  │
└──────────────┬──────────────────────────────────────────────┬───────────────┘
               │                                              │
    HTTP / REST│ (/api/*)                          HTTP / WSS │ (/auth, /rest, /realtime)
               ▼                                              ▼
┌──────────────────────────────┐              ┌───────────────────────────────┐
│     Varta Express Backend    │              │       Supabase Open Source    │
│  - Firebase FCM Web Push     │              │  - Kong API Gateway           │
│  - Resend Email Dispatch     │              │  - GoTrue Auth Engine         │
│  - Health & Metrics API      │              │  - PostgREST 12 API           │
│  - Disaster Recovery Webhook │              │  - Realtime WebSocket Server  │
└──────────────────────────────┘              │  - Storage API (Media Bucket) │
                                              └──────────────┬────────────────┘
                                                             │
                                                             ▼
                                              ┌───────────────────────────────┐
                                              │      PostgreSQL 15 Engine     │
                                              │  - Complete Schemas (001-006) │
                                              │  - Row Level Security (RLS)   │
                                              │  - Persistent Docker Volume   │
                                              └───────────────────────────────┘
```

---

## 1.1 Zero-Rupee Budget Watchdog & Kill-Switch Architecture

```
                    ┌───────────────────────────┐
                    │ GCP Cloud Billing Budget  │
                    │ Threshold: > 0.0001 INR   │
                    └─────────────┬─────────────┘
                                  │ Every 15 min
                                  ▼
                    ┌───────────────────────────┐
                    │   Cost Watchdog Daemon    │
                    │  (cost_watchdog.sh)       │
                    └─────────────┬─────────────┘
                                  │
                  Is Cost > 0?    │
            ┌─────────────────────┴─────────────────────┐
            ▼ No                                        ▼ Yes (Emergency)
    [Sleep & Continue]                  ┌───────────────────────────────┐
                                        │  STEP 1: Safe Harbor Backup   │
                                        │  - pg_dumpall Database Dump   │
                                        │  - Storage Media Snapshot     │
                                        │  - SHA-256 Hash Verification  │
                                        │  - Offsite Push to GitHub     │
                                        └───────────────┬───────────────┘
                                                        │
                                                        ▼
                                        ┌───────────────────────────────┐
                                        │  STEP 2: Dispatch Webhook     │
                                        │  - Alert Discord/Telegram     │
                                        └───────────────┬───────────────┘
                                                        │
                                                        ▼
                                        ┌───────────────────────────────┐
                                        │  STEP 3: Kill Switch Teardown │
                                        │  - docker compose down -v     │
                                        │  - gcloud compute instances   │
                                        │    delete --delete-disks=all  │
                                        │  - Zero rupees charged!       │
                                        └───────────────────────────────┘
```

---

## 2. Component Subsystems & Responsibilities

### 2.1 Frontend Client Tier (`src/`)
- **App Shell & Router (`src/App.tsx`)**: Configured with React Router v6. Wraps routes with `ProtectedRoute` guards for authentication and admin privileges. Includes SPA routing fallbacks in `vercel.json` (`/(.*)` -> `/index.html`).
- **Authentication Context (`src/contexts/AuthContext.tsx`)**: Manages Supabase session persistence, GoTrue authentication states, automatic profile hydration fallback, and password update routines.
- **Calling Engine (`src/contexts/CallingContext.tsx` & `src/lib/audio.ts`)**: Encapsulates WebRTC peer connection creation (`RTCPeerConnection`), ICE candidate exchange via Supabase Realtime, and WebAudio API unlock gesture listeners (`click`, `touchstart`, `keydown`).
- **Realtime Chat Hook (`src/hooks/useChat.ts`)**: Handles optimistic message mutations and subscribes to `postgres_changes` on `messages` and `conversations` tables with **zero-flicker background updating**.

### 2.2 Serverless API Tier (`api/`)
- **Isolation Boundary**: All sensitive API keys (`RESEND_API_KEY`, `FIREBASE_SERVER_KEY`) reside exclusively in serverless Node.js endpoints running on Vercel.
- **Functions**:
  - `sendInviteEmail.ts`: Generates responsive HTML email invitations via Resend.
  - `notifyAdminSignup.ts`: Alerts workspace admins when new users register.
  - `notifyUserApproved.ts`: Notifies users upon admin approval.
  - `sendMessagePush.ts`: Dispatches FCM push notifications for incoming messages.
  - `sendCallPush.ts`: Triggers high-priority Web Push call ring alerts.

### 2.3 Database & Security Tier (`supabase/migrations/`)
- **Row Level Security (RLS)**: Enforced on 100% of public tables.
- **Security Definer Helpers**: `public.is_admin()` evaluates admin privileges in SQL without incurring infinite recursion loops.
- **Storage Protection**: Media uploads constrained to the authenticated user's ID path inside the `media` storage bucket.

---

## 3. Data Flow Sequences

### 3.1 Real-Time Message Dispatch
```
[User A] -> Typed Message -> Optimistic UI Add (temp-id) -> Supabase Insert
                                                                  │
                                                                  ▼
                                                      PostgreSQL Write
                                                                  │
                                                                  ▼
                                                      Realtime Broadcast (postgres_changes)
                                                                  │
                                                                  ▼
[User B] <- Silent State Append <- Receive WebSockets Payload <-─┘
```

### 3.2 WebRTC Call Establishment
```
[Caller] ─── Create Offer SDP ───> Supabase Realtime Channel ───> [Callee]
[Caller] <── Accept Answer SDP ─── Supabase Realtime Channel <─── [Callee]
[Caller] <══ STUN/TURN Candidate Exchange (Metered Video) ══> [Callee]
                                 │
                   Direct Encrypted P2P Media Stream
```

---

## 4. Security Architecture Matrix

| Security Layer | Implementation Mechanism | Enforcement Point |
| :--- | :--- | :--- |
| **Authentication** | GoTrue JWT Token Exchange with Auto-Refresh | Supabase Auth API |
| **Authorization** | Row Level Security (RLS) + `is_admin()` Security Definer | PostgreSQL Engine |
| **Secret Protection** | Environment Config (`.env` server-side variables) | Vercel Edge Runtime |
| **Input Validation** | Parameterized SQL Queries & HTML Escaping | Frontend & API Endpoints |
| **Transport Encryption** | TLS 1.3 + WebSockets Secure (`wss://`) + WebRTC SRTP | Edge Network & Peer Traversal |

---

## 5. Storage & Scalability Profile
- **Database Indexing**: Primary key indexes on `profiles(id)`, `conversation_members(user_id, conversation_id)`, and `messages(conversation_id, created_at)`.
- **Media Cache Hygiene**: Automatic Purge utilities for temporary GIF searches and media blobs in `StorageSettingsPane`.
