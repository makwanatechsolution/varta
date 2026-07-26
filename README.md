# 💬 Varta — Enterprise Realtime Communication Platform

> Enterprise-grade, multi-tenant real-time communication platform — WhatsApp voice/video calls, Telegram channels, and Instagram status stories. Built with zero-cost serverless architecture (**$0/month infrastructure cost**).

[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Realtime-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployment-000000?style=flat&logo=vercel&logoColor=white)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture Overview](#-architecture-overview)
- [Security & Compliance](#-security--compliance)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Database Setup & Migrations](#-database-setup--migrations)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

- 💬 **Zero-Flicker Realtime Chat:** Instant messaging with typing indicators, message reactions, reply threads, and emoji picker.
- 📞 **HD WebRTC Voice & Video Calls:** Encrypted 1-on-1 and group calls powered by WebRTC with Metered STUN/TURN traversal.
- 📸 **Status Stories:** Disappearing media & text status updates with view tracking.
- 👥 **Group Channels & Moderation:** Public & private group channels with role-based access controls.
- 🎙️ **Voice Notes & Media Sharing:** Built-in audio recorder, image sharing, and GIF integration (Giphy & Tenor).
- 🛡️ **Admin Approval Pipeline:** Enterprise user onboarding pipeline with pending approval queues and user controls.
- 🔐 **Account & Security Controls:** Direct password change, 2FA TOTP enrollment, App Lock PIN passcode, and session revocation.
- 📱 **QR Code Device Linking:** Pair secondary browser and desktop sessions via QR code scanning.
- 🔔 **Push & Email Alerts:** Firebase Cloud Messaging (FCM Web Push) and rich HTML email notifications via Resend.
- 🌐 **Single Page App Resilience:** `vercel.json` SPA rewrite rules supporting seamless page reloads on all sub-routes.

---

## 🛠️ Tech Stack

| Tier | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | React 19, Vite 8, TypeScript 5.x, Tailwind CSS v4, Framer Motion, Lucide Icons | Client-side reactive interface |
| **Database & Auth** | Supabase (PostgreSQL 15, GoTrue Auth, Realtime WebSockets, Storage) | Primary datastore, auth, & pub/sub broker |
| **Serverless Backend** | Vercel Serverless Node.js Functions (`/api/*`) | Protected backend email, push & alert dispatch |
| **WebRTC Media** | WebRTC + Metered Video Free Tier TURN Relay | Peer-to-peer audio/video streaming |
| **Push & Email** | Firebase FCM (Web Push) + Resend API | Multi-channel user notifications |

---

## 🏗️ Architecture Overview

Varta uses a decoupled serverless architecture:

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
│  - PostgreSQL 15 Engine      │    │  - /api/sendInviteEmail                 │
│  - Realtime Pub/Sub Broker   │    │  - /api/notifyAdminSignup               │
│  - Storage Buckets (Media)   │    │  - /api/sendMessagePush                 │
│  - Row Level Security (RLS)  │    │  - /api/sendCallPush                    │
└──────────────────────────────┘    └─────────────────────────────────────────┘
```

For complete architectural details, read [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 🛡️ Security & Compliance

- **Row Level Security (RLS)**: Enforced across 100% of database tables via SQL policies and `is_admin()` Security Definer functions.
- **Serverless Secret Isolation**: Third-party API keys (`RESEND_API_KEY`, `FIREBASE_SERVER_KEY`) reside exclusively in serverless Node.js functions. Zero sensitive keys exposed in front-end bundles.
- **SOC 2 Type II Alignment**: Prepared against access control, authorization, and audit logging standards.

For detailed security guidelines, read [SECURITY.md](SECURITY.md).

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+ installed
- A free [Supabase](https://supabase.com) account

### 2. Installation & Setup
```bash
git clone https://github.com/makwanatechsolution/varta.git
cd varta
cp .env.example .env.local
npm install
```

### 3. Run Local Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## ⚙️ Environment Variables

Configure `.env.local` with your Supabase credentials:

```env
# Frontend Environment Variables (Vite)
VITE_SUPABASE_URL="https://your-supabase-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Serverless API Environment Variables (Vercel Edge Config)
RESEND_API_KEY="re_123456789"
FIREBASE_SERVER_KEY="AAAA..."
```

---

## 🗄️ Database Setup & Migrations

Execute SQL migrations in `supabase/migrations/` in the following order:

1. `001_initial_schema.sql` — Core database tables and storage RLS
2. `002_admin_approval.sql` — Admin approval pipeline
3. `003_calls_schema.sql` — WebRTC signaling tables
4. `004_fix_profile_trigger.sql` — Automatic profile creation triggers
5. `005_fix_rls_infinite_recursion.sql` — RLS optimization
6. `006_admin_full_permissions.sql` — Admin Security Definer policies & settings table

---

## 📁 Project Structure

```
varta/
├── api/                    # Vercel Serverless API Functions (email, push, admin alerts)
├── public/                 # Static assets, service workers (_redirects)
├── src/
│   ├── components/        # React UI components (chat, calling, stories, settings)
│   ├── contexts/          # Auth & WebRTC Calling context providers
│   ├── hooks/             # Custom hooks (realtime chat, presence, call signaling)
│   ├── lib/               # Supabase client, WebAudio engine initialization
│   ├── pages/             # Route pages (Chat, Admin, Settings, Invite)
│   └── types/             # TypeScript schema interfaces
├── supabase/
│   └── migrations/        # PostgreSQL SQL migration scripts
├── vercel.json            # Single Page Application SPA rewrite rules
├── ARCHITECTURE.md        # Architecture & System Design Document
├── SECURITY.md            # Security Policy & SOC2 Compliance Document
├── CONTRIBUTING.md        # Contribution & Commit Standards
└── CHANGELOG.md           # Version Release Log
```

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
