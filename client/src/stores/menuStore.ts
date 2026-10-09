import { create } from 'zustand';
import api from '../lib/api';
import { FALLBACK_SETTINGS, isSection, normaliseSettings, type MenuItem, type StoreSettings } from '../lib/menu';
import { useBag } from './bagStore';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface MenuState {
  status: Status;
  /** True once loading has taken long enough to explain the wait. */
  slow: boolean;
  items: MenuItem[];
  settings: StoreSettings;
  load: () => void;
}

let inflight = false;

/** Menu + shop settings, fetched once for the whole site in one request. */
export const useMenu = create<MenuState>()((set, get) => ({
  status: 'idle',
  slow: false,
  items: [],
  settings: FALLBACK_SETTINGS,

  load: () => {
    if (inflight || get().status === 'ready') return;
    inflight = true;
    set({ status: 'loading', slow: false });
    const slowTimer = window.setTimeout(() => set({ slow: true }), 5000);

    api
      .get<{ items: MenuItem[]; settings: Partial<StoreSettings> }>('/menu')
      .then(({ data }) => {
        const items = (Array.isArray(data.items) ? data.items : []).map((i) => ({
          ...i,
          section: isSection(i.section) ? i.section : 'cakes',
          minQuantity: i.minQuantity > 1 ? i.minQuantity : 1,
          isGift: i.isGift === true,
          available: i.available !== false,
        }));
        set({ status: 'ready', items, settings: normaliseSettings(data.settings) });
        useBag.getState().reconcile(items);
      })
      .catch(() => set({ status: 'error' }))
      .finally(() => {
        inflight = false;
        window.clearTimeout(slowTimer);
        set({ slow: false });
      });
  },
}));

/** Settings to use right now: live when loaded, fallback otherwise. */
export const useSettings = () => useMenu((s) => s.settings);
