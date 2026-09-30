import { requireCustomerAuth } from '@/lib/customer-auth';
import { customerLogout } from '@/app/actions/customer-auth';
import { updateCustomerProfile } from '@/app/actions/customer-profile';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import { LogOut, User, Save } from 'lucide-react';

export default async function CustomerProfilePage() {
  const session = await requireCustomerAuth();
  const customer = session.customer;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold tracking-tight text-zinc-900">Profile</h1>

      <div className="bg-white rounded-2xl border border-zinc-200 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center">
            <User className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="font-bold text-zinc-900">{customer.name}</p>
            <p className="text-xs text-zinc-500">{customer.email}</p>
          </div>
        </div>

        <form action={updateCustomerProfile} className="space-y-4">
          <Field label="Full name">
            <input
              name="name"
              defaultValue={customer.name || ''}
              required
              maxLength={100}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input
                name="phone"
                type="tel"
                defaultValue={customer.phone || ''}
                maxLength={30}
                className={inputClass}
              />
            </Field>
            <Field label="City">
              <input
                name="city"
                defaultValue={customer.city || ''}
                maxLength={100}
                className={inputClass}
              />
            </Field>
          </div>
          <button type="submit" className={primaryBtnClass}>
            <Save className="w-4 h-4" />
            Save changes
          </button>
        </form>
      </div>

      <form action={customerLogout}>
        <button
          type="submit"
          className="w-full min-h-[48px] rounded-2xl bg-white border border-zinc-200 text-rose-600 text-sm font-bold inline-flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </form>
    </div>
  );
}
