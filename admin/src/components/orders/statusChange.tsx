import toast from 'react-hot-toast';
import { errorMessage } from '../../lib/api';
import { notifyOrdersChanged } from '../../lib/events';
import { STATUS_LABEL, setOrderStatus, type Order, type OrderStatus } from '../../lib/orders';

/**
 * Moves an order to `status`, then shows a toast with Undo for 7 seconds.
 * Resolves with the saved order (or throws after showing an error toast).
 */
export async function changeStatus(
  order: Pick<Order, '_id' | 'orderNumber' | 'status'>,
  status: OrderStatus,
  opts: { done?: string; onUndone?: (o: Order) => void } = {}
) {
  const previous = order.status;
  try {
    const saved = await setOrderStatus(order._id, status);
    notifyOrdersChanged();
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          <span>
            <strong className="tabular">{order.orderNumber}</strong> {opts.done ?? `moved to ${STATUS_LABEL[status]}`}
          </span>
          <button
            type="button"
            className="min-h-9 rounded-full bg-plum-50 px-3 text-sm font-semibold text-plum hover:bg-plum-100"
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                const back = await setOrderStatus(order._id, previous);
                notifyOrdersChanged();
                opts.onUndone?.(back);
                toast.success(`${order.orderNumber} is back to ${STATUS_LABEL[previous]}`);
              } catch (err) {
                toast.error(errorMessage(err, 'Couldn’t undo that. Change it from the order page.'));
              }
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: 7000, icon: '✓' }
    );
    return saved;
  } catch (err) {
    toast.error(errorMessage(err, 'Couldn’t update the order. Please try again.'));
    throw err;
  }
}
