import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'WSNexa — Smart Hospitality. Simplified.';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090b',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          position: 'relative',
          padding: '60px',
        }}
      >
        {/* Subtle background glow */}
        <div
          style={{
            position: 'absolute',
            top: -150,
            left: 350,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(9, 9, 11, 0) 70%)',
          }}
        />

        {/* Brand Tagline Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 20px',
            borderRadius: 999,
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#f59e0b',
            }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: '#fbbf24',
            }}
          >
            Smart Hospitality. Simplified.
          </span>
        </div>

        {/* Brand Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: '-2px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <span>WSNexa</span>
        </div>

        {/* Platform Subtitle */}
        <div
          style={{
            fontSize: 26,
            fontWeight: 500,
            color: '#a1a1aa',
            textAlign: 'center',
            maxWidth: 820,
            lineHeight: 1.4,
            marginBottom: 44,
          }}
        >
          Multi-tenant Operating System for Restaurants, Cafés, Hotels & Hospitality Venues
        </div>

        {/* Core Pillars / Features */}
        <div
          style={{
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: 900,
          }}
        >
          {[
            'Table QR Ordering',
            'Kitchen KDS',
            'Handheld Waiter Hub',
            'Cashier Settlement',
            'Recipe BOM & Inventory',
          ].map((feature) => (
            <div
              key={feature}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 18px',
                borderRadius: 12,
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                fontSize: 14,
                fontWeight: 700,
                color: '#e4e4e7',
              }}
            >
              {feature}
            </div>
          ))}
        </div>

        {/* Footer domain */}
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            color: '#71717a',
            letterSpacing: '1px',
          }}
        >
          <span>wsnexa.app</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
