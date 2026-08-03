# WSNexa — Authentication Security & Threat Model

> **Version:** 1.0.0 (Phase 2)  
> **Classification:** Internal Security Standard  

---

## 1. Threat Matrix & Mitigations

| Vulnerability Vector | Threat Description | Mitigation Strategy |
| :--- | :--- | :--- |
| **Open Redirect via Auth Callback** | Malicious actor passes external `next` URL in `/auth/callback?next=https://attacker.com` to steal session codes. | `getSafeRedirectUrl` function rejects protocol-relative URLs (`//`), URLs containing `://` or `:\`, and non-relative paths. |
| **Account Enumeration** | Attacker probes `/forgot-password` or `/register` to harvest valid user emails. | `forgotPasswordAction` returns uniform generic success message regardless of email existence in database. |
| **Privilege Escalation via Profile Update** | User submits JSON payload to modify `account_status` or `onboarding_status` to bypass restrictions. | 1. RLS restricts update to `id = auth.uid()`. <br>2. `updateProfileAction` explicitly white-lists self-editable fields (`first_name`, `last_name`, `phone`, `avatar_url`, `preferred_language`). |
| **Service Role Key Exposure** | Developer accidentally imports `admin.ts` into a Client Component (`'use client'`). | `import 'server-only'` at top of `src/lib/supabase/admin.ts` causes Next.js build compiler to throw an error immediately. |
| **Weak Passwords** | Brute force or dictionary attacks on user accounts. | Zod `passwordSchema` enforces minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, and 1 number. |
| **Bypassing Client Authorization** | Attacker manipulates frontend state to view `/dashboard`. | Middleware & Server Components verify authentication independently via server-side `supabase.auth.getUser()`. |

---

## 2. Security Verification Standard

All authentication code changes must pass the automated security suite:

```bash
npm run verify:auth
```
