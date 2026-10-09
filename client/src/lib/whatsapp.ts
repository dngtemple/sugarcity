import { trackingLink } from './tracking';
import { formatDateLong, formatMoney } from './utils';

export function whatsappLink(number: string, text?: string) {
  const digits = number.replace(/\D/g, '');
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export interface MessageLine {
  name: string;
  quantity: number;
  unitPrice: number;
  options: { group: string; name: string }[];
  message: string;
}

export interface OrderMessage {
  orderNumber?: string;
  lines: MessageLine[];
  total: number;
  customerName: string;
  customerPhone: string;
  orderType: 'pickup' | 'delivery';
  date: string;
  time: string;
  address: string;
  landmark: string;
  pickupAddress: string;
  notes: string;
  gift?: { recipientName: string; recipientPhone: string; message: string };
}

/** The order as a WhatsApp message (*bold*, _italic_). */
export function buildOrderMessage(o: OrderMessage) {
  const out: string[] = ['Hi Sugar City! Here’s my order.', ''];
  if (o.orderNumber) out.push(`*Order ${o.orderNumber}*`, '');

  o.lines.forEach((line, i) => {
    if (i > 0) out.push('');
    out.push(`• ${line.quantity} × *${line.name}* (${formatMoney(line.unitPrice * line.quantity)})`);
    const groups = new Map<string, string[]>();
    for (const opt of line.options) groups.set(opt.group, [...(groups.get(opt.group) ?? []), opt.name]);
    for (const [group, names] of groups) out.push(`   ${group}: ${names.join(', ')}`);
    if (line.message) out.push(`   Write on it: “${line.message}”`);
  });

  out.push('', `*Total: ${formatMoney(o.total)}*`, '');

  if (o.gift) {
    out.push(`*A gift for:* ${o.gift.recipientName}${o.gift.recipientPhone ? ` (${o.gift.recipientPhone})` : ''}`);
    if (o.gift.message) out.push(`*Card says:* “${o.gift.message}”`);
    out.push('');
  }

  const when = `${formatDateLong(o.date)}, ${o.time}`;
  if (o.orderType === 'delivery') {
    out.push(`*Deliver on:* ${when}`);
    out.push(`*To:* ${o.address}${o.landmark ? ` (near ${o.landmark})` : ''}`);
  } else {
    out.push(`*Pick up on:* ${when}`);
    if (o.pickupAddress) out.push(`*From:* ${o.pickupAddress}`);
  }
  out.push('', `*Name:* ${o.customerName}`, `*Phone:* ${o.customerPhone}`);
  if (o.notes) out.push(`*Notes:* ${o.notes}`);
  if (o.orderNumber) out.push('', `Track it here: ${trackingLink(o.orderNumber)}`);

  return out.join('\n');
}
