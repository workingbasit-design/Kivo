'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * AvailabilityPicker — day-strip + time-slot picker with shared-element motion.
 * Slots slide in when the day changes; the selection highlight glides
 * between days on a spring. For booking flows.
 */
export interface DaySlots {
  date: string; // ISO date
  label: string; // e.g. "Mon"
  dayNum: string; // e.g. "14"
  slots: string[]; // e.g. ["9:00 AM", "10:30 AM"]
}

export default function AvailabilityPicker({
  days,
  selectedDate,
  selectedSlot,
  onSelect,
  loading = false,
}: {
  days: DaySlots[];
  selectedDate: string | null;
  selectedSlot: string | null;
  onSelect: (date: string, slot: string | null) => void;
  loading?: boolean;
}) {
  const [direction, setDirection] = useState(0);
  const selectedDay = days.find((d) => d.date === selectedDate);

  const pickDay = (date: string) => {
    const idx = days.findIndex((d) => d.date === date);
    const curIdx = days.findIndex((d) => d.date === selectedDate);
    setDirection(idx > curIdx ? 1 : -1);
    onSelect(date, null);
  };

  return (
    <div>
      {/* Day strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {days.map((day) => {
          const selected = day.date === selectedDate;
          const hasSlots = day.slots.length > 0;
          return (
            <button
              key={day.date}
              type="button"
              disabled={!hasSlots}
              onClick={() => pickDay(day.date)}
              className={`relative min-w-[64px] min-h-[72px] rounded-2xl flex flex-col items-center justify-center gap-0.5 shrink-0 transition-colors ${
                selected ? 'text-ink' : hasSlots ? 'text-zinc-700 hover:bg-zinc-100' : 'text-zinc-300'
              }`}
              aria-pressed={selected}
            >
              {selected && (
                <motion.span
                  layoutId="avail-day"
                  className="absolute inset-0 rounded-2xl bg-lime shadow-[0_4px_12px_rgba(200,240,74,0.4)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative text-[11px] font-semibold uppercase">{day.label}</span>
              <span className="relative text-lg font-bold tabular-nums">{day.dayNum}</span>
              <span className={`relative w-1.5 h-1.5 rounded-full ${hasSlots ? 'bg-emerald-500' : 'bg-zinc-200'}`} />
            </button>
          );
        })}
      </div>

      {/* Time slots */}
      <div className="mt-4 min-h-[120px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={selectedDate ?? 'none'}
            custom={direction}
            initial={{ opacity: 0, x: 24 * (direction || 1) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 * (direction || 1) }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          >
            {loading ? (
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-[44px] rounded-xl bg-zinc-100 animate-pulse" />
                ))}
              </div>
            ) : selectedDay && selectedDay.slots.length > 0 ? (
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Available times">
                {selectedDay.slots.map((slot) => {
                  const selected = slot === selectedSlot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onSelect(selectedDay.date, slot)}
                      className={`relative min-h-[44px] rounded-xl text-sm font-semibold transition-colors ${
                        selected ? 'text-ink' : 'text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      {selected && (
                        <motion.span
                          layoutId="avail-slot"
                          className="absolute inset-0 rounded-xl bg-lime shadow-[0_2px_8px_rgba(200,240,74,0.4)]"
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                      )}
                      <span className="relative">{slot}</span>
                    </button>
                  );
                })}
              </div>
            ) : selectedDay ? (
              <p className="text-sm text-zinc-500 text-center py-8">No slots available this day</p>
            ) : (
              <p className="text-sm text-zinc-500 text-center py-8">Select a day to see available times</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
