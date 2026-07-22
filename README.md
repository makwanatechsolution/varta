# Varta

WhatsApp calls · Telegram groups · Instagram stories — at **$0/month**.

## Tech stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage)
- **Hosting:** Firebase Hosting (custom GoDaddy domain)
- **Push:** Firebase Cloud Messaging
- **Deploy:** GitHub Actions on push to `main`

## Setup

1. Copy `.env.example` → `.env` and fill in keys
2. Run Supabase migration: `supabase/migrations/001_initial_schema.sql`
3. `npm install && npm run dev`
4. For production: configure Firebase + GitHub secrets, push to `main`

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full feature maturity roadmap.

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
