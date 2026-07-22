# Varta – The Zero-Cost Deployment Guide

This document outlines everything you need to set up, deploy, and run the complete Varta application using our AI-architected truly zero-cost stack. We use **Vercel** for hosting and serverless functions to avoid any "pay-as-you-go" credit card requirements.

---

## 🏗️ Architecture Overview

- **Frontend Hosting & Serverless Functions:** [Vercel](https://vercel.com/) (Hobby tier is 100% free, no credit card required).
- **Backend & Database:** [Supabase](https://supabase.com/) (Free tier) providing PostgreSQL, Realtime WebSockets, Storage, and Authentication.
- **Push Notifications:** Firebase Cloud Messaging (FCM) — completely free for push notifications. The logic to trigger notifications runs securely on Vercel.
- **WebRTC TURN Server:** [Metered Video](https://www.metered.ca/stun-turn) (Free tier offers 50 GB/mo TURN usage — **no credit card required**).
- **Transactional Emails:** Resend API (Free tier - 3k emails/month).
- **GIFs:** Tenor & Giphy (Free developer APIs).

---

## 1. Supabase Setup (Database & Realtime)

1. Go to [Supabase](https://supabase.com/) and create a new project.
2. Go to **Project Settings -> API** and get your `Project URL`, `anon public` key, and `service_role` secret key.
3. Add these to your `.env` file (see `.env.example`).
4. Go to the **SQL Editor** in Supabase and run the following files from your `supabase/migrations` folder in order:
   - `001_initial_schema.sql`
   - `002_feature_additions.sql`
5. Go to **Database -> Publications**, edit the `supabase_realtime` publication, and ensure these tables are checked:
   - `conversations`
   - `messages`
   - `message_read_receipts`
   - `message_reactions`
   - `presence`
   - `invitations`
   - `statuses`
   - `meetings`
6. Go to **Storage**, create a new bucket named `media`, and set it to **Public**.

---

## 2. Firebase Setup (Push Notifications ONLY)

We only use Firebase for Cloud Messaging (Web Push). You do not need to upgrade to Blaze.

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a project (stay on the free Spark plan).
2. Go to **Project Settings -> General**, add a Web App, and copy the `firebaseConfig` block. Add these to your `.env` file.
3. Go to **Project Settings -> Cloud Messaging -> Web Push certificates**, generate a key pair, and add it to `.env` as `VITE_FIREBASE_VAPID_KEY`.
4. Go to **Project Settings -> Service Accounts**, click "Generate new private key". Open the downloaded JSON file. You will need to stringify this JSON and add it to your Vercel environment variables as `FIREBASE_SERVICE_ACCOUNT_KEY`.

---

## 3. WebRTC TURN Server (Metered Video)

To allow voice and video calls to connect reliably across restrictive networks (like corporate WiFi or mobile networks), you need a TURN server. We use Metered Video because they offer a generous free tier without requiring a credit card.

1. Go to [Metered Video TURN](https://www.metered.ca/stun-turn).
2. Click **Create Free Account** (no credit card required).
3. Look at your dashboard to find your **Metered Domain** and **Secret Key**.
4. Add these exact credentials to your `.env` (and later, GitHub Secrets):
   - `VITE_TURN_SERVER_URL` = (Your Metered Domain, e.g., `varta.metered.live`)
   - `VITE_TURN_CREDENTIAL` = (Your Secret Key)
   - `VITE_TURN_USERNAME` = *(Leave this completely blank)*

## 4. Transactional Emails (Resend)

To send the beautifully formatted HTML invite emails, we use Resend (free tier includes 3,000 emails per month).

1. Go to [Resend](https://resend.com/) and create a free account.
2. Go to **API Keys** and create a new key.
3. If you want to send emails from your own domain (e.g., `invite@your-godaddy-domain.com`), go to **Domains** and verify your GoDaddy domain. Otherwise, you can use Resend's testing domain.
4. Add the API Key to your `.env` (and GitHub Secrets) as `RESEND_API_KEY`.

---

## 5. Vercel Deployment (via GitHub Actions)

We use GitHub Actions as the single source of truth for deployment and environment variables. You do not need to configure any environment variables in the Vercel Dashboard.

1. **Get Vercel Credentials:**
   - Log into [Vercel](https://vercel.com/) and create a new project (select the empty project or link it initially just to get the IDs).
   - Go to your Vercel Account Settings -> Tokens and generate a `VERCEL_TOKEN`.
   - In your Vercel Project Settings, copy the `ProjectId` (`VERCEL_PROJECT_ID`).
   - In your Vercel Team/Account Settings, copy the `OrgId` (`VERCEL_ORG_ID`).

2. **Add GitHub Secrets:**
   Go to your GitHub repository -> **Settings -> Secrets and variables -> Actions**.
   Add the following repository secrets exactly as named:

   **Vercel Core Credentials:**
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

   **Supabase (Database & Auth):**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

   **Firebase (Push Notifications):**
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_VAPID_KEY`
   - `FIREBASE_SERVICE_ACCOUNT_KEY` *(Paste the minified raw JSON string from your downloaded Firebase private key)*

   **WebRTC TURN (Metered.ca):**
   - `VITE_TURN_SERVER_URL` *(Your Metered Domain, e.g., varta.metered.live)*
   - `VITE_TURN_CREDENTIAL` *(Your Secret Key)*
   - `VITE_TURN_USERNAME` *(Leave this blank or do not add it)*

   **Third-Party Services:**
   - `VITE_TENOR_API_KEY`
   - `VITE_GIPHY_API_KEY`
   - `RESEND_API_KEY`

   **Application Configuration:**
   - `VITE_APP_URL` *(e.g., https://your-godaddy-domain.com)*

3. **Deploy:**
   Whenever you push to the `main` branch, GitHub Actions will securely inject your secrets, build the React app, and deploy the frontend + serverless backend directly to Vercel.

---

## 6. Custom Domain (GoDaddy)

1. In the Vercel dashboard for your project, go to **Settings -> Domains**.
2. Add your GoDaddy domain.
3. Vercel will give you Nameservers or an A/CNAME record.
4. Go to GoDaddy DNS management and update the records to match what Vercel provided.
5. Vercel automatically provisions a free SSL certificate.

---

## 7. Running Locally

Ensure your `.env` file is fully populated using `.env.example` as a template.

```bash
# Install dependencies
npm install

# Start the local development server
npm run dev
```

Visit `http://localhost:5173`. You now have a full-featured, truly zero-cost, massively scalable social app! 🚀
