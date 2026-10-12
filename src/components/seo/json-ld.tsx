import React from 'react';

/**
 * Serializes data to JSON-LD string while escaping '<' characters
 * to prevent script tag breakout and HTML injection vulnerabilities.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

interface JsonLdProps {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}

/**
 * Server Component for rendering Schema.org JSON-LD scripts.
 *
 * Implements XSS defense by escaping '<' characters to prevent script tag breakout.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(data),
      }}
    />
  );
}
