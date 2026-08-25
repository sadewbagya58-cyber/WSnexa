import { notFound } from 'next/navigation';
import Link from 'next/link';
import { VenueDiscoveryService } from '@/server/services/venue-discovery.service';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const venue = await VenueDiscoveryService.getVenueBySlug(slug);

  if (!venue || !venue.is_published || venue.public_menu_enabled === false) {
    return {
      title: 'Menu Not Found | WSNexa',
    };
  }

  return {
    title: `Menu — ${venue.display_name} | WSNexa`,
    description: venue.short_description || `Browse the menu for ${venue.display_name} on WSNexa.`,
  };
}

export default async function VenuePublicMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const venue = await VenueDiscoveryService.getVenueBySlug(slug);

  if (!venue || !venue.is_published || venue.public_menu_enabled === false) {
    notFound();
  }

  const menuCategories = await VenueDiscoveryService.getVenueFullPublicMenu(
    venue.business_id,
    venue.featured_branch_id
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 font-sans pb-16">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <Link
            href={`/venues/${venue.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-950 transition touch-manipulation min-h-[40px] px-2 rounded-lg hover:bg-zinc-100"
          >
            <span>←</span> Back to Venue Profile
          </Link>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              View-Only Menu
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-8">
        {/* Venue Title & Info */}
        <section className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-600">
                {venue.venue_type.replace('_', ' ')}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
                {venue.display_name}
              </h1>
              <p className="text-xs font-semibold text-zinc-500 mt-1">
                📍 {venue.address_public || venue.city}, {venue.country}
              </p>
            </div>
            {venue.phone_public && (
              <a
                href={`tel:${venue.phone_public}`}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-extrabold text-zinc-900 transition touch-manipulation min-h-[44px]"
              >
                <span>📞</span> Call Venue
              </a>
            )}
          </div>
          <p className="text-xs text-zinc-600 font-medium">
            Browse the active menu for {venue.display_name}. Prices and item availability are maintained directly by venue management.
          </p>
        </section>

        {/* Categories Navigation Bar */}
        {menuCategories.length > 0 && (
          <nav className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {menuCategories.map((cat) => (
              <a
                key={cat.id}
                href={`#cat-${cat.id}`}
                className="shrink-0 px-4 py-2 rounded-2xl bg-white border border-zinc-200 text-xs font-extrabold text-zinc-700 hover:text-zinc-950 hover:border-zinc-300 transition shadow-2xs touch-manipulation min-h-[40px] flex items-center"
              >
                {cat.name} ({cat.items.length})
              </a>
            ))}
          </nav>
        )}

        {/* Menu Items Grouped by Category */}
        {menuCategories.length === 0 ? (
          <div className="bg-white rounded-3xl border border-zinc-200 p-8 text-center space-y-2">
            <div className="text-2xl">📖</div>
            <h3 className="text-sm font-bold text-zinc-900">No Public Menu Items Published</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              This venue has not published active menu items yet. Check back soon or contact the venue directly.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {menuCategories.map((cat) => (
              <section key={cat.id} id={`cat-${cat.id}`} className="space-y-4 scroll-mt-20">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <h2 className="text-lg font-black text-zinc-950 tracking-tight">{cat.name}</h2>
                  <span className="text-xs font-semibold text-zinc-400">{cat.items.length} items</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {cat.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-2xs flex flex-col justify-between gap-3 hover:border-zinc-300 transition"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-extrabold text-sm text-zinc-950 leading-snug">{item.name}</h3>
                          <span className="font-mono font-black text-sm text-zinc-950 shrink-0">
                            ${(item.price_cents / 100).toFixed(2)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-[11px]">
                        <span
                          className={`font-extrabold px-2 py-0.5 rounded ${
                            item.availability_status === 'OUT_OF_STOCK'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {item.availability_status === 'OUT_OF_STOCK' ? 'Currently Unavailable' : 'Available'}
                        </span>
                        <span className="text-zinc-400 font-semibold">View Only</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
