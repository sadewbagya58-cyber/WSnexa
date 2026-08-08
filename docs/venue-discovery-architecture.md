# Venue Discovery Ecosystem Architecture

## Overview
WSNexa Phase 17 introduces the public Venue Discovery layer. It separates B2B workspace operations (`/dashboard/*`) from B2C customer workspace (`/customer/*`) and public venue discovery (`/explore`, `/venues/*`).

## Component Architecture

```
                                  Anonymous / Customer Visitor
                                                │
                                      ┌─────────┴─────────┐
                                      ▼                   ▼
                                 /explore          /venues/[slug]
                                      │                   │
                                      ▼                   ▼
                         VenueDiscoveryService   VenueReviewService
                                      │                   │
                                      └─────────┬─────────┘
                                                ▼
                                   venue_public_profiles
                                   customer_favorite_venues
                                   venue_reviews
```

## Security & Privacy Principles
1. **Explicit Publication Model**: Only profiles explicitly marked with `is_published = true` are exposed to public visitors and returned in search queries.
2. **Data Boundary**: Financial metrics, audit logs, internal emails, staff rosters, invite tokens, and internal branch notes are strictly isolated and never included in public API schemas.
3. **Table Security Handoff**: Public venue ordering links redirect to `/m/[token]` which continues to enforce table selection and Table PIN security. Discovery does not bypass table verification.
