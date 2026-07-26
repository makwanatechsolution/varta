# Changelog

All notable changes to the Varta platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.4.0] - 2026-07-26

### Added
- **Unified Dark Mode System**: Enforced dark theme mode (`class="dark"`) on `<html>` by default in `index.html` and `main.tsx`. Resolved light/dark background mismatches across Settings, Admin Panel, Chats, Calls, and Status screens.
- **Real Device Detection**: Implemented dynamic user agent parsing (`navigator.userAgent`) in `DevicesSettingsPane` to show real browser and operating system details instead of hardcoded placeholder device text.
- **QR Code Device Linker**: Added an interactive **"Link a Device / Scan QR Code"** modal and camera scanner simulator in Settings to pair secondary browser/desktop sessions.
- **Direct Password Change Form**: Added password update capability directly inside **Settings → Account & Security** using `supabase.auth.updateUser({ password })`.
- **SPA Rewrite Configuration**: Added `vercel.json` rewrite rules (`/(.*)` -> `/index.html`) and `public/_redirects` to support seamless page reloads on single-page app (SPA) sub-routes (`/login`, `/admin`, `/pending`, `/settings`).
- **Direct Invite Link Card**: Added an instant **Copy Shareable Link** card to `InvitePage.tsx` with a one-click copy button.

### Fixed
- **Realtime Chat Flickering**: Updated `useConversations()` and `useMessages()` in `useChat.ts` to support silent background reloading (`load(true)`). WebSockets events no longer clear loading state or cause the chat scroll position to jump down during live messaging.
- **Profile Settings Layout**: Resolved button overlap issue in `ProfileSettingsPane` header by aligning **My QR Code** and **Save Changes** in a dedicated flex layout.
- **Audio Context Unlocking**: Added automatic user gesture unlock listeners (`click`, `touchstart`, `keydown`) in `VartaAudioEngine` to unlock WebRTC `AudioContext` on initial interaction.

### Security
- Added SQL migration `006_admin_full_permissions.sql` with `is_admin()` Security Definer function and admin policies for `public.profiles` and `public.admin_settings`.
- Enforced complete serverless secret isolation for Resend and Firebase credentials under `/api/*`.

---

## [2.0.0] - 2026-07-20

### Added
- Enterprise Admin Control Center with 5 dedicated management tabs (Overview, Pending Approvals, User Directory, Create User, Admin Settings).
- WebRTC 1-on-1 and Group Video Calling engine integrated with Metered TURN relays.
- Real-time disappearing status stories and status viewer.
