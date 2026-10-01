import { requireCustomerAuth } from '@/lib/customer-auth';
import { customerLogout } from '@/app/actions/customer-auth';
import { updateCustomerProfile } from '@/app/actions/customer-profile';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import { LogOut, Save, MapPin, Phone, Mail } from 'lucide-react';

export default async function CustomerProfilePage() {
  const session = await requireCustomerAuth();
  const locale = await getLocale();
  const tr = (path: string) => t(locale, path as never);
  const customer = session.customer;
  const initial = (customer.name?.charAt(0) || customer.email.charAt(0)).toUpperCase();

  return (
    <div className="space-y-5">
      <div className="ej-anim-fade-up">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">{tr('customer.profile.title')}</h1>
      </div>

      <div className="ej-anim-fade-up bg-white rounded-3xl border border-zinc-200/80 shadow-sm overflow-hidden" style={{ animationDelay: '80ms' }}>
        <div className="bg-zinc-900 px-5 pt-6 pb-8">
          <div className="flex items-center gap-4">
            <div className="ej-anim-scale-in w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-white">{initial}</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-lg truncate">{customer.name}</p>
              <p className="text-white/60 text-xs truncate">{customer.email}</p>
            </div>
          </div>
        </div>

        <form action={updateCustomerProfile} className="p-5 space-y-4 -mt-2">
          <Field label={tr('customer.profile.fullName')}>
            <input
              name="name"
              defaultValue={customer.name || ''}
              required
              maxLength={100}
              className={inputClass}
            />
          </Field>
          <Field label={tr('customer.profile.email')}>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                name="email"
                type="email"
                defaultValue={customer.email}
                disabled
                className={`${inputClass} pl-10 bg-zinc-50 text-zinc-500`}
              />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr('customer.profile.phone')}>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  name="phone"
                  type="tel"
                  defaultValue={customer.phone || ''}
                  maxLength={30}
                  placeholder="(416) 555-0100"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </Field>
            <Field label={tr('customer.profile.city')}>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  name="city"
                  defaultValue={customer.city || ''}
                  maxLength={100}
                  placeholder="Toronto"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </Field>
          </div>
          <button type="submit" className={primaryBtnClass}>
            <Save className="w-4 h-4" />
            {tr('customer.profile.saveChanges')}
          </button>
        </form>
      </div>

      <form action={customerLogout}>
        <button
          type="submit"
          className="ej-icon-hover w-full min-h-[52px] rounded-2xl bg-white border border-rose-200 text-rose-600 text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-rose-50 hover:border-rose-300 hover:shadow-md shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          {tr('customer.profile.logOut')}
        </button>
      </form>
    </div>
  );
}
