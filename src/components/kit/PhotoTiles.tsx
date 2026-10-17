'use client';

import { cn } from '@/lib/utils';
import { Plus } from '@/components/icons';

export interface PhotoTile {
  label: string;
}

export interface PhotoTilesProps {
  photos: PhotoTile[];
  addLabel: string;
  onAdd: () => void;
}

/**
 * Three-column photo grid (mockup `.photos`): an "Add photo" tile first,
 * then one tile per photo with its label.
 */
export function PhotoTiles({ photos, addLabel, onAdd }: PhotoTilesProps) {
  return (
    <div
      data-kit="photo-tiles"
      className="grid grid-cols-3 gap-2 py-1"
    >
      <button
        type="button"
        onClick={onAdd}
        className={cn(
          'aspect-square rounded-xl bg-surface',
          'ring-1 ring-inset ring-line-strong',
          'flex flex-col items-center justify-center gap-1',
          'cursor-pointer text-ink font-semibold text-[13px]',
          'min-h-[44px] min-w-[44px]',
          'focus-visible:outline-2 focus-visible:outline-focus',
        )}
      >
        <Plus size={24} aria-hidden="true" />
        {addLabel}
      </button>
      {photos.map((photo) => (
        <div
          key={photo.label}
          className="aspect-square rounded-xl bg-surface-2 grid place-items-center text-ink-2 text-[13px] font-semibold ring-1 ring-inset ring-line text-center px-2"
        >
          {photo.label}
        </div>
      ))}
    </div>
  );
}
