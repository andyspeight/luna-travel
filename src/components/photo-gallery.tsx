'use client';

/**
 * PhotoGallery — a simple horizontal, swipeable strip of product photos.
 * Used on hotel and experience detail pages for off-platform bookings (where
 * the agency has uploaded their own images). Renders nothing when empty.
 */
export function PhotoGallery({ photos, className }: { photos?: string[]; className?: string }) {
  if (!photos || photos.length === 0) return null;
  return (
    <div
      className={['flex gap-2 overflow-x-auto scrollbar-none snap-x snap-mandatory', className]
        .filter(Boolean)
        .join(' ')}
    >
      {photos.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${src}-${i}`}
          src={src}
          alt=""
          className="h-44 w-64 flex-shrink-0 snap-start rounded-2xl object-cover border border-line-light bg-surface-3"
          loading="lazy"
        />
      ))}
    </div>
  );
}
