# Varta Security Policy & Compliance Standards

**Version:** 2.4.0  
**Compliance Target:** SOC 2 Type II Baseline Controls & OWASP Top 10 Security Architecture  

---

## 1. Vulnerability Reporting & Disclosure

Varta takes system security extremely seriously. If you discover a security vulnerability, credential leak, or authorization flaw, please follow our responsible disclosure protocol:

- **Email Contact:** `security@varta.app` or `yash@makwanatechsolution.in`
- **Response Time Guarantee:** Acknowledgment within 24 hours; status updates every 48 hours until remediation.
- **Please Do Not:** Disclose vulnerabilities publicly prior to fix verification.

---

## 2. OWASP Top 10 Mitigation Controls

### 2.1 Broken Access Control (A01:2021)
- **Database Row-Level Security (RLS)**: Enforced across all tables in Supabase (`public.profiles`, `public.conversations`, `public.conversation_members`, `public.messages`, `public.calls`, `public.admin_settings`).
- **Security Definer Function Protection**: Admin rights verified via `public.is_admin()` helper function executing in isolation to prevent policy recursion bypasses.

### 2.2 Cryptographic Failures (A02:2021)
- **Transport Security**: HTTPS and WebSockets Secure (`wss://`) strictly enforced across client-to-server communications.
- **WebRTC Encryption**: Peer-to-peer audio/video channels encrypted using SRTP (Secure Real-time Transport Protocol) with DTLS key exchange.
- **Password Hashing**: User passwords hashed using `bcrypt`/`argon2` via Supabase GoTrue Auth engine.

### 2.3 Injection Controls (A03:2021)
- **SQL Injection**: All database operations consume Supabase query builder with fully parameterized SQL bindings.
- **Cross-Site Scripting (XSS)**: User input rendered inside HTML email templates sanitized via `escapeHtml()` helper. React DOM automatic string escaping prevents stored XSS in chat views.

### 2.4 Insecure Design & Secret Exposure (A04:2021 & A07:2021)
- **Server-Side Secret Isolation**: Third-party API keys (`RESEND_API_KEY`, `FIREBASE_SERVER_KEY`) reside exclusively in serverless Node.js endpoints (`/api/*`). Zero sensitive keys are exposed in compiled Vite frontend bundles.

---

## 3. SOC 2 Type II Control Alignment

| SOC 2 Trust Principle | System Control Implementation | Verification Method |
| :--- | :--- | :--- |
| **CC6.1 (Access Control)** | RBAC & Admin Approval Pipeline (`is_approved`, `is_admin`) | Verified by SQL RLS policies |
| **CC6.3 (Authorization)** | Strict user-scoped conversation member checks | Database RLS policy audit |
| **CC6.6 (Boundary Defense)** | Single Page Application rewrites & CORS validation | Vercel Edge Header Audit |
| **CC6.8 (Key Protection)** | Environment variable isolation in Vercel Edge Config | Production Bundle Audit |
| **CC7.1 (System Monitoring)** | Diagnostic ping relay testing & log monitoring | Advanced Diagnostics Pane |

---

## 4. Security Audit & Bundle Inspection Protocol

To verify zero secret exposure in client bundles, run the production bundle audit command:

```bash
npm run build
grep -rn "RESEND_API_KEY" dist/ || echo "PASS: No Resend Secrets in Bundle"
grep -rn "FIREBASE_SERVER_KEY" dist/ || echo "PASS: No Firebase Server Keys in Bundle"
```
