import { useEffect, useState } from 'react';
import { cachedGet } from './cache';
import { FALLBACK_SETTINGS, withDefaults, type ShopSettings } from './settings';

/** The shop settings (opening hours, etc.), cached for a few minutes. Falls back to defaults. */
export function useShopSettings() {
  const [settings, setSettings] = useState<ShopSettings>(FALLBACK_SETTINGS);
  useEffect(() => {
    cachedGet<Partial<ShopSettings>>('/settings', undefined, { ttl: 300_000 })
      .then((s) => setSettings(withDefaults(s)))
      .catch(() => undefined);
  }, []);
  return settings;
}
