import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center">
        <Badge variant="neutral" className="mb-4">
          Phase 1 — Project Foundation
        </Badge>
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-950 sm:text-6xl">
          WSNexa
        </h1>
        <p className="mt-4 text-xl font-medium text-zinc-600">
          Smart Hospitality. Simplified.
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-500">
          The next-generation multi-tenant Hospitality Operating System for restaurants, cafes, hotels, resorts, and food courts.
        </p>

        <div className="mt-10 flex items-center justify-center gap-x-4">
          <Link href="/dashboard">
            <Button size="lg">Explore Dashboard</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg">
              Sign In Placeholder
            </Button>
          </Link>
        </div>
      </div>

      {/* Design System Tokens Showcase */}
      <div className="mt-20">
        <h2 className="mb-6 text-center text-lg font-semibold text-zinc-900">
          Design System & Status Tokens Demonstration
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-900">Primary Action</span>
              <Badge variant="neutral">Active</Badge>
            </div>
            <p className="text-xs text-zinc-500">
              Clean monochrome primary action buttons and neutral cards.
            </p>
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-900">Kitchen Operations</span>
              <Badge variant="success">Ready</Badge>
            </div>
            <p className="text-xs text-zinc-500">
              Restrained success token for kitchen prep and served states.
            </p>
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-900">Cashier POS</span>
              <Badge variant="warning">Pending</Badge>
            </div>
            <p className="text-xs text-zinc-500">
              Controlled warning state for pending cashier settlements.
            </p>
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-900">Order Security</span>
              <Badge variant="destructive">Cancelled</Badge>
            </div>
            <p className="text-xs text-zinc-500">
              Clear destructive alert token for rejected or cancelled requests.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
