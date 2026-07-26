# Varta Platform — Enterprise Architecture & System Design Document

**System Version:** 2.4.0 (Production Enterprise Release)  
**Architectural Pattern:** Serverless Microservices + Real-Time Reactive Single Page Application (SPA)  
**Target Scale:** Enterprise SaaS Multi-Tenant Support  

---

## 1. High-Level Architectural Overview

Varta is a modern real-time communication platform designed to deliver unified messaging, WebRTC audio/video calling, disappearing status updates, and administrative workflow controls at zero infrastructure maintenance overhead.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Varta Web & Desktop SPA                          │
│        React 19 + TypeScript + Tailwind CSS + Framer Motion + WebAudio      │
└──────────────┬──────────────────────────────┬───────────────────────────────┘
               │                              │
    WebSockets │ (Realtime Postgres)          │ HTTPS / REST (Serverless Functions)
               ▼                              ▼
┌──────────────────────────────┐    ┌─────────────────────────────────────────┐
│       Supabase Cloud         │    │      Vercel Serverless API Layer        │
│  - PostgreSQL 15 Engine      │    │  - /api/notifyAdminSignup               │
│  - Realtime Pub/Sub Broker   │    │  - /api/notifyUserApproved              │
│  - Storage Buckets (Media)   │    │  - /api/sendInviteEmail                 │
│  - Built-in GoTrue Auth      │    │  - /api/sendMessagePush                 │
│  - Row Level Security (RLS)  │    │  - /api/sendCallPush                    │
└──────────────────────────────┘    └───────────────────┬─────────────────────┘
               ▲                                        │
               │ Direct Peer Traversal (STUN/TURN)      │ Server-Side Dispatch
               │                                        ▼
┌──────────────┴───────────────┐    ┌─────────────────────────────────────────┐
│     WebRTC Peer Mesh / TURN  │    │        Third-Party Services             │
│   - Metered Video TURN Relay │    │  - Resend Transactional Email API       │
│   - Google Public STUN Relay │    │  - Firebase Cloud Messaging (FCM Push)  │
└──────────────────────────────┘    └─────────────────────────────────────────┘
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
