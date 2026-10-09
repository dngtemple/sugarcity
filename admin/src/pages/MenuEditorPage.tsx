import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowLeft, ArrowUp, Eye, Gift, Heart, ImagePlus, MessageSquareText, Plus, Trash2, Upload, X } from 'lucide-react';
import api, { errorMessage } from '../lib/api';
import { cachedGet, invalidateCache } from '../lib/cache';
import { useUnsavedGuard } from '../lib/hooks';
import {
  COLLECTIONS,
  COLLECTION_INFO,
  RULES,
  flagsOf,
  isCollection,
  priceGroupIndex,
  ruleOf,
  type Collection,
  type MenuItem,
  type Rule,
} from '../lib/menu';
import { cn } from '../lib/utils';
import { Card, Empty, Skeleton } from '../components/ui/Bits';
import { Button, IconButton } from '../components/ui/Button';
import { buttonClass } from '../components/ui/buttonStyles';
import { Confirm, LeaveGuard } from '../components/ui/Confirm';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { SwitchRow } from '../components/ui/Switch';
import { ProductPreview } from '../components/menu/ProductPreview';

interface OptionDraft {
  key: string;
  _id?: string;
  name: string;
  price: string;
}
interface GroupDraft {
  key: string;
  _id?: string;
  name: string;
  rule: Rule;
  options: OptionDraft[];
}
interface Draft {
  name: string;
  section: Collection;
  category: string;
  newCategory: string;
  description: string;
  price: string;
  minQuantity: string;
  available: boolean;
  popular: boolean;
  allowMessage: boolean;
  isGift: boolean;
  groups: GroupDraft[];
}

const NEW_CATEGORY = '__new__';
const MAX_PHOTO = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

let seq = 0;
const nextKey = () => `k${++seq}`;
const blankOption = (): OptionDraft => ({ key: nextKey(), name: '', price: '' });

type Preset = { label: string; make: () => GroupDraft };
const preset = (label: string, name: string, rule: Rule, rows: number): Preset => ({
  label,
  make: () => ({ key: nextKey(), name, rule, options: Array.from({ length: rows }, blankOption) }),
});

/** Each collection offers the kinds of choices that make sense for it. */
const PRESETS: Record<Collection, Preset[]> = {
  cakes: [preset('Size', 'Size', 'one-required', 2), preset('Flavour', 'Flavour', 'one-required', 2), preset('Extras', 'Extras', 'any', 1), preset('Custom', '', 'one-optional', 1)],
  pastries: [preset('Size/Box', 'Box size', 'one-required', 2), preset('Flavour', 'Flavour', 'one-required', 2), preset('Extras', 'Extras', 'any', 1), preset('Custom', '', 'one-optional', 1)],
  gifts: [preset('Choose your treats', 'Choose your treats', 'any-required', 3), preset('Extras', 'Extras', 'any', 1), preset('Custom', '', 'one-optional', 1)],
};

function toDraft(item: MenuItem | null, section: Collection, categories: string[]): Draft {
  if (!item) {
    return {
      name: '',
      section,
      category: categories.length ? '' : NEW_CATEGORY,
      newCategory: '',
      description: '',
      price: '',
      minQuantity: '',
      available: true,
      popular: false,
      allowMessage: section === 'cakes',
      isGift: section === 'gifts',
      groups: [],
    };
  }
  return {
    name: item.name,
    section: item.section,
    category: item.category,
    newCategory: '',
    description: item.description ?? '',
    price: String(item.price ?? 0),
    minQuantity: item.minQuantity > 1 ? String(item.minQuantity) : '',
    available: item.available,
    popular: !!item.popular,
    allowMessage: !!item.allowMessage,
    isGift: !!item.isGift,
    groups: (item.optionGroups ?? []).map((g) => ({
      key: nextKey(),
      _id: g._id,
      name: g.name,
      rule: ruleOf(g),
      options: g.options.map((o) => ({ key: nextKey(), _id: o._id, name: o.name, price: o.price ? String(o.price) : '' })),
    })),
  };
}

export function MenuEditorPage() {
  const { id = 'new' } = useParams();
  const [params] = useSearchParams();
  const isNew = id === 'new';
  const startSection: Collection = isCollection(params.get('section')) ? (params.get('section') as Collection) : 'cakes';
  const [all, setAll] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    cachedGet<{ items: MenuItem[] }>('/menu/all', undefined, { force: !isNew })
      .then((d) => setAll(d.items))
      .catch(() => setError(true));
  }, [isNew]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <Empty title="We couldn’t load the menu" action={<Link to="/menu" className={buttonClass('primary')}>Back to the menu</Link>} />
        </Card>
      </div>
    );
  }
  if (!all) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[480px]" />
          <Skeleton className="h-[480px]" />
        </div>
      </div>
    );
  }
  const item = isNew ? null : (all.find((i) => i._id === id) ?? null);
  if (!isNew && !item) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <Empty title="That item isn’t on the menu any more" body="It may have been deleted." action={<Link to="/menu" className={buttonClass('primary')}>Back to the menu</Link>} />
        </Card>
      </div>
    );
  }
  return <Editor key={id} item={item} startSection={startSection} all={all} />;
}

function Editor({ item, startSection, all }: { item: MenuItem | null; startSection: Collection; all: MenuItem[] }) {
  const navigate = useNavigate();
  const categoriesBySection = useMemo(() => {
    const map = {} as Record<Collection, string[]>;
    for (const c of COLLECTIONS) map[c] = [...new Set(all.filter((i) => i.section === c).map((i) => i.category).filter(Boolean))].sort();
    return map;
  }, [all]);

  const [initial] = useState(() => toDraft(item, item?.section ?? startSection, categoriesBySection[item?.section ?? startSection]));
  const initialJson = useMemo(() => JSON.stringify(initial), [initial]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const dirty = JSON.stringify(draft) !== initialJson || !!photo || removePhoto;
  const { blocker, allowNext } = useUnsavedGuard(dirty && !saving && !deleting);

  const section = draft.section;
  const info = COLLECTION_INFO[section];
  const categories = categoriesBySection[section];
  const categoryOptions = draft.category && draft.category !== NEW_CATEGORY && !categories.includes(draft.category) ? [...categories, draft.category] : categories;
  const shownImage = photoUrl ?? (!removePhoto ? item?.image : undefined);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };
  const patchGroup = (key: string, patch: Partial<GroupDraft>) => setDraft((d) => ({ ...d, groups: d.groups.map((g) => (g.key === key ? { ...g, ...patch } : g)) }));
  const patchOption = (gkey: string, okey: string, patch: Partial<OptionDraft>) => {
    setDraft((d) => ({
      ...d,
      groups: d.groups.map((g) => (g.key === gkey ? { ...g, options: g.options.map((o) => (o.key === okey ? { ...o, ...patch } : o)) } : g)),
    }));
    setErrors((e) => ({ ...e, [`option-${okey}`]: '', [`group-${gkey}-options`]: '' }));
  };
  const moveGroup = (index: number, delta: number) =>
    setDraft((d) => {
      const groups = [...d.groups];
      const [g] = groups.splice(index, 1);
      groups.splice(index + delta, 0, g);
      return { ...d, groups };
    });

  const previewGroups = draft.groups.map((g) => ({
    name: g.name,
    ...flagsOf(g.rule),
    options: g.options.filter((o) => o.name.trim()).map((o) => ({ name: o.name, price: Number(o.price) || 0 })),
  }));
  const priceGroup = priceGroupIndex({ price: Number(draft.price) || 0, optionGroups: previewGroups });

  const pickPhoto = (file?: File | null) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return void toast.error('Choose a JPG, PNG or WebP photo.');
    if (file.size > MAX_PHOTO) return void toast.error('That photo is over 5 MB. Try a smaller one.');
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
    setRemovePhoto(false);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    pickPhoto(e.dataTransfer.files?.[0]);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!draft.name.trim()) e.name = 'Give it a name.';
    const category = draft.category === NEW_CATEGORY ? draft.newCategory.trim() : draft.category;
    if (!category) e.category = 'Pick a category, or type a new one.';
    const price = Number(draft.price);
    if (draft.price.trim() === '' || !Number.isFinite(price) || price < 0) e.price = 'Enter a price. Use 0 if a choice sets the price.';
    const min = Number(draft.minQuantity);
    if (draft.minQuantity.trim() && (!Number.isInteger(min) || min < 1 || min > 1000)) e.minQuantity = 'A whole number from 1 to 1000, or leave it empty.';
    for (const g of draft.groups) {
      if (!g.name.trim()) e[`group-${g.key}-name`] = 'Name this group, e.g. Size.';
      const filled = g.options.filter((o) => o.name.trim() || o.price.trim());
      if (filled.length === 0) e[`group-${g.key}-options`] = 'Add at least one option.';
      for (const o of filled) {
        if (!o.name.trim()) e[`option-${o.key}`] = 'Name this option.';
        else if (o.price.trim() && (!Number.isFinite(Number(o.price)) || Number(o.price) < 0)) e[`option-${o.key}`] = 'That price doesn’t look right.';
      }
    }
    return e;
  };

  const save = async () => {
    const found = validate();
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.querySelector(`[data-err="${first}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast.error('A few things need fixing first.');
      return;
    }
    const fd = new FormData();
    fd.append('name', draft.name.trim());
    fd.append('section', draft.section);
    fd.append('category', draft.category === NEW_CATEGORY ? draft.newCategory.trim() : draft.category);
    fd.append('description', draft.description.trim());
    fd.append('price', String(Number(draft.price)));
    fd.append('minQuantity', draft.minQuantity.trim() ? String(Number(draft.minQuantity)) : '1');
    fd.append('available', String(draft.available));
    fd.append('popular', String(draft.popular));
    fd.append('allowMessage', String(draft.allowMessage));
    fd.append('isGift', String(draft.isGift));
    fd.append(
      'optionGroups',
      JSON.stringify(
        draft.groups.map((g) => ({
          ...(g._id ? { _id: g._id } : {}),
          name: g.name.trim(),
          ...flagsOf(g.rule),
          options: g.options
            .filter((o) => o.name.trim() || o.price.trim())
            .map((o) => ({ ...(o._id ? { _id: o._id } : {}), name: o.name.trim(), price: Number(o.price) || 0 })),
        }))
      )
    );
    if (photo) fd.append('image', photo);
    else if (removePhoto) fd.append('removeImage', 'true');

    setSaving(true);
    try {
      const { data } = item ? await api.put<MenuItem>(`/menu/${item._id}`, fd) : await api.post<MenuItem>('/menu', fd);
      invalidateCache('/menu');
      toast.success(item ? `${data.name} saved` : `${data.name} is on the ${COLLECTION_INFO[data.section ?? section].label} menu`);
      allowNext();
      navigate(`/menu?section=${data.section ?? section}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t save this item. Please try again.'));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    setDeleting(true);
    try {
      await api.delete(`/menu/${item._id}`);
      invalidateCache('/menu');
      toast.success(`${item.name} deleted`);
      allowNext();
      navigate(`/menu?section=${item.section}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t delete this item.'));
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const Err = ({ k }: { k: string }) =>
    errors[k] ? (
      <p className="mt-1.5 text-sm font-medium text-berry" role="alert">
        {errors[k]}
      </p>
    ) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 lg:pt-8">
      <div className="flex items-center gap-3">
        <Link to={`/menu?section=${section}`} className="inline-flex size-11 items-center justify-center rounded-full bg-card text-plum shadow-soft hover:bg-plum-50" aria-label="Back to the menu">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <p className="sc-eyebrow">{info.label}</p>
          <h1 className="truncate font-display text-[28px] font-semibold leading-tight text-plum">{item ? item.name : `New ${info.noun}`}</h1>
        </div>
      </div>

      <div className="mt-6 grid gap-6 pb-32 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {/* Photo */}
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-display text-lg font-semibold text-cocoa">Photo</h2>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                'flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-4 transition-colors sm:flex-row',
                dragOver ? 'border-plum bg-plum-50' : 'border-crumb-strong'
              )}
            >
              {shownImage ? (
                <img src={shownImage} alt="" className="size-36 rounded-lg object-cover shadow-soft" />
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex size-36 flex-col items-center justify-center gap-1.5 rounded-lg bg-peach-50 text-sm font-semibold text-peach-700 hover:bg-peach/40"
                >
                  <ImagePlus className="size-7" aria-hidden />
                  Add a photo
                </button>
              )}
              <div className="flex-1 text-center sm:text-left">
                <p className="text-[15px] text-cocoa-soft">Drop a photo here, or choose one. JPG, PNG or WebP, up to 5 MB. Square-ish photos look best.</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload /> {shownImage ? 'Change photo' : 'Choose photo'}
                  </Button>
                  {shownImage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPhoto(null);
                        setPhotoUrl(null);
                        setRemovePhoto(!!item?.image);
                      }}
                    >
                      <X /> Remove
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  pickPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          </Card>

          {/* Details */}
          <Card className="space-y-4 p-4 sm:p-5">
            <h2 className="font-display text-lg font-semibold text-cocoa">Details</h2>
            <div data-err="name">
              <Field label="Name" htmlFor="ed-name" error={errors.name}>
                <Input id="ed-name" value={draft.name} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} placeholder={info.namePlaceholder} maxLength={80} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Collection" htmlFor="ed-section">
                <Select
                  id="ed-section"
                  value={draft.section}
                  onChange={(next) =>
                    setDraft((d) => ({
                      ...d,
                      section: next,
                      category: categoriesBySection[next].includes(d.category) ? d.category : d.category === NEW_CATEGORY ? NEW_CATEGORY : '',
                      isGift: next === 'gifts' ? true : d.isGift,
                    }))
                  }
                  options={COLLECTIONS.map((c) => ({ value: c, label: COLLECTION_INFO[c].label }))}
                />
              </Field>
              <div data-err="category">
                <Field label="Category" htmlFor="ed-category" error={errors.category} hint="The heading it sits under on the website.">
                  <Select
                    id="ed-category"
                    value={draft.category}
                    invalid={!!errors.category}
                    placeholder="Pick a category"
                    onChange={(v) => set('category', v)}
                    options={[...categoryOptions.map((c) => ({ value: c, label: c })), { value: NEW_CATEGORY, label: '+ New category…' }]}
                  />
                </Field>
                {draft.category === NEW_CATEGORY && (
                  <Input
                    className="mt-2"
                    value={draft.newCategory}
                    invalid={!!errors.category}
                    onChange={(e) => set('newCategory', e.target.value)}
                    placeholder={`New category, ${info.categoryPlaceholder}`}
                    aria-label="New category name"
                    maxLength={60}
                  />
                )}
              </div>
            </div>
            <Field label="Description" htmlFor="ed-desc" optional aside={`${draft.description.length}/500`}>
              <Textarea id="ed-desc" value={draft.description} onChange={(e) => set('description', e.target.value)} maxLength={500} placeholder={info.descriptionPlaceholder} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <div data-err="price">
                <Field label="Base price (GH₵)" htmlFor="ed-price" error={errors.price} hint="Choices below add to this — use 0 if a choice sets the price.">
                  <Input id="ed-price" inputMode="decimal" value={draft.price} invalid={!!errors.price} onChange={(e) => set('price', e.target.value)} placeholder="0" />
                </Field>
              </div>
              <div data-err="minQuantity">
                <Field label="Minimum quantity" htmlFor="ed-min" optional error={errors.minQuantity} hint="Fewest a customer can order online. Empty means 1.">
                  <Input id="ed-min" inputMode="numeric" value={draft.minQuantity} invalid={!!errors.minQuantity} onChange={(e) => set('minQuantity', e.target.value)} placeholder="1" />
                </Field>
              </div>
            </div>
          </Card>

          {/* Option groups */}
          <Card className="p-4 sm:p-5">
            <h2 className="font-display text-lg font-semibold text-cocoa">Choices</h2>
            <p className="mt-0.5 text-sm text-cocoa-soft">
              {section === 'gifts'
                ? 'Leave empty for a ready-made box. For build-your-own, add “Choose your treats” with one option per treat.'
                : 'Sizes, flavours and extras the customer picks from. Leave empty for a one-price item.'}
            </p>

            <div className="mt-4 space-y-4">
              {draft.groups.map((group, gi) => (
                <div key={group.key} className="rounded-lg border border-crumb bg-cream/70 p-3 sm:p-4">
                  <div className="flex items-start gap-1" data-err={`group-${group.key}-name`}>
                    <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
                      <div>
                        <Input
                          value={group.name}
                          invalid={!!errors[`group-${group.key}-name`]}
                          onChange={(e) => {
                            patchGroup(group.key, { name: e.target.value });
                            setErrors((x) => ({ ...x, [`group-${group.key}-name`]: '' }));
                          }}
                          placeholder="Group name, e.g. Size"
                          aria-label="Group name"
                          maxLength={40}
                          className="font-semibold"
                        />
                        <Err k={`group-${group.key}-name`} />
                      </div>
                      <Select
                        value={group.rule}
                        onChange={(rule) => patchGroup(group.key, { rule })}
                        options={RULES.map((r) => ({ value: r.value, label: r.label }))}
                        aria-label={`How customers choose ${group.name || 'in this group'}`}
                      />
                    </div>
                    <IconButton label="Move group up" onClick={() => moveGroup(gi, -1)} disabled={gi === 0}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton label="Move group down" onClick={() => moveGroup(gi, 1)} disabled={gi === draft.groups.length - 1}>
                      <ArrowDown />
                    </IconButton>
                    <IconButton label={`Delete ${group.name || 'group'}`} tone="danger" onClick={() => setDraft((d) => ({ ...d, groups: d.groups.filter((g) => g.key !== group.key) }))}>
                      <Trash2 />
                    </IconButton>
                  </div>

                  <div className="mt-3 space-y-2" data-err={`group-${group.key}-options`}>
                    <div className="flex gap-2 px-1 text-xs font-semibold text-cocoa-faint">
                      <span className="flex-1">Option</span>
                      <span className="w-28">{gi === priceGroup ? 'Price (GH₵)' : 'Adds (GH₵)'}</span>
                      <span className="w-11" />
                    </div>
                    {group.options.map((o) => (
                      <div key={o.key} data-err={`option-${o.key}`}>
                        <div className="flex items-center gap-2">
                          <Input
                            value={o.name}
                            invalid={!!errors[`option-${o.key}`]}
                            onChange={(e) => patchOption(group.key, o.key, { name: e.target.value })}
                            placeholder="e.g. 8 inch"
                            aria-label="Option name"
                            maxLength={60}
                            className="flex-1"
                          />
                          <Input
                            value={o.price}
                            inputMode="decimal"
                            onChange={(e) => patchOption(group.key, o.key, { price: e.target.value })}
                            placeholder="0"
                            aria-label={`Price for ${o.name || 'this option'}`}
                            className="w-28"
                          />
                          <IconButton
                            label={`Remove ${o.name || 'option'}`}
                            tone="danger"
                            onClick={() => patchGroup(group.key, { options: group.options.filter((x) => x.key !== o.key) })}
                          >
                            <X />
                          </IconButton>
                        </div>
                        <Err k={`option-${o.key}`} />
                      </div>
                    ))}
                    <Err k={`group-${group.key}-options`} />
                    <Button variant="ghost" size="sm" onClick={() => patchGroup(group.key, { options: [...group.options, blankOption()] })}>
                      <Plus /> Add option
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-cocoa-soft">Add a group:</span>
              {PRESETS[section].map((p) => (
                <Button key={p.label} variant="soft" size="sm" onClick={() => setDraft((d) => ({ ...d, groups: [...d.groups, p.make()] }))}>
                  <Plus /> {p.label}
                </Button>
              ))}
            </div>
          </Card>

          {item && (
            <Card className="border-berry/25 p-4 sm:p-5">
              <h2 className="font-display text-lg font-semibold text-cocoa">Delete this item</h2>
              <p className="mt-0.5 text-sm text-cocoa-soft">Gone for good. To take it off the website for a while, switch off “Show on website” instead. Past orders keep their copy.</p>
              <Button variant="outline" size="sm" className="mt-3 border-berry/40 text-berry hover:bg-berry-50" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Delete {item.name}
              </Button>
            </Card>
          )}
        </div>

        {/* Live preview + visibility */}
        <aside className="space-y-5 lg:sticky lg:top-6 lg:h-fit">
          <Card className="divide-y divide-crumb px-4 sm:px-5">
            <SwitchRow id="ed-available" icon={<Eye />} title="Show on website" description="Off hides it without deleting." checked={draft.available} onCheckedChange={(v) => set('available', v)} />
            <SwitchRow id="ed-popular" icon={<Heart />} title="Favourite" description="Gets a Favourite badge." checked={draft.popular} onCheckedChange={(v) => set('popular', v)} />
            <SwitchRow id="ed-message" icon={<MessageSquareText />} title="Allow a message" description="A short message on the cake or box." checked={draft.allowMessage} onCheckedChange={(v) => set('allowMessage', v)} />
            <SwitchRow id="ed-gift" icon={<Gift />} title="Sent as a gift" description="Checkout asks who it’s for and a card note." checked={draft.isGift} onCheckedChange={(v) => set('isGift', v)} />
          </Card>
          <div>
            <p className="sc-eyebrow mb-2 flex items-center gap-1.5">
              <Eye className="size-3.5" aria-hidden /> Live preview
            </p>
            <ProductPreview
              name={draft.name}
              description={draft.description}
              price={Number(draft.price) || 0}
              image={shownImage}
              section={section}
              popular={draft.popular}
              allowMessage={draft.allowMessage}
              isGift={draft.isGift}
              minQuantity={Number(draft.minQuantity) || 1}
              groups={previewGroups}
              hidden={!draft.available}
            />
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-crumb bg-cream/95 px-4 pt-3 pb-safe backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <p className="hidden flex-1 text-sm text-cocoa-soft sm:block">{dirty ? 'You have unsaved changes.' : item ? 'No changes yet.' : 'Fill in the details, then save.'}</p>
          <Link to={`/menu?section=${section}`} className={buttonClass('outline', 'lg', 'flex-1 sm:flex-none')}>
            Cancel
          </Link>
          <Button size="lg" loading={saving} onClick={() => void save()} className="flex-[2] sm:flex-none">
            {item ? 'Save changes' : `Add to ${info.label}`}
          </Button>
        </div>
      </div>

      <LeaveGuard blocker={blocker} />
      <Confirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${item?.name ?? 'this item'}?`}
        body="It comes off the menu for good. Past orders aren’t affected."
        confirmLabel="Delete item"
        loading={deleting}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
