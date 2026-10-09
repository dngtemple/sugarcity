import { create as createQr } from 'qrcode';

/** A4 sticker sheets, in millimetres as printed on the pack. */
export interface LabelSheet {
  id: string;
  label: string;
  hint: string;
  cols: number;
  rows: number;
  w: number;
  h: number;
  top: number;
  left: number;
  gapX: number;
  gapY: number;
}

export const LABEL_SHEETS: LabelSheet[] = [
  { id: 'a4-21', label: '21 per sheet', hint: '3 × 7 · 63.5 × 38.1 mm', cols: 3, rows: 7, w: 63.5, h: 38.1, top: 15.15, left: 7.25, gapX: 2.5, gapY: 0 },
  { id: 'a4-24', label: '24 per sheet', hint: '3 × 8 · 70 × 37 mm', cols: 3, rows: 8, w: 70, h: 37, top: 0.5, left: 0, gapX: 0, gapY: 0 },
  { id: 'a4-40', label: '40 per sheet', hint: '4 × 10 · 52.5 × 29.7 mm', cols: 4, rows: 10, w: 52.5, h: 29.7, top: 0, left: 0, gapX: 0, gapY: 0 },
];

export const A4 = { w: 210, h: 297 };
export const MM_TO_PX = 96 / 25.4;

/** Where label `index` (0-based, on its page) sits, in mm. */
export function slotPosition(sheet: LabelSheet, index: number) {
  const col = index % sheet.cols;
  const row = Math.floor(index / sheet.cols);
  return {
    left: sheet.left + col * (sheet.w + sheet.gapX),
    top: sheet.top + row * (sheet.h + sheet.gapY),
  };
}

/** Lays labels onto pages, leaving the first `skip` stickers of page one empty. */
export function paginateLabels<T>(entries: T[], sheet: LabelSheet, skip: number) {
  const perPage = sheet.cols * sheet.rows;
  const blanks = Math.min(Math.max(Math.floor(skip) || 0, 0), perPage - 1);
  const slots: (T | null)[] = [...Array.from({ length: blanks }, () => null), ...entries];
  const pages: (T | null)[][] = [];
  for (let i = 0; i < slots.length; i += perPage) pages.push(slots.slice(i, i + perPage));
  return { pages, perPage, blanks };
}

/** The QR code as one SVG path built from the module grid: no canvas, prints razor sharp. */
export function qrPath(text: string) {
  const { modules } = createQr(text, { errorCorrectionLevel: 'M' });
  const quiet = 2;
  let d = '';
  for (let r = 0; r < modules.size; r++) {
    for (let c = 0; c < modules.size; c++) {
      if (modules.get(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return { d, size: modules.size + quiet * 2 };
}
