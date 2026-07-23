# 🚀 Varta – Complete Setup & Zero-Cost Deployment Guide

This guide provides step-by-step instructions to set up, configure, deploy, and run the complete **Varta** application. The entire stack is architected to run on 100% free tiers without requiring credit card details or incurring unexpected costs.

---

## 🏗️ Stack Architecture Overview

| Component | Provider | Tier / Free Quota |
| :--- | :--- | :--- |
| **Frontend & API Hosting** | [Vercel](https://vercel.com/) | Hobby (100% Free, Serverless Functions) |
| **Database & Auth & Realtime** | [Supabase](https://supabase.com/) | Free (Postgres, Auth, Storage, WebSockets) |
| **Push Notifications** | [Firebase FCM](https://console.firebase.google.com/) | Spark (Free Web Push notifications) |
| **WebRTC TURN Server** | [Metered Video](https://www.metered.ca/stun-turn) | Free (50 GB/month TURN bandwidth) |
| **Transactional Email** | [Resend](https://resend.com/) | Free (3,000 emails/month) |
| **GIF Search** | [Tenor](https://developers.google.com/tenor) / [Giphy](https://developers.giphy.com/) | Free Developer APIs |
| **CI/CD** | [GitHub Actions](https://github.com/features/actions) | Free (Automated deployment to Vercel) |

---

## 1. Supabase Setup (Database, Auth, Storage & Migrations)

### A. Create Project & Obtain Keys
1. Sign up / Log into [Supabase](https://supabase.com/).
2. Create a new project (e.g., `varta-app`).
3. Go to **Project Settings -> API** and copy:
   - **Project URL** (`VITE_SUPABASE_URL`)
   - **anon / public key** (`VITE_SUPABASE_ANON_KEY`)
   - **service_role secret key** (`SUPABASE_SERVICE_ROLE_KEY`)

### B. Run SQL Migrations (In Exact Order)
Go to the **SQL Editor** in your Supabase dashboard and execute all SQL files from `supabase/migrations/` **in exact numerical order**:

1. **`001_initial_schema.sql`** — Creates core tables (`profiles`, `conversations`, `messages`, `presence`, `statuses`, `meetings`), RLS policies, and utility functions.
2. **`002_admin_approval.sql`** — Adds admin approval status columns and approval request functions.
3. **`002_feature_additions.sql`** — Adds invitations table, meeting permissions, and message reaction structures.
4. **`003_fix_500_error.sql`** — Solves function execution errors and updates trigger handlers.
5. **`004_fix_infinite_recursion.sql`** — Fixes RLS recursive query loops on conversation lookups.
6. **`005_ultimate_rls_fix.sql`** — Applies finalized, high-performance RLS access controls across all tables.

### C. Enable Realtime Replication
1. Go to **Database -> Publications** in Supabase.
2. Click on `supabase_realtime`.
3. Ensure all of the following tables are toggled **ON**:
   - `conversations`
   - `messages`
   - `message_read_receipts`
   - `message_reactions`
   - `presence`
   - `invitations`
   - `statuses`
   - `meetings`

### D. Create Media Storage Bucket
1. Go to **Storage -> Buckets** in Supabase.
2. Click **New Bucket**.
3. Set the Name to exactly **`media`**.
4. Enable the **Public** toggle (required for sharing images, voice notes, and avatar uploads).

### E. Grant Yourself Admin Permissions
To access the Admin Panel and approve new user signups, run this query in the Supabase SQL Editor after signing up your initial user account:

```sql
UPDATE profiles
SET role = 'admin', is_approved = true
WHERE email = 'your-email@example.com';
```

---

## 2. Firebase Setup (Web Push Notifications)

Firebase Cloud Messaging (FCM) handles background push notifications when users are offline.

1. Open the [Firebase Console](https://console.firebase.google.com/) and create a project (stay on the free Spark plan).
2. Go to **Project Settings -> General** and click **Add app -> Web (`</>`)**.
3. Register the web app and copy the `firebaseConfig` object values into your `.env`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
4. Go to **Project Settings -> Cloud Messaging -> Web Push certificates**, click **Generate Key Pair**, and copy the public key as `VITE_FIREBASE_VAPID_KEY`.
5. Go to **Project Settings -> Service Accounts**, click **Generate new private key**, and save the JSON file. You will minify and pass this JSON string to Vercel/GitHub Actions as `FIREBASE_SERVICE_ACCOUNT_KEY`.

---

## 3. WebRTC TURN Server (Metered Video)

To connect voice and video calls through firewalls and NATs, a TURN server is required.

1. Register at [Metered Video TURN](https://www.metered.ca/stun-turn) (Free 50 GB/mo tier, no credit card required).
2. Go to your dashboard to obtain your **Metered Domain** and **Secret Key**.
3. Add these credentials to your `.env` and GitHub Secrets:
   - `VITE_TURN_SERVER_URL` = `turn:your-subdomain.metered.live:3478`
   - `VITE_TURN_CREDENTIAL` = `your-secret-key`
   - `VITE_TURN_USERNAME` = `your-username` (or leave blank depending on metered setup)

---

## 4. Transactional Email Setup (Resend)

Resend handles custom HTML user invitations and approval notification emails.

1. Sign up for a free account at [Resend](https://resend.com/).
2. Go to **API Keys** and generate a new API key (`RESEND_API_KEY`).
3. *(Optional)* Verify your custom domain under **Domains** (e.g. `mail.yourdomain.com`). By default, testing mode allows sending to your registered email.

---

## 5. Deployment via Vercel & GitHub Actions

Deployment is automated via GitHub Actions on every push to the `main` branch.

### A. Obtain Vercel Credentials
1. Log into [Vercel](https://vercel.com/) and create a new project linked to your repository.
2. Go to **Account Settings -> Tokens** and generate a personal token (`VERCEL_TOKEN`).
3. Copy the **Project ID** (`VERCEL_PROJECT_ID`) from your Vercel Project Settings.
4. Copy your **Team/Account ID** (`VERCEL_ORG_ID`) from Vercel Account Settings.

### B. Configure GitHub Repository Secrets
Navigate to your GitHub repository -> **Settings -> Secrets and variables -> Actions**, and add the following repository secrets:

#### Vercel Deployment Secrets
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

#### Supabase Secrets
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

#### Firebase Push Secrets
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`
- `FIREBASE_SERVICE_ACCOUNT_KEY` *(Raw single-line JSON string of your Firebase service account file)*

#### WebRTC TURN Secrets
- `VITE_TURN_SERVER_URL`
- `VITE_TURN_CREDENTIAL`
- `VITE_TURN_USERNAME`

#### Third-Party & App Secrets
- `VITE_TENOR_API_KEY`
- `VITE_GIPHY_API_KEY`
- `RESEND_API_KEY`
- `VITE_APP_URL` *(e.g. `https://varta.yourdomain.com`)*

### C. Trigger Deployment
Pushing to the `main` branch automatically triggers `.github/workflows/deploy.yml` to build the app and deploy frontend & serverless API endpoints to Vercel.

---

## 6. Custom Domain Setup (GoDaddy / Custom DNS)

1. In Vercel, open your project -> **Settings -> Domains**.
2. Add your domain (e.g. `varta.yourdomain.com`).
3. Vercel will provide A / CNAME records or Nameservers.
4. Log into GoDaddy (or your DNS provider), open **DNS Management**, and add the specified CNAME/A records pointing to Vercel.
5. Vercel automatically generates an SSL certificate once DNS propagates.

---

## 7. Running Locally

1. Duplicate `.env.example` to `.env` and fill in all variables:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start local development server:
   ```bash
   npm run dev
   ```
4. Access the web app at `http://localhost:5173`.

---

## 🔍 Troubleshooting & FAQ

### Database returns "No connection to database" or RLS 500 error
- Ensure you executed **all 6 migration files** in exact numerical order (`001` through `005`).
- Verify that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` match your Supabase API settings.

### Realtime messages or presence not updating live
- Confirm all 8 required tables are enabled under **Supabase -> Database -> Publications -> `supabase_realtime`**.

### Push notifications fail to send
- Ensure `FIREBASE_SERVICE_ACCOUNT_KEY` is a valid single-line stringified JSON object in your Vercel secrets.
- Verify `VITE_FIREBASE_VAPID_KEY` matches the Web Push certificate generated in Firebase Console.

### WebRTC audio/video call fails on mobile networks
- Ensure `VITE_TURN_SERVER_URL` and `VITE_TURN_CREDENTIAL` are configured correctly with Metered.ca.

### GitHub Actions Error: `Project not found ({"VERCEL_PROJECT_ID":"...", "VERCEL_ORG_ID":"..."})`
- **Cause**: GitHub Repository Secrets `VERCEL_PROJECT_ID` or `VERCEL_ORG_ID` are incorrect, missing `prj_` / `team_` prefixes, or mismatched.
- **Solution**:
  1. Open your project in **Vercel Dashboard -> Settings -> General** and copy the **Project ID** (`prj_...`). Update `VERCEL_PROJECT_ID` in GitHub Secrets.
  2. Open **Vercel Account/Team Settings -> General** and copy the **Team ID / Account ID** (`team_...` or `usr_...`). Update `VERCEL_ORG_ID` in GitHub Secrets.
  3. Alternatively, run `npx vercel link` in your local terminal to generate `.vercel/project.json` which contains the exact `orgId` and `projectId`.

### Why environment variables in GitHub Secrets don't show up in Vercel Dashboard
- **GitHub Secrets** are strictly private variables for GitHub Actions runners and are **never** automatically synced to Vercel or Supabase.
- When Vercel builds your project natively via its GitHub integration (as seen when pushing to `main`), Vercel reads environment variables **only** from **Vercel Dashboard -> Settings -> Environment Variables**.
- To fix missing variables in Vercel deployments, copy your `.env` variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, etc.) directly into **Vercel Dashboard -> Settings -> Environment Variables**.

### Supabase OAuth Error: `{"error":"requested path is invalid"}`
- **Cause**: In Supabase Dashboard -> **Authentication -> URL Configuration**, the **Site URL** or **Redirect URL** was saved without `https://` (e.g., `chat.makwanatechsolution.in`). Without `https://`, Supabase treats it as a relative path under `supabase.co`.
- **Solution**: Always include the full scheme `https://` in Supabase URL Configuration:
  - **Site URL**: `https://chat.makwanatechsolution.in`
  - **Redirect URLs**: `https://chat.makwanatechsolution.in/**`, `http://localhost:*`


