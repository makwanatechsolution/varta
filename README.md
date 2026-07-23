# 💬 Varta

> Modern, zero-cost real-time communication platform — WhatsApp calls, Telegram groups, and Instagram stories at **$0/month**.

[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Realtime-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployment-000000?style=flat&logo=vercel&logoColor=white)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## ✨ Features

- 💬 **Real-time Chat:** Instant messaging with read receipts, typing indicators, message reactions, and emoji picker.
- 📞 **Voice & Video Calls:** 1-on-1 & group calls powered by WebRTC with STUN/TURN relay for restrictive networks.
- 📸 **Stories & Statuses:** Share disappearing status updates and stories with media attachments.
- 👥 **Groups & Channels:** Public & private group channels with role-based access and invite links.
- 🎙️ **Voice Notes & Media:** Built-in audio recorder, image sharing, and GIF integration (Tenor & Giphy).
- 🛡️ **Admin Approval Workflow:** Secure signup approval pipeline for controlled user onboarding.
- 🔔 **Push & Email Alerts:** Firebase Web Push notifications and rich HTML email invitations via Resend.
- 💰 **100% Free Hosting:** Zero-cost architecture utilizing free tiers of Vercel, Supabase, Firebase, and Metered Video.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite 8, TypeScript, Tailwind CSS v4, Framer Motion, Lucide Icons |
| **Database & Auth** | Supabase (PostgreSQL, Realtime WebSockets, Row Level Security, Storage) |
| **Serverless Backend** | Vercel Serverless Functions (`/api/*`) |
| **Push Notifications**| Firebase Cloud Messaging (FCM Web Push) |
| **Email Delivery** | Resend API |
| **WebRTC Relay** | Metered Video Free Tier (50 GB/mo TURN bandwidth) |
| **CI/CD & Hosting** | GitHub Actions + Vercel Production Deployment |

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+ installed
- A free [Supabase](https://supabase.com) account

### 2. Environment Setup
Clone the repository and copy the environment template:

```bash
git clone https://github.com/makwanatechsolution/varta.git
cd varta
cp .env.example .env
```

Fill in your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. See [SETUP.md](SETUP.md) for full configuration details.

### 3. Database Migration
In your Supabase project's **SQL Editor**, execute the migration scripts located in `supabase/migrations/` in the following exact order:

1. `001_initial_schema.sql` — Core database tables, triggers, and storage RLS
2. `002_admin_approval.sql` — Admin approval and user status controls
3. `002_feature_additions.sql` — Feature extensions (invitations, meetings, reactions)
4. `003_fix_500_error.sql` — Database function & trigger error handling
5. `004_fix_infinite_recursion.sql` — RLS policy recursion optimization
6. `005_ultimate_rls_fix.sql` — Finalized access control policies

Also create a public storage bucket named **`media`** under **Storage -> Buckets**.

### 4. Run Development Server

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📖 Deployment Guide

For step-by-step instructions on setting up free services (Supabase, Firebase Push, Metered TURN, Resend, Vercel, and custom domain setup via GoDaddy), read the complete [SETUP.md](SETUP.md).

---

## 📁 Project Structure

```
varta/
├── api/                    # Vercel Serverless API Functions (email, push, admin alerts)
├── public/                 # Static assets & service workers (firebase-messaging-sw.js)
├── src/
│   ├── components/        # React UI components (chat, calling, stories, settings)
│   ├── contexts/          # React Context providers (Auth, Theme, Sound)
│   ├── hooks/             # Custom hooks (presence, chat, calls, stories, reactions)
│   ├── lib/               # Supabase & Firebase client initialization
│   ├── pages/             # Route pages (Chat, Admin, Auth, Meetings)
│   └── types/             # TypeScript type definitions
├── supabase/
│   └── migrations/        # Sequential PostgreSQL migration scripts
└── .github/workflows/     # CI/CD workflow for automated Vercel deployment
```

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
