# WSNexa Phase 8 — Table QR Code & Public Digital Menu Architecture

## Overview
Phase 8 introduces the secure QR code generation system and browse-only public digital menu for WSNexa hospitality SaaS. Each dining table in an active branch can be assigned a unique, cryptographically random, non-guessable QR token.

---

## 1. Token Security & Cryptographic Lifecycle
- **Entropy:** 256 bits of URL-safe Base64URL entropy via Node `crypto.randomBytes(32)`.
- **Database Hashing:** The raw token is **NEVER** stored in the database. Only its `SHA-256` digest (`token_hash`) is persisted in `public.table_qr_codes`.
- **Public URL Format:** `https://w-snexa.vercel.app/m/[raw_token]`
- **Prefix:** Safe 8-character prefix stored as `token_prefix` for administrative reference and dashboard display.

---

## 2. Public Menu Authorization & Resolution
- **Route:** `/m/[raw_token]`
- **Authentication:** Unauthenticated public guest access.
- **RPC:** `resolve_public_table_menu(p_token_hash TEXT)`
- **Security Definer:** Computes `SHA-256(raw_token)` server-side, validates token activity, table status, service area status, branch status, and business status before returning a safe, filtered JSON projection of public categories, menu items, and modifier options.
- **Hidden Items & Archived Data:** Items marked with `availability_status = 'hidden'` or deleted/archived records are strictly excluded from the public JSON projection.

---

## 3. QR Lifecycle Management
1. **Generation:** Business Owners and assigned Branch Managers can generate a QR code for an active table.
2. **Regeneration:** Generating a new QR code immediately revokes the previous token version (`is_active = false`, `revoked_at = now()`) and increments `version`.
3. **Revocation/Disable:** Setting `is_active = false` causes the public URL to instantly return a generic `INVALID_QR` error page without leaking internal tenant information.

---

## 4. Scan Analytics & Privacy
- Every scan attempt (valid or invalid) records an event entry in `public.qr_scan_events`.
- Client IP addresses are anonymized via SHA-256 hashing (`hashClientIp`). Raw IP addresses and full device fingerprints are never stored.

---

## 5. Exports
- **Single Printable Card:** A5/A6 printable card view at `/dashboard/tables/[table_id]/qr`.
- **Bulk QR Sheet:** A4 printable sheet at `/dashboard/tables/qr` for batch printing all table QR codes across a branch or service area.
