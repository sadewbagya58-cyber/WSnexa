# WSNexa Reporting Security & Threat Model

## 1. Zero-Trust Access Control
- All reporting endpoints authenticate user session via Next.js server context (`resolveActiveBusinessContext`).
- Branch Manager roles are strictly constrained to their active assigned branch. Cross-branch parameter tampering attempts are rejected with `Forbidden`.
- Business Owner role is required to execute cross-branch comparisons (`get_branch_comparison`).

## 2. Export Security & Formula Injection Neutralization
- CSV and XLSX export cells are passed through `sanitizeExportCell()`.
- Cell strings beginning with dangerous formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically escaped with a leading single quote `'` to prevent formula execution in Microsoft Excel or Google Sheets.

## 3. Data Leakage Prevention
- Reporting payloads never export raw user auth tokens, passwords, HMAC keys, or internal idempotency secrets.
