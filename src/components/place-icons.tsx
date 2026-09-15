/**
 * Glyphs for the closed 17-value Highlights icon vocabulary.
 *
 * Airtable authors the icon name as free text, so a typo or a new value the app
 * has not been taught arrives here as null. That case renders NOTHING: a guessed
 * glyph puts a mountain next to a beach highlight and reads like a bug the
 * traveller cannot report, whereas a card with no glyph reads as a design.
 */

import {
  Building,
  Building2,
  Camera,
  Compass,
  Heart,
  Landmark,
  Map,
  Mountain,
  Palmtree,
  Star,
  Snowflake,
  Sun,
  Sunset,
  Umbrella,
  UtensilsCrossed,
  Waves,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type { HighlightIcon } from '@/types/destination-content';

const GLYPHS: Record<HighlightIcon, LucideIcon> = {
  mountain: Mountain,
  sunset: Sunset,
  wine: Wine,
  water: Waves,
  palm: Palmtree,
  city: Building2,
  temple: Landmark,
  beach: Umbrella,
  food: UtensilsCrossed,
  star: Star,
  camera: Camera,
  heart: Heart,
  building: Building,
  map: Map,
  compass: Compass,
  sun: Sun,
  snowflake: Snowflake,
};

export function HighlightIconGlyph({
  icon,
  size = 16,
}: {
  icon: HighlightIcon | null;
  size?: number;
}) {
  if (!icon) return null;
  const Glyph = GLYPHS[icon];
  if (!Glyph) return null;
  return <Glyph size={size} strokeWidth={1.75} aria-hidden />;
}
