# Sugar City — build spec

Sugar City is a bakery ordering system: a customer website, a staff admin, and an API.
Customers browse, choose options, check out without an account, and the order is saved
and then sent to the shop on WhatsApp. Staff manage orders, counter sales, the menu,
stock (with barcode/QR scanning) and settings.

It has the same capabilities as the sister app "Randa", but **its own brand, words,
components and interface**. Nothing visual or textual should be copied from Randa.

## Layout

```
sugarcity/
  brand/        logo + icons (copy into client/public/brand and admin/public/brand)
  design/       tailwind.config.js + tokens.css (copy verbatim into both front ends)
  server/       Express + MongoDB + TypeScript API          (dev port 5050)
  client/       customer site, Vite + React 19 + Tailwind 3  (dev port 5180)
  admin/        staff portal, Vite + React 19 + Tailwind 3   (dev port 5181)
```

## Brand

- Name: **Sugar City**. Tagline: "Baked for your sweetest moments."
- Voice: warm, short, a bit playful, never cutesy. Say "bag" (not cart), "treats",
  "collection". Prices in Ghana cedis: `GH₵ 120` (pesewas only when non-zero).
- Logo: `brand/sugarcity-logo.png` (150×150, plum on white). Favicon `favicon-32.png`,
  `favicon-48.png`; `apple-touch-icon.png`; PWA `icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png`.
- Colours (see design/tokens.css): cream page `#FCF7F1`, cocoa text `#2B0E25`,
  **plum `#5E0E4E` brand**, **cherry `#D62F45` accent**, **peach `#F7CBA8` accent**,
  mint (success), honey (warning), berry (danger), sky (info).
- Type: **Fraunces** (display, soft optical serif) + **Outfit** (UI sans). Google Fonts:
  `https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,500..800,100&family=Outfit:wght@300..700&display=swap`
- Shape language: pillowy. Buttons are pills (`rounded-full`), cards `rounded-lg`/`rounded-xl`,
  soft plum-tinted shadows (`shadow-soft`, `shadow-lift`), peach and plum blobs, the
  scalloped `.edge-scallop` edge on receipts. Icons: `lucide-react`.
- theme-color / manifest colours: `#5E0E4E` theme, `#FCF7F1` background.
- localStorage keys are prefixed `sc-`. Order numbers are `SC-1001`, `SC-1002`, …

## Collections (menu sections)

| id | Label | Blurb | Icon (lucide) |
|---|---|---|---|
| `cakes` | Cakes | Birthdays, weddings and every celebration in between | `Cake` |
| `pastries` | Pastries & Treats | Cupcakes, doughnuts, cookies, pies and party trays | `Cookie` |
| `gifts` | Gift Boxes | Sweet surprises delivered to someone special | `Gift` |

Each collection has its own "earliest date" notice setting.

## API contract (base `/api`)

Identical in shape to Randa's API (reference: the Randa spec file given to you) with
these differences, which are binding for server, client and admin:

1. `section` enum is `cakes | pastries | gifts` (default `cakes`). No service-charge note.
2. Order numbers `SC-<seq>` starting at SC-1001. Tracking accepts `sc 12`, `SC-12`, `12`.
3. **Settings document** (`GET /api/menu` returns it as `settings`, `GET|PUT /api/settings`):
   ```ts
   {
     shopName: string;            // default "Sugar City"
     whatsappNumber: string;      // digits, e.g. "233200000000"
     phone: string;
     pickupAddress: string;
     paymentInstructions: string; // multi-line
     noticeDays: { cakes: number; pastries: number; gifts: number }; // 0..60 each
     openHour: number;            // 0..23, default 8   (first pickup/delivery slot)
     closeHour: number;           // 1..24, default 19  (last slot is closeHour-1 … closeHour)
     instagram: string;           // handle without @, optional, shown in footer
   }
   ```
   Time slots are hourly from `openHour` to `closeHour` (e.g. "8:00 AM"… "6:00 PM"),
   labelled like `"10:00 AM"`; for today a slot must be ≥ 1 hour away.
4. No legacy fields: no `client`, `nameOnCake`, `flavour`, `receiver*`, `sender*`,
   `proofOfPayment`, no `/orders/:id/proof`, no `in_production` status, no `size` on menu items.
5. Order status: `pending | confirmed | ready | delivered | cancelled`.
6. Item message field: `allowMessage` = "Message on the cake/box" (max 60 chars client side, 100 server side).

### Endpoints (all JSON unless noted)

- `GET  /api/health` → `{status:'ok', timestamp}`
- Auth: `POST /auth/login {email,password}` → `{token,user{id,name,email,phone,role}}`;
  `POST /auth/logout`; `GET /auth/me` → `{user}`; `POST /auth/forgot-password {email}`;
  `POST /auth/reset-password {token,password}`.
- Menu: `GET /menu` (public) → `{items, settings}` (available items only);
  `GET /menu/all` (staff) → `{items}`; `POST /menu` and `PUT /menu/:id` (staff,
  multipart with optional `image` file, `optionGroups` as JSON string, `removeImage=true`);
  `DELETE /menu/:id`.
  MenuItem: `{_id, section, category, name, description, price, available, popular,
  allowMessage, minQuantity, isGift, image, optionGroups:[{_id,name,required,multiple,
  options:[{_id,name,price}]}], createdAt, updatedAt}`.
- Orders: `POST /orders` (public checkout) body
  `{clientRef, customerName, customerPhone, orderType:'pickup'|'delivery', deliveryDate:'YYYY-MM-DD',
  deliveryTime, deliveryLocation?, landmark?, notes?, gift?:{recipientName,recipientPhone,message},
  items:[{menuItemId, optionIds:string[], quantity, message?}]}` →
  `201 {orderNumber,totalAmount,items}` (200 on idempotent replay).
  `GET /orders/track?number=&phone=` → `{orderNumber, firstName, orderType, date, time,
  items[{name,quantity,options:string[]}], totalAmount, status, paid, placedAt, history[{status,at}]}`.
  Staff: `POST /orders/walkin` (lines may be `{menuItemId,optionIds,quantity,message}` or
  `{custom:true,name,price,quantity}`; `paid`, `completed` flags; everything about the customer
  optional), `GET /orders/summary` → `{counts{pending,confirmed,ready,delivered,cancelled},
  dueToday, today{orders,sales,unpaid,items}}`,
  `GET /orders/board` → `{pending:Order[], confirmed:Order[], ready:Order[]}` (**new**: every
  active order for the kanban board, pending newest first, confirmed/ready by due date),
  `GET /orders/sales?from&to&payment&type&status&page` → `{orders, totals{sales,unpaid,orders,items},
  bySection[{section,amount,items}], page, pageSize, total}`,
  `GET /orders?status=&search=&page=` → `{orders,total,page,pageSize,hasMore}`,
  `GET /orders/:id`, `PUT /orders/:id/status {status}`, `PUT /orders/:id/payment {paymentStatus}`.
  Order: `{_id, orderNumber, customerName, customerPhone, orderType, items[{menuItemId,name,section,
  category,price,quantity,options[{group,name,price}],message}], deliveryDate, deliveryTime,
  deliveryLocation, landmark, notes, gift?, status, totalAmount, paymentStatus, paidAt, isWalkIn,
  statusHistory[{status,timestamp,note}], createdAt, updatedAt}`.
- Settings: `GET /settings`, `PUT /settings` (staff, partial).
- Users: `GET /users` → `{users[{id,name,email,phone,active,createdAt,lastLoginAt}]}`;
  `POST /users {name,email,phone,password}`; `PATCH /users/:id {name,phone,active,password}`.
- Inventory (staff): `GET|POST /inventory/items`, `PUT|DELETE /inventory/items/:id`,
  `GET /inventory/movements?item&type&page&limit`, `POST /inventory/movements
  {type:'receive'|'use'|'waste', lines[{itemId,quantity,unitCost?}], supplier?, note?}`,
  `POST /inventory/counts {lines[{itemId,counted}], note?}`. SKUs `SC-STK-0001`.

Auth is a Bearer JWT in `Authorization`. Every staff account has full access.

## Environment variables

Server (`server/.env`, see `.env.example`): `PORT` (5050), `NODE_ENV`, `MONGODB_URI`,
`JWT_SECRET`, `JWT_EXPIRES_IN` (7d), `CLIENT_URL`, `ADMIN_URL`, `RESEND_API_KEY`, `MAIL_FROM`,
`ORDER_EMAIL_TO`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
Front ends: `VITE_API_URL` (e.g. `http://localhost:5050/api`).
