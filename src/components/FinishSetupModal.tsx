"use client";

import React, { useEffect, useState, useTransition } from 'react';
import { CheckCircle2, X, MessageSquare, Clock, ArrowRight, ShieldCheck, Zap } from '@/components/icons';
import { completeBusinessSetup } from '@/app/actions/settings';
import { useResolvedT } from '@/hooks/useResolvedLocale';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
};

const PRESET_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Convert a modal preset ("09:00 AM - 06:00 PM", "24/7 Availability") to the
 * stored working-hours JSON. Timed presets apply Mon-Sat (Sunday closed);
 * 24/7 applies to all seven days.
 */
function presetToWorkingHoursJson(preset: string): string {
  const out: Record<string, [string, string]> = {};
  if (preset === '24/7 Availability') {
    for (const d of [...PRESET_DAYS, 'sun'] as const) out[d] = ['00:00', '23:59'];
    return JSON.stringify(out);
  }
  const m = /^(\d{2}):(\d{2}) (AM|PM) - (\d{2}):(\d{2}) (AM|PM)$/.exec(preset);
  if (!m) return '';
  const conv = (hh: string, mm: string, ap: string) => {
    let h = parseInt(hh, 10) % 12;
    if (ap === 'PM') h += 12;
    return `${String(h).padStart(2, '0')}:${mm}`;
  };
  const open = conv(m[1], m[2], m[3]);
  const close = conv(m[4], m[5], m[6]);
  if (!(open < close)) return '';
  for (const d of PRESET_DAYS) out[d] = [open, close];
  return JSON.stringify(out);
}

export default function FinishSetupModal({ isOpen, onClose, onCompleted }: Props) {
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [workingHours, setWorkingHours] = useState('08:00 AM - 06:00 PM');
  const [autoAssignTech, setAutoAssignTech] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { t } = useResolvedT();
  const L = (key: string) => t(`t10misc.setupModal.${key}`);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveSetup = () => {
    setSaveError(null);
    startTransition(async () => {
      const res = await completeBusinessSetup({
        whatsappNumber: whatsappEnabled ? whatsappNumber : '',
        workingHoursJson: presetToWorkingHoursJson(workingHours),
      });
      if (res.error) {
        setSaveError(res.error);
        return;
      }
      setIsCompleted(true);
      if (onCompleted) onCompleted();
    });
  };

  return (
    <div
      className="fixed inset-0 bg-asphalt/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={L('title')}
    >
      <div className="bg-surface w-full max-w-lg rounded-3xl shadow-2xl border border-line overflow-hidden flex flex-col max-h-[90vh] ej-sheet-in">

        {/* Modal Header */}
        <div className="p-6 bg-asphalt text-hero-ink flex justify-between items-center relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-warn/20 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-warn flex items-center justify-center text-hero-ink shadow-lg">
              <Zap size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">{L('title')}</h3>
              <p className="text-xs text-ink-2">{L('subtitle')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('t10misc.confirmDialog.close')}
            className="min-w-[44px] min-h-[44px] rounded-full bg-surface/10 hover:bg-surface/20 text-hero-ink flex items-center justify-center transition-colors relative z-10"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {isCompleted ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-ok-bg text-ok mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-2xl font-bold text-ink">{L('doneTitle')}</h3>
              <p className="text-sm text-ink-2 max-w-sm mx-auto">
                {L('doneDesc')}
              </p>
              <button
                onClick={onClose}
                className="w-full min-h-[52px] bg-asphalt hover:bg-graphite text-hero-ink font-bold py-3.5 rounded-2xl transition-all shadow-md shadow-ink/30 flex items-center justify-center gap-2 text-sm"
              >
                {L('backToDash')} <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <>
              {/* Item 1: WhatsApp Auto-Reply */}
              <div className="bg-surface-2 p-4 rounded-2xl border border-line/80 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-ok-bg text-ok flex items-center justify-center shrink-0">
                      <MessageSquare size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-ink">{L('waTitle')}</h4>
                      <p className="text-[11px] text-ink-2">{L('waDesc')}</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0 min-w-[44px] min-h-[44px] justify-center">
                    <span className="sr-only">{L('waTitle')}</span>
                    <input
                      type="checkbox"
                      checked={whatsappEnabled}
                      onChange={(e) => setWhatsappEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-line peer-focus-visible:outline-2 peer-focus-visible:outline-ink rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-hero-ink after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:left-[9px] after:bg-surface after:border-line-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ok"></div>
                  </label>
                </div>

                {whatsappEnabled && (
                  <div className="text-xs bg-surface p-3 rounded-xl border border-line/60 text-ink-2 space-y-2">
                    <p>{L('waSample')}</p>
                    <div>
                      <label className="block text-[10px] font-bold text-ink-2 mb-1">
                        {L('waNumber')}
                      </label>
                      <input
                        type="tel"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        placeholder="+1 416 555 0100"
                        maxLength={25}
                        className="w-full min-h-[44px] text-xs text-ink bg-surface border border-line rounded-xl p-2.5 font-medium placeholder:text-ink-2"
                      />
                      <p className="text-[10px] text-ink-2 mt-1">
                        {L('waHint')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Item 2: Team Availability */}
              <div className="bg-surface-2 p-4 rounded-2xl border border-line/80 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-smoke text-ink flex items-center justify-center shrink-0">
                    <Clock size={16} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-ink">{L('availTitle')}</h4>
                    <p className="text-[11px] text-ink-2">{L('availDesc')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-ink-2 mb-1">{L('hoursLabel')}</label>
                    <select
                      value={workingHours}
                      onChange={(e) => setWorkingHours(e.target.value)}
                      className="w-full min-h-[44px] text-xs text-ink bg-surface border border-line rounded-xl p-2.5 font-medium placeholder:text-ink-2"
                    >
                      <option value="08:00 AM - 06:00 PM">{L('hoursStandard')}</option>
                      <option value="09:00 AM - 07:00 PM">{L('hoursLate')}</option>
                      <option value="24/7 Availability">{L('hours247')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-ink-2 mb-1">{L('dispatchLabel')}</label>
                    <button
                      type="button"
                      onClick={() => setAutoAssignTech(!autoAssignTech)}
                      aria-pressed={autoAssignTech}
                      className={`w-full min-h-[44px] text-xs border rounded-xl p-2.5 font-semibold text-left transition-colors ${
                        autoAssignTech
                          ? 'bg-smoke border-smoke text-ink'
                          : 'bg-surface border-line text-ink'
                      }`}
                    >
                      {autoAssignTech ? `✓ ${L('dispatchAuto')}` : L('dispatchManual')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                {saveError && (
                  <p className="text-xs font-medium text-danger bg-danger-bg border border-line rounded-xl px-3 py-2.5">
                    {saveError}
                  </p>
                )}
                <button
                  onClick={handleSaveSetup}
                  disabled={isPending}
                  className="w-full min-h-[52px] bg-asphalt hover:bg-graphite text-hero-ink font-bold py-3.5 rounded-2xl transition-all shadow-md shadow-ink/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-sm"
                >
                  <ShieldCheck size={16} />
                  {isPending ? L('saving') : L('complete')}
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
