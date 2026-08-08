# Public Venue Profile Specification

## Profile Schema
Public venue profiles are stored in `public.venue_public_profiles`:
- `id`: UUID
- `business_id`: UUID (One profile per business)
- `slug`: Text (Unique URL-friendly slug, e.g., `aura-resort`)
- `display_name`: Text
- `short_description`: Text (Max 300 chars)
- `description`: Text (Max 2000 chars)
- `venue_type`: Enum (`restaurant`, `hotel`, `cafe`, `resort`, `villa`, `guest_house`, `food_court`, `cloud_kitchen`, `other`)
- `logo_url` & `cover_image_url`: Text
- `phone_public`, `email_public`, `website_url`, `address_public`: Text
- `city`, `country`, `latitude`, `longitude`: Location metadata
- `price_level`: Integer (1-4)
- `is_published`: Boolean
- `is_accepting_orders`: Boolean
- `featured_branch_id`: UUID

## Management Rules
- Business Owners / Managers with `venue_profile.manage` permission manage profiles at `/dashboard/venue-profile`.
- Minimum required fields before publishing: `display_name`, `venue_type`, `city`, `address_public`.
- Unpublished drafts return 404 for public guests.
