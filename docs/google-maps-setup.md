# Google Maps API Setup & Environment Configuration Guide

This guide explains how to configure Google Maps API keys for WSNexa location-aware venue discovery and maps.

---

## 1. Environment Variables Overview

WSNexa requires two separate environment variables for Google Maps:

```env
# Client-side Maps JavaScript SDK Rendering
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyCyzFQl8xwuqfFq92r3CrB_F5H26C9FMWI

# Server-side Maps / Geocoding / Directions (Never exposed to browser)
GOOGLE_MAPS_SERVER_API_KEY=AIzaSyAu9raxDFSQN76LwmamETo_-TWEYlwOGac
```

---

## 2. Setting Up Google Cloud Console

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project for your WSNexa deployment.
3. Enable the required Google Maps APIs under **APIs & Services > Library**:
   - **Maps JavaScript API** (required for client map rendering on `/explore` and `/venues/[slug]`).
   - **Geocoding API** (optional, for server-side address geocoding if enabled).

---

## 3. Restricting Browser API Key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)

Because `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is loaded in the browser to render interactive maps:

1. Navigate to **APIs & Services > Credentials**.
2. Edit `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
3. Under **Application restrictions**, select **HTTP referrers (web sites)**.
4. Add your production and staging domains:
   - `https://your-domain.com/*`
   - `https://*.your-domain.com/*`
   - `http://localhost:3000/*` (for local development)
5. Under **API restrictions**, restrict key to **Maps JavaScript API** only.

---

## 4. Restricting Server API Key (`GOOGLE_MAPS_SERVER_API_KEY`)

1. Edit `GOOGLE_MAPS_SERVER_API_KEY` in Google Cloud Console.
2. Under **Application restrictions**, select **IP addresses** (add your server IP) or leave unset for Vercel edge/serverless functions.
3. Under **API restrictions**, select only server APIs (e.g. Geocoding API).
4. **Never prefix this key with `NEXT_PUBLIC_`**.

---

## 5. Local & Production Deployment Setup

### Local Development (`.env.local`)
Add keys to your `.env.local` file:
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_browser_key_here
GOOGLE_MAPS_SERVER_API_KEY=your_server_key_here
```

### Production Deployment (Vercel)
1. Go to **Vercel Project Settings > Environment Variables**.
2. Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (Apply to Production, Preview, Development).
3. Add `GOOGLE_MAPS_SERVER_API_KEY` (Apply to Production, Preview, Development).
4. Redeploy your application.

---

## 6. Graceful Degradation & Fallback Behavior

If `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is missing or unconfigured:
- `/explore` and `/venues/[slug]` automatically degrade to a clean **List-Only View**.
- A friendly banner is displayed: *"Map view is unavailable right now. Browse venues in list view."*
- External Google Maps direction links (`https://www.google.com/maps/dir/?api=1&destination=...`) remain fully functional.
- Zero client JS crashes occur.
