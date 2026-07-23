# Varta

WhatsApp calls · Telegram groups · Instagram stories — at **$0/month**.

## Tech stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage)
- **Hosting:** Firebase Hosting (custom GoDaddy domain)
- **Push:** Firebase Cloud Messaging
- **Deploy:** GitHub Actions on push to `main`

## 🚀 Ultimate Setup Guide

You are seeing "No connection to database" because you need to link this app to your own free Supabase project.

### 1. Database & Authentication Setup
1. Create a free account at [Supabase](https://supabase.com).
2. Create a new project.
3. Go to **Project Settings -> API**.
4. Copy the `Project URL` and `anon public` key.
5. In your code folder, duplicate the `.env.example` file and rename it to `.env`.
6. Paste your URL and Anon Key into the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` variables.

### 2. Enable Google Login
Google Login requires configuration directly in your Supabase dashboard (no extra code needed!):
1. In Supabase, go to **Authentication -> Providers**.
2. Click **Google** and toggle "Enable Google".
3. You will need to provide a **Client ID** and **Client Secret**.
4. To get these, go to the [Google Cloud Console](https://console.cloud.google.com/), create a project, and navigate to **APIs & Services -> Credentials**. Create OAuth Client ID (Web Application) and paste the Supabase Callback URL there.
5. Paste the ID and Secret back into Supabase and hit Save.

### 3. Enable Voice Messages & Media (Storage)
For voice notes and image sharing to work, you must create a storage bucket:
1. In Supabase, go to **Storage**.
2. Click **New Bucket** and name it exactly `media`.
3. Mark it as **Public** so audio and images can be read.
4. Run the SQL schema to enable database rules: copy everything inside `supabase/migrations/001_initial_schema.sql` and paste it into the Supabase **SQL Editor** and run it.

### 4. Run the App
```bash
npm install
npm run dev
```

For production deployment via Vercel/GitHub Actions, ensure you add these exact `.env` variables into your GitHub Repository Secrets and Vercel Environment Variables.

## Project structure

```
src/
├── components/   # UI (chat, calls, stories, layout)
├── contexts/     # Auth
├── hooks/        # presence, chat, calling, stories, GIFs, reactions
├── lib/          # Supabase + Firebase clients
├── pages/        # Routes
└── types/        # TypeScript types
supabase/migrations/  # Database schema + RLS
functions/            # Firebase Cloud Functions
.github/workflows/    # CI/CD deploy
```
