import { useCallback, useEffect, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import toast from 'react-hot-toast';
import { AtSign, CalendarClock, Clock, CreditCard, ExternalLink, MessageCircle, Pencil, Plus, Store, Users } from 'lucide-react';
import api, { errorMessage } from '../lib/api';
import { invalidateCache } from '../lib/cache';
import { useUnsavedGuard } from '../lib/hooks';
import { COLLECTIONS, COLLECTION_INFO } from '../lib/menu';
import { withDefaults, type ShopSettings } from '../lib/settings';
import { useAuth } from '../stores/auth';
import { cn, formatDateTime, hourLabel, localNumber, whatsappLink } from '../lib/utils';
import { Card, LoadError, PageTitle, Pill, Skeleton } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { LeaveGuard } from '../components/ui/Confirm';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { Overlay } from '../components/ui/Overlay';
import { SwitchRow } from '../components/ui/Switch';

const NOTICE = [
  { value: '0', label: 'Same day' },
  { value: '1', label: 'Next day' },
  { value: '2', label: '2 days' },
  { value: '3', label: '3 days' },
  { value: '7', label: '1 week' },
];

const shape = (s: Partial<ShopSettings>) => {
  const full = withDefaults(s);
  return { ...full, whatsappNumber: localNumber(full.whatsappNumber) };
};

export function SettingsPage() {
  const [saved, setSaved] = useState<ShopSettings | null>(null);
  const [form, setForm] = useState<ShopSettings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('ordering');

  const load = useCallback(
    () =>
      api
        .get<Partial<ShopSettings>>('/settings')
        .then(({ data }) => {
          const s = shape(data);
          setSaved(s);
          setForm(s);
          setLoadError(false);
        })
        .catch(() => setLoadError(true)),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = !!form && !!saved && JSON.stringify(form) !== JSON.stringify(saved);
  const { blocker } = useUnsavedGuard(dirty);
  const set = <K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!form) return;
    if (!form.shopName.trim()) {
      setTab('shop');
      return void toast.error('The shop needs a name.');
    }
    if (form.closeHour <= form.openHour) {
      setTab('ordering');
      return void toast.error('The last slot must be after the first.');
    }
    setSaving(true);
    try {
      const { data } = await api.put<Partial<ShopSettings>>('/settings', { ...form, instagram: form.instagram.replace(/^@+/, '').trim() });
      const s = shape(data);
      setSaved(s);
      setForm(s);
      invalidateCache('/settings');
      toast.success('Saved — the website uses it straight away');
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t save the settings.'));
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { value: 'ordering', label: 'Ordering', icon: CalendarClock },
    { value: 'shop', label: 'Shop', icon: Store },
    { value: 'payment', label: 'Payment', icon: CreditCard },
    { value: 'team', label: 'Team', icon: Users },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <PageTitle title="Settings" description="How the website takes orders, what it says about the shop, and who can sign in here." />

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto rounded-full bg-cream-deep p-1 scrollbar-none">
          {tabs.map((t) => (
            <Tabs.Trigger
              key={t.value}
              value={t.value}
              className="inline-flex min-h-11 flex-1 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-cocoa-soft transition-colors hover:text-plum data-[state=active]:bg-card data-[state=active]:text-plum data-[state=active]:shadow-soft"
            >
              <t.icon className="size-4" aria-hidden />
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {loadError && !form ? (
          <div className="mt-5">
            <LoadError message="We couldn’t load the settings." onRetry={() => void load()} />
          </div>
        ) : !form ? (
          <Skeleton className="mt-5 h-96" />
        ) : (
          <>
            <Tabs.Content value="ordering" className="mt-5 space-y-5 focus:outline-none">
              <Card className="space-y-4 p-4 sm:p-5">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-cocoa">
                  <MessageCircle className="size-5 text-plum" aria-hidden /> WhatsApp for orders
                </h2>
                <Field label="WhatsApp number" htmlFor="set-wa" hint="Customers send their order to this number after checkout.">
                  <div className="flex gap-2">
                    <Input id="set-wa" type="tel" inputMode="tel" value={form.whatsappNumber} onChange={(e) => set('whatsappNumber', e.target.value)} placeholder="024 123 4567" className="tabular" />
                    <a
                      href={whatsappLink(form.whatsappNumber, 'Testing the Sugar City order line.')}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-mint-700 hover:bg-mint-50"
                    >
                      Test <ExternalLink className="size-4" aria-hidden />
                    </a>
                  </div>
                </Field>
              </Card>

              <Card className="space-y-4 p-4 sm:p-5">
                <div>
                  <h2 className="font-display text-lg font-semibold text-cocoa">Earliest date customers can pick</h2>
                  <p className="text-sm text-cocoa-soft">How much notice the kitchen needs, per collection. An order with several collections uses the longest.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {COLLECTIONS.map((c) => {
                    const v = String(form.noticeDays[c] ?? 0);
                    const options = NOTICE.some((o) => o.value === v) ? NOTICE : [...NOTICE, { value: v, label: `${v} days` }].sort((a, b) => Number(a.value) - Number(b.value));
                    return (
                      <Field key={c} label={COLLECTION_INFO[c].label} htmlFor={`set-notice-${c}`}>
                        <Select id={`set-notice-${c}`} value={v} onChange={(nv) => set('noticeDays', { ...form.noticeDays, [c]: Number(nv) })} options={options} />
                      </Field>
                    );
                  })}
                </div>
              </Card>

              <Card className="space-y-4 p-4 sm:p-5">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-cocoa">
                    <Clock className="size-5 text-plum" aria-hidden /> Opening hours
                  </h2>
                  <p className="text-sm text-cocoa-soft">Pickup and delivery times are offered every hour between these.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First slot" htmlFor="set-open">
                    <Select
                      id="set-open"
                      value={String(form.openHour)}
                      onChange={(v) => set('openHour', Number(v))}
                      options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: hourLabel(h) }))}
                    />
                  </Field>
                  <Field label="Last slot" htmlFor="set-close" error={form.closeHour <= form.openHour ? 'Must be after the first slot.' : null}>
                    <Select
                      id="set-close"
                      value={String(form.closeHour - 1)}
                      onChange={(v) => set('closeHour', Number(v) + 1)}
                      options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: hourLabel(h) }))}
                    />
                  </Field>
                </div>
              </Card>
            </Tabs.Content>

            <Tabs.Content value="shop" className="mt-5 focus:outline-none">
              <Card className="space-y-4 p-4 sm:p-5">
                <Field label="Shop name" htmlFor="set-name">
                  <Input id="set-name" value={form.shopName} onChange={(e) => set('shopName', e.target.value)} maxLength={60} />
                </Field>
                <Field label="Phone" htmlFor="set-phone" hint="Shown in the website footer.">
                  <Input id="set-phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} />
                </Field>
                <Field label="Pickup address" htmlFor="set-address" hint="Where customers collect their orders.">
                  <Textarea id="set-address" value={form.pickupAddress} onChange={(e) => set('pickupAddress', e.target.value)} maxLength={200} className="min-h-20" />
                </Field>
                <Field label="Instagram" htmlFor="set-ig" optional hint="Your handle, shown in the footer.">
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-cocoa-faint" aria-hidden />
                    <Input id="set-ig" value={form.instagram} onChange={(e) => set('instagram', e.target.value.replace(/^@+/, ''))} placeholder="sugarcitygh" className="pl-10" maxLength={40} />
                  </div>
                </Field>
              </Card>
            </Tabs.Content>

            <Tabs.Content value="payment" className="mt-5 space-y-5 focus:outline-none">
              <Card className="p-4 sm:p-5">
                <Field label="Payment instructions" htmlFor="set-pay" hint="Shown after checkout and in the footer. One detail per line works best." aside={`${form.paymentInstructions.length}/1000`}>
                  <Textarea
                    id="set-pay"
                    value={form.paymentInstructions}
                    onChange={(e) => set('paymentInstructions', e.target.value)}
                    maxLength={1000}
                    className="min-h-36"
                    placeholder={'MoMo: 024 000 0000 (Sugar City)\nUse your order number as the reference.'}
                  />
                </Field>
              </Card>
              <div>
                <p className="sc-eyebrow mb-2">What customers see</p>
                <div className="edge-scallop rounded-b-xl bg-card px-5 pb-5 pt-7 shadow-soft">
                  <p className="font-display text-lg font-semibold text-plum">How to pay</p>
                  <p className="mt-2 whitespace-pre-line text-[15px] text-cocoa">{form.paymentInstructions.trim() || 'Your payment details will show here.'}</p>
                  <p className="mt-3 text-sm text-cocoa-soft">
                    Use <strong className="tabular text-cocoa">SC-1042</strong> as the payment reference.
                  </p>
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="team" className="mt-5 focus:outline-none">
              <TeamSection />
            </Tabs.Content>
          </>
        )}
      </Tabs.Root>

      {dirty && tab !== 'team' && <div className="h-20" aria-hidden />}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-safe lg:pl-64">
          <div className="mx-auto flex max-w-3xl animate-rise items-center gap-2 rounded-full bg-plum-900 py-2 pl-5 pr-2 text-cream shadow-lift">
            <p className="flex-1 text-sm font-semibold">Unsaved changes</p>
            <Button variant="ghost" size="sm" className="text-cream/80 hover:bg-white/10 hover:text-cream" onClick={() => setForm(saved)}>
              Undo
            </Button>
            <Button variant="peach" size="sm" loading={saving} onClick={() => void save()}>
              Save
            </Button>
          </div>
        </div>
      )}
      <LeaveGuard blocker={blocker} />
    </div>
  );
}

interface Staff {
  id: string;
  name: string;
  email: string;
  phone?: string;
  active: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}

function TeamSection() {
  const me = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [error, setError] = useState(false);
  const [target, setTarget] = useState<Staff | 'new' | null>(null);

  const load = useCallback(
    () =>
      api
        .get<{ users: (Staff & { _id?: string })[] }>('/users')
        .then(({ data }) => {
          setStaff(data.users.map((u) => ({ ...u, id: u.id ?? u._id ?? '' })));
          setError(false);
        })
        .catch(() => setError(true)),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !staff) return <LoadError message="We couldn’t load the team." onRetry={() => void load()} />;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-cocoa">Team</h2>
          <p className="text-sm text-cocoa-soft">Everyone here can use every part of the Studio.</p>
        </div>
        <Button size="sm" onClick={() => setTarget('new')}>
          <Plus /> Add teammate
        </Button>
      </div>
      {!staff ? (
        <div className="space-y-2 px-4 pb-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : (
        <ul className="divide-y divide-crumb border-t border-crumb">
          {staff.map((s) => {
            const isMe = s.id === me?.id;
            return (
              <li key={s.id} className={cn('flex items-center gap-3 px-4 py-3 sm:px-5', !s.active && 'opacity-70')}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-peach-50 font-display font-bold text-peach-700" aria-hidden>
                  {s.name.trim().charAt(0).toUpperCase() || '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 font-semibold text-cocoa">
                    <span className="truncate">{s.name}</span>
                    {isMe && <Pill tone="plum">You</Pill>}
                    {!s.active && <Pill tone="berry">Can’t sign in</Pill>}
                  </p>
                  <p className="truncate text-sm text-cocoa-soft">{s.email}</p>
                  <p className="text-xs text-cocoa-faint">{s.lastLoginAt ? `Last signed in ${formatDateTime(s.lastLoginAt)}` : 'Hasn’t signed in yet'}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setTarget(s)} aria-label={`Edit ${s.name}`}>
                  <Pencil /> <span className="hidden sm:inline">Edit</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <StaffDialog
        key={target === 'new' ? 'new' : (target?.id ?? 'none')}
        target={target}
        isMe={target !== 'new' && !!target && target.id === me?.id}
        onClose={() => setTarget(null)}
        onSaved={(u) => {
          setTarget(null);
          void load();
          if (me && u.id === me.id) setUser({ ...me, name: u.name, phone: u.phone });
        }}
      />
    </Card>
  );
}

function StaffDialog({ target, isMe, onClose, onSaved }: { target: Staff | 'new' | null; isMe: boolean; onClose: () => void; onSaved: (u: Staff) => void }) {
  const creating = target === 'new';
  const existing = target && target !== 'new' ? target : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(existing?.active ?? true);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'password', string>>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = 'Enter their name.';
    if (creating && !/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Enter a valid email.';
    if ((creating || password) && password.length < 6) e.password = 'At least 6 characters.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      if (creating) {
        const { data } = await api.post<{ user: Staff }>('/users', { name: name.trim(), email: email.trim(), phone: phone.trim(), password });
        toast.success(`${name.trim()} can sign in now`);
        onSaved(data.user);
      } else if (existing) {
        const { data } = await api.patch<{ user: Staff }>(`/users/${existing.id}`, {
          name: name.trim(),
          phone: phone.trim(),
          ...(isMe ? {} : { active }),
          ...(password ? { password } : {}),
        });
        toast.success(`${name.trim()} updated`);
        onSaved(data.user ?? { ...existing, name: name.trim(), phone: phone.trim(), active });
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t save. Please try again.'));
      setSaving(false);
    }
  };

  return (
    <Overlay
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={creating ? 'Add a teammate' : `Edit ${existing?.name ?? ''}`}
      description={creating ? 'They’ll get an email with their sign-in details.' : existing?.email}
      footer={
        <Button size="lg" block loading={saving} onClick={() => void save()}>
          {creating ? 'Add teammate' : 'Save changes'}
        </Button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Name" htmlFor="staff-name" error={errors.name}>
          <Input id="staff-name" value={name} invalid={!!errors.name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={80} />
        </Field>
        {creating && (
          <Field label="Email" htmlFor="staff-email" error={errors.email}>
            <Input id="staff-email" type="email" value={email} invalid={!!errors.email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </Field>
        )}
        <Field label="Phone" htmlFor="staff-phone" optional>
          <Input id="staff-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />
        </Field>
        <Field label={creating ? 'Password' : 'New password'} htmlFor="staff-password" optional={!creating} error={errors.password} hint={creating ? 'At least 6 characters.' : 'Leave empty to keep their current password.'}>
          <Input id="staff-password" type="password" value={password} invalid={!!errors.password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        {!creating && (
          <SwitchRow
            id="staff-active"
            title="Can sign in"
            description={isMe ? 'You can’t switch off your own account.' : active ? 'They can use the Studio.' : 'Signed out and blocked until switched back on.'}
            checked={active}
            onCheckedChange={setActive}
            disabled={isMe}
          />
        )}
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden />
      </form>
    </Overlay>
  );
}
