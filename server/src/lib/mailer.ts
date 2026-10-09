import type { IOrder } from '../models/Order.model';
import { SECTION_LABELS, type Section } from '../config/sections';

// Email goes out through Resend's HTTP API — no SMTP, so nothing to keep
// open on Render's free tier and no app password to rotate.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Sender. Must be on a domain verified in Resend, or Resend's test sender. */
const MAIL_FROM = process.env.MAIL_FROM || 'Sugar City <onboarding@resend.dev>';
/** Inbox that gets "new order" alerts. */
const ORDER_ALERT_TO = process.env.ORDER_EMAIL_TO || '';

// Brand colours, inlined because email clients ignore stylesheets.
const PLUM = '#5E0E4E';
const CHERRY = '#D62F45';
const CREAM = '#FCF7F1';
const PEACH = '#F7CBA8';
const COCOA = '#2B0E25';
const MUTED = '#7A5C70';
const LINE = '#EADFD6';
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

/**
 * The admin's address for links in emails. ADMIN_URL may list several
 * origins for CORS; the first one is the one people use.
 */
export const adminUrl = () =>
  (process.env.ADMIN_URL || 'http://localhost:5181').split(',')[0].trim().replace(/\/+$/, '');

function assertMailerConfigured(context: string) {
  if (!RESEND_API_KEY) {
    throw new Error(`[Mailer] Cannot send ${context}: the RESEND_API_KEY environment variable is not set on this server.`);
  }
}

/**
 * Posts one email to Resend. Returns false when the server has no mail
 * configuration, so optional emails can be skipped quietly; a rejection from
 * Resend (bad key, unverified sender) throws so the caller can log it.
 */
async function sendEmail(to: string, subject: string, html: string, context: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn(`[Mailer] RESEND_API_KEY not set — skipping ${context}`);
    return false;
  }
  if (!to) {
    console.warn(`[Mailer] No recipient for ${context} — skipping`);
    return false;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html }),
    // Never let a hung request hold an order response open.
    signal: AbortSignal.timeout(15_000),
  });

  const body = (await response.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;
  if (!response.ok) {
    throw new Error(`[Mailer] Resend rejected the ${context} (HTTP ${response.status}): ${body?.message || body?.name || 'no details'}`);
  }
  console.log(`[Mailer] ${context} sent to ${to} (id: ${body?.id ?? 'unknown'})`);
  return true;
}

// Report the mail configuration once at startup so misconfiguration shows up
// in logs immediately instead of silently when the first email is attempted.
export function verifyMailer() {
  if (!RESEND_API_KEY) {
    console.warn('[Mailer] RESEND_API_KEY is NOT set — outgoing email is disabled.');
    return;
  }
  console.log(`[Mailer] Resend ready (sending as ${MAIL_FROM})`);
  if (ORDER_ALERT_TO) {
    console.log(`[Mailer] New-order alerts go to ${ORDER_ALERT_TO}`);
  } else {
    console.warn('[Mailer] ORDER_EMAIL_TO is not set — new-order alerts will be skipped.');
  }
}

/** Customer-typed text goes into these emails, so everything is escaped. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** GH₵ 120, or GH₵ 120.50 — pesewas only when there are some. */
function formatCedis(amount: number) {
  const hasPesewas = Math.round(amount * 100) % 100 !== 0;
  return `GH₵ ${amount.toLocaleString('en-GH', {
    minimumFractionDigits: hasPesewas ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function detailRow(label: string, valueHtml: string): string {
  return `
  <tr>
    <td style="padding:7px 0;font-family:${SANS};font-size:13px;color:${MUTED};width:130px;vertical-align:top">${esc(label)}</td>
    <td style="padding:7px 0;font-family:${SANS};font-size:15px;color:${COCOA}">${valueHtml}</td>
  </tr>`;
}

function heading(title: string): string {
  return `<h2 style="margin:28px 0 6px;font-family:${SERIF};font-size:18px;font-weight:normal;color:${PLUM}">${esc(title)}</h2>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.6;color:${COCOA}">${html}</p>`;
}

function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${CHERRY};color:#ffffff;text-decoration:none;font-family:${SANS};font-size:15px;font-weight:600;padding:13px 28px;border-radius:999px">${esc(label)}</a>`;
}

/**
 * Shared shell: plum masthead with the shop name in serif, a rounded white
 * card on cream, and a small sign-off underneath.
 */
function layout(opts: { preheader: string; eyebrow: string; title: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${CREAM}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:28px 14px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:${PLUM};border-radius:20px 20px 0 0;padding:26px 30px 22px">
          <p style="margin:0;font-family:${SERIF};font-size:15px;letter-spacing:0.04em;color:${PEACH}">Sugar City</p>
          <p style="margin:14px 0 0;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${PEACH}">${esc(opts.eyebrow)}</p>
          <h1 style="margin:4px 0 0;font-family:${SERIF};font-size:26px;font-weight:normal;line-height:1.25;color:#ffffff">${esc(opts.title)}</h1>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid ${LINE};border-top:0;border-radius:0 0 20px 20px;padding:22px 30px 30px">${opts.body}</td></tr>
        <tr><td style="padding:18px 30px 0;text-align:center;font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTED}">
          Sent automatically by Sugar City · Baked for your sweetest moments.<br/>Replies to this address aren’t read.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** "Size: 8 inch" lines, one per option group, for an order line. */
function optionLines(options: IOrder['items'][number]['options']): string[] {
  const byGroup = new Map<string, string[]>();
  for (const o of options) byGroup.set(o.group, [...(byGroup.get(o.group) ?? []), o.name]);
  return [...byGroup].map(([group, names]) => `${group ? `${esc(group)}: ` : ''}${names.map(esc).join(', ')}`);
}

export async function sendNewOrderEmail(order: IOrder) {
  if (!RESEND_API_KEY || !ORDER_ALERT_TO) {
    console.warn('[Mailer] Resend key or ORDER_EMAIL_TO not set — skipping new-order email');
    return;
  }

  const isDelivery = order.orderType === 'delivery';
  const when = [
    order.deliveryDate
      ? new Date(order.deliveryDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
      : '',
    order.deliveryTime,
  ].filter(Boolean).join(', ');
  const firstName = order.customerName.split(/\s+/)[0] || 'Someone';

  const itemRows = order.items
    .map((item) => {
      const details = [
        item.section && item.section in SECTION_LABELS ? SECTION_LABELS[item.section as Section] : '',
        ...optionLines(item.options),
        item.message ? `Message: “${esc(item.message)}”` : '',
      ].filter(Boolean);
      return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px dashed ${LINE};font-family:${SANS};font-size:15px;color:${COCOA};vertical-align:top">
          <span style="color:${CHERRY};font-weight:600">${item.quantity}×</span> ${esc(item.name)}
          ${details.length ? `<div style="margin-top:3px;font-size:13px;line-height:1.5;color:${MUTED}">${details.join('<br/>')}</div>` : ''}
        </td>
        <td style="padding:12px 0 12px 12px;border-bottom:1px dashed ${LINE};font-family:${SANS};font-size:15px;color:${COCOA};text-align:right;vertical-align:top;white-space:nowrap">${formatCedis(item.price * item.quantity)}</td>
      </tr>`;
    })
    .join('');

  const body = `
    ${paragraph(`${esc(firstName)} just placed an order on the website. They’ll follow up on WhatsApp — here’s everything in one place.`)}

    ${heading('Who')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRow('Name', esc(order.customerName))}
      ${detailRow('Phone', `<a href="tel:${esc(order.customerPhone)}" style="color:${PLUM}">${esc(order.customerPhone)}</a>`)}
    </table>

    ${order.gift ? `${heading('A gift for')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRow('Name', esc(order.gift.recipientName))}
      ${detailRow('Phone', esc(order.gift.recipientPhone))}
      ${order.gift.message ? detailRow('Card says', `“${esc(order.gift.message)}”`) : ''}
    </table>` : ''}

    ${heading(isDelivery ? 'Delivery' : 'Pickup')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRow('When', esc(when))}
      ${isDelivery ? detailRow('Address', esc(order.deliveryLocation)) : ''}
      ${isDelivery && order.landmark ? detailRow('Landmark', esc(order.landmark)) : ''}
    </table>

    ${heading('Treats')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${itemRows}
      <tr>
        <td style="padding:14px 0 0;font-family:${SERIF};font-size:18px;color:${PLUM}">Total</td>
        <td style="padding:14px 0 0;font-family:${SERIF};font-size:18px;color:${PLUM};text-align:right;white-space:nowrap">${formatCedis(order.totalAmount)}</td>
      </tr>
    </table>

    ${order.notes ? `${heading('Their notes')}
    <p style="margin:0;padding:12px 14px;background:${CREAM};border-radius:12px;font-family:${SANS};font-size:14px;line-height:1.6;color:${COCOA};white-space:pre-wrap">${esc(order.notes)}</p>` : ''}

    <p style="margin:30px 0 0">${button(`${adminUrl()}/orders/${order.id}`, 'Open the order')}</p>`;

  await sendEmail(
    ORDER_ALERT_TO,
    `New order ${order.orderNumber} · ${order.customerName} · ${formatCedis(order.totalAmount)}`,
    layout({
      preheader: `${order.customerName} ordered ${order.items.length} item${order.items.length === 1 ? '' : 's'} for ${when || 'soon'}.`,
      eyebrow: 'New order',
      title: `${order.orderNumber} just came in`,
      body,
    }),
    `new-order email for ${order.orderNumber}`
  );
}

export interface StaffWelcomeEmailData {
  name: string;
  email: string;
}

/**
 * Lets a new staff member know they have an account. The password is never
 * emailed — whoever added them passes it on in person.
 */
export async function sendStaffWelcomeEmail(data: StaffWelcomeEmailData) {
  if (!RESEND_API_KEY) {
    console.warn('[Mailer] RESEND_API_KEY not set — skipping welcome email');
    return;
  }

  const loginUrl = `${adminUrl()}/login`;
  const body = `
    ${paragraph(`Hi ${esc(data.name.split(/\s+/)[0] || data.name)},`)}
    ${paragraph('Welcome to the team! You now have a Sugar City staff account, so you can see new orders, take counter sales, keep the menu fresh and look after the stock.')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;background:${CREAM};border-radius:14px">
      <tr><td style="padding:12px 18px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${detailRow('Sign in with', esc(data.email))}
          ${detailRow('Password', 'Ask the person who added you for your password.')}
        </table>
      </td></tr>
    </table>
    ${paragraph('<span style="font-size:13px;color:' + MUTED + '">Once you’re in, you can change your password any time with “Forgot password” on the sign-in page.</span>')}
    <p style="margin:22px 0 0">${button(loginUrl, 'Sign in to Sugar City')}</p>`;

  await sendEmail(
    data.email,
    'Welcome to the Sugar City team',
    layout({ preheader: 'Your staff account is ready.', eyebrow: 'Staff account', title: 'Your apron is ready', body }),
    'welcome email'
  );
}

export interface PasswordResetEmailData {
  name: string;
  email: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData) {
  assertMailerConfigured('password-reset email');

  const body = `
    ${paragraph(`Hi ${esc(data.name.split(/\s+/)[0] || data.name)},`)}
    ${paragraph(`Someone (hopefully you) asked to reset the password for your Sugar City staff account. Tap the button to choose a new one — the link works for <strong>${data.expiresInMinutes} minutes</strong>.`)}
    <p style="margin:22px 0">${button(data.resetUrl, 'Choose a new password')}</p>
    <p style="margin:0 0 18px;font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTED};word-break:break-all">Button not working? Paste this into your browser:<br/>${esc(data.resetUrl)}</p>
    ${paragraph(`<span style="font-size:13px;color:${MUTED}">Didn’t ask for this? No need to do anything — your password stays the same.</span>`)}`;

  await sendEmail(
    data.email,
    'Reset your Sugar City password',
    layout({ preheader: 'A link to choose a new password.', eyebrow: 'Password reset', title: 'Let’s get you back in', body }),
    'password-reset email'
  );
}
