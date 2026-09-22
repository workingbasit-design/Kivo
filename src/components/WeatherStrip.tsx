import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Umbrella,
} from 'lucide-react';
import type { DailyWeather } from '@/lib/weather';
import { weatherLabel } from '@/lib/weather';
import { cn } from '@/lib/utils';

function iconFor(code: number) {
  if (code === 0) return Sun;
  if (code === 1 || code === 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return CloudSun;
}

export type StripDay = {
  /** YYYY-MM-DD */
  dateISO: string;
  label: string;
  weather: DailyWeather | null;
};

export default function WeatherStrip({
  days,
  placeName,
}: {
  days: StripDay[];
  placeName: string;
}) {
  const usable = days.filter((d) => d.weather !== null);
  if (usable.length === 0) return null;

  return (
    <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-indigo-50 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-sky-700">
          Weather · <span className="normal-case font-semibold text-sky-600">{placeName}</span>
        </p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {days.map((d) => {
          const w = d.weather;
          const Icon = w ? iconFor(w.code) : CloudSun;
          const rainy = w !== null && w.precipProb >= 40;
          return (
            <div
              key={d.dateISO}
              title={w ? `${d.label}: ${weatherLabel(w.code)}, ${w.lowC}–${w.highC}°C, ${w.precipProb}% rain` : d.label}
              className="flex flex-col items-center rounded-xl bg-white/70 border border-white px-1 py-2"
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{d.label}</span>
              <Icon
                size={18}
                className={cn('my-1', w === null ? 'text-zinc-300' : rainy ? 'text-sky-500' : 'text-amber-500')}
              />
              {w ? (
                <>
                  <span className="text-xs font-bold text-zinc-900">
                    {w.highC}°<span className="text-zinc-400 font-semibold">/{w.lowC}°</span>
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-bold',
                      rainy ? 'text-sky-600' : 'text-zinc-400'
                    )}
                  >
                    <Umbrella size={10} />
                    {w.precipProb}%
                  </span>
                </>
              ) : (
                <span className="text-[10px] font-semibold text-zinc-300">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
