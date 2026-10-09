import { useCallback, useEffect, useState } from 'react';
import { cachedGet } from './cache';
import { onInventoryChanged, onOrdersChanged } from './events';
import { useVisiblePoll } from './hooks';
import { needsRestock, type InventoryItem } from './inventory';
import type { OrderSummary } from './orders';

/** Today's order summary: loaded now, every 60 s while visible, and after any order change. */
export function useOrderSummary() {
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(
    (force = false) =>
      cachedGet<OrderSummary>('/orders/summary', undefined, { force, ttl: 15_000 })
        .then((s) => {
          setSummary(s);
          setError(false);
        })
        .catch(() => setError(true)),
    []
  );

  useEffect(() => {
    void load();
    return onOrdersChanged(() => void load(true));
  }, [load]);
  useVisiblePoll(() => void load(true), 60_000);
  return { summary, error, reload: load };
}

/** How many active stock items are out or at their warn-at level. */
export function useLowStockCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const load = () =>
      cachedGet<{ items: InventoryItem[] }>('/inventory/items')
        .then((d) => setCount(d.items.filter(needsRestock).length))
        .catch(() => undefined);
    void load();
    return onInventoryChanged(() => void load());
  }, []);
  return count;
}
