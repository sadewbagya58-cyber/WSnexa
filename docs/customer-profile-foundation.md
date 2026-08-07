# Customer Profile Foundation

## Overview
The `customer_profiles` table stores consumer-facing metadata for hospitality guests who create WSNexa accounts.

## Schema
- `user_id`: UUID PRIMARY KEY REFERENCES `auth.users(id)` ON DELETE CASCADE
- `display_name`: TEXT
- `avatar_url`: TEXT
- `phone`: TEXT
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

## Workspace Route
`/customer` provides customer profile settings, active orders placeholders, order history placeholders, and saved venue placeholders.
