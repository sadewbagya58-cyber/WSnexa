# Unified Account Architecture

## Overview
WSNexa uses a single Supabase `auth.users` identity foundation for all users across the platform. An individual account may act as a Customer, Business Owner, Branch Manager, or Staff Member.

## Account Onboarding Intent vs Server-Verified Membership
1. **Onboarding Intent**: Recorded in `user_profiles.onboarding_intent` during signup (`business_owner`, `branch_manager`, `staff`, `customer`).
2. **Server-Verified Membership**: Server-side record in `business_memberships`. 
3. **Security Principle**: Selecting an onboarding intent in the UI NEVER grants privileged access. Server-side membership checks remain the sole authorization source of truth.

## Workspaces
- **B2B Workspace**: `/dashboard` (Owner, Manager, POS, Kitchen, Waiter)
- **B2C Workspace**: `/customer` (Order History, Favorites, Profile)
