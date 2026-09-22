"use client";

import React, { useState, useTransition } from 'react';
import { Sparkles, CheckCircle2, X, MessageSquare, Clock, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { completeBusinessSetup } from '@/app/actions/settings';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
};

const PRESET_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Convert a modal preset ("09:00 AM - 06:00 PM", "24/7 Availability") to the
 * stored working-hours JSON. Timed presets apply Mon–Sat (Sunday closed);
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
  const [workingHours, setWorkingHours] = useState('09:00 AM - 06:00 PM');
  const [autoAssignTech, setAutoAssignTech] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1a1525] w-full max-w-lg rounded-3xl shadow-2xl border border-zinc-200 dark:border-white/10 overflow-hidden flex flex-col">
        
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-[#1a1525] to-[#2b243b] text-white flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff7a59]/20 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-[#ff7a59] flex items-center justify-center text-white shadow-lg">
              <Zap size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Finish Workspace Setup</h3>
              <p className="text-xs text-zinc-300">Configure remaining 2 action items</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors relative z-10"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto max-h-[70vh]">
          {isCompleted ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">Workspace 100% Ready!</h3>
              <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                WhatsApp auto-reply is turned on and team availability schedules are configured. You are ready to receive and process service jobs.
              </p>
              <button
                onClick={onClose}
                className="w-full bg-[#6329d4] hover:bg-[#5221b3] text-white font-bold py-3.5 rounded-2xl transition-all shadow-md shadow-[#6329d4]/30"
              >
                Back to Dashboard
              </button>
            </div>
          ) : (
            <>
              {/* Item 1: WhatsApp Auto-Reply */}
              <div className="bg-zinc-50 dark:bg-white/5 p-4 rounded-2xl border border-zinc-200/80 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
                      <MessageSquare size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">1. WhatsApp Auto-Reply</h4>
                      <p className="text-[11px] text-zinc-500">Instantly respond to inbound leads within 60s</p>
                    </div>
                  </div>
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={whatsappEnabled}
                      onChange={(e) => setWhatsappEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {whatsappEnabled && (
                  <div className="text-xs bg-white dark:bg-black/30 p-3 rounded-xl border border-zinc-200/60 dark:border-white/10 text-zinc-600 dark:text-zinc-300 space-y-2">
                    <p>
                      "Hi! Thanks for reaching out to FieldFlow. We received your request and will confirm your service slot shortly."
                    </p>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                        WhatsApp number
                      </label>
                      <input
                        type="tel"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        placeholder="+91 98765 43210"
                        maxLength={25}
                        className="w-full text-xs bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl p-2.5 font-medium"
                      />
                      <p className="text-[10px] text-zinc-400 mt-1">
                        Saved on your business — used for WhatsApp chat links on invoices and quotes.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Item 2: Team Availability */}
              <div className="bg-zinc-50 dark:bg-white/5 p-4 rounded-2xl border border-zinc-200/80 dark:border-white/10 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-[#6329d4] flex items-center justify-center">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">2. Team Availability & Shift Hours</h4>
                    <p className="text-[11px] text-zinc-500">Set working window for field dispatch</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Working Hours</label>
                    <select
                      value={workingHours}
                      onChange={(e) => setWorkingHours(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl p-2.5 font-medium"
                    >
                      <option value="08:00 AM - 06:00 PM">08:00 AM - 06:00 PM (Standard)</option>
                      <option value="09:00 AM - 07:00 PM">09:00 AM - 07:00 PM</option>
                      <option value="24/7 Availability">24/7 Emergency Service</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Dispatch Mode</label>
                    <button
                      type="button"
                      onClick={() => setAutoAssignTech(!autoAssignTech)}
                      className={`w-full text-xs border rounded-xl p-2.5 font-semibold text-left transition-colors ${
                        autoAssignTech 
                          ? 'bg-[#f3eefe] border-[#d8c3f0] text-[#6329d4]' 
                          : 'bg-white border-zinc-200 text-zinc-700'
                      }`}
                    >
                      {autoAssignTech ? '✓ Auto-Assign Available Tech' : 'Manual Dispatch'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                {saveError && (
                  <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                    {saveError}
                  </p>
                )}
                <button
                  onClick={handleSaveSetup}
                  disabled={isPending}
                  className="w-full bg-[#6329d4] hover:bg-[#5221b3] text-white font-bold py-3.5 rounded-2xl transition-all shadow-md shadow-[#6329d4]/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-sm"
                >
                  <ShieldCheck size={16} />
                  {isPending ? 'Saving Setup...' : 'Complete & Enable Workspace Now'}
                </button>

                <button
                  onClick={() => {
                    handleSaveSetup();
                    window.dispatchEvent(new CustomEvent('open-copilot', { 
                      detail: { message: "Please summarize my completed workspace setup and send a test WhatsApp ping." } 
                    }));
                  }}
                  className="w-full bg-zinc-100 dark:bg-white/10 text-zinc-800 dark:text-white hover:bg-zinc-200 font-semibold py-3 rounded-2xl transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles size={14} className="text-[#ff7a59]" />
                  Auto-Finish with KivoBrain AI
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
