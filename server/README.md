# Sugar City API

The API behind the Sugar City customer site and staff admin: menu, checkout,
order tracking, counter sales, the sales report, stock and settings.

Express 4, MongoDB (Mongoose 8) and TypeScript. Email goes through Resend and
menu photos through Cloudinary; both are optional while developing.

## Run it locally

You need Node 20 or newer and MongoDB (a local install, or an Atlas connection string).

```bash
cd server
npm install
cp .env.example .env        # then fill in JWT_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
npm run seed                # creates the admin account and a sample menu
npm run dev                 # http://localhost:5050/api/health
```

| Script | What it does |
|---|---|
| `npm run dev` | Runs `src/index.ts` with tsx and restarts on changes. |
| `npm run build` | Compiles TypeScript to `dist/`. |
| `npm start` | Runs the compiled server (`dist/index.js`). |
| `npm run seed` | Creates the admin, and adds the sample menu if the menu is empty. |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | Port to listen on. Defaults to `5050`. Render sets this for you. |
| `NODE_ENV` | no | Set to `production` when deployed. This turns on the rate limits, trusts Render's proxy for visitor IPs and hides internal error messages. |
| `MONGODB_URI` | **yes** | MongoDB connection string, e.g. `mongodb://127.0.0.1:27017/sugarcity`. |
| `JWT_SECRET` | **yes** | A long random string used to sign staff sign-in tokens. If you change it, everyone is signed out. |
| `JWT_EXPIRES_IN` | no | How long a sign-in lasts, e.g. `7d` (the default in `.env.example`). |
| `CLIENT_URL` | **yes** | The customer site's address, e.g. `https://sugarcity.vercel.app`. Used for CORS. You can list several, separated by commas. |
| `ADMIN_URL` | **yes** | The admin's address. Used for CORS and for links in emails (the first one if you list several). |
| `RESEND_API_KEY` | no | Resend API key. Leave it blank and no email is sent. |
| `MAIL_FROM` | no | Sender, e.g. `Sugar City <orders@yourdomain.com>`. Must be on a domain verified in Resend. Defaults to Resend's test sender. |
| `ORDER_EMAIL_TO` | no | Inbox that gets an email for every new website order. |
| `CLOUDINARY_CLOUD_NAME` | no | Cloudinary account for menu photos (saved in the `sugarcity/menu` folder). Photo uploads fail until all three are set. |
| `CLOUDINARY_API_KEY` | no | See above. |
| `CLOUDINARY_API_SECRET` | no | See above. |
| `SEED_ADMIN_EMAIL` | for seeding | Email for the first admin account created by `npm run seed`. |
| `SEED_ADMIN_PASSWORD` | for seeding | Password for that account (at least 6 characters). Change it after first sign-in. |

In development, the server also accepts requests from any `localhost` or
`127.0.0.1` origin, so the Vite dev servers (ports 5180 and 5181) just work.

## Seeding

`npm run seed`:

1. Creates the admin from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. It refuses
   to run if either is missing, and leaves an existing account alone (its password
   is not changed).
2. Adds a sample menu of cakes, pastries and gift boxes, **only if there are no menu
   items yet**. It never deletes anything.

To throw away the whole menu and start again from the sample, run
`npm run seed -- --reset-menu`. This deletes every menu item, so don't run it
against the live shop.

## Deploying to Render

The repo root has a `render.yaml` blueprint. You can use it (New, then Blueprint)
or set up the service by hand:

1. **New, then Web Service**, and connect the repo.
2. **Root directory:** `server`
3. **Runtime:** Node
4. **Build command:** `npm install && npm run build`
5. **Start command:** `npm start`
6. **Health check path:** `/api/health`
7. **Environment:** set `NODE_ENV=production`, plus everything marked required in
   the table above. `CLIENT_URL` and `ADMIN_URL` must be the exact Vercel
   addresses of the two front ends, with no trailing slash. Add the Resend and
   Cloudinary settings when you're ready for email and photos.
8. Once it's deployed, seed the live database once from your own machine. Point
   `MONGODB_URI` at it and set the seed variables, then run `npm run seed`.
   Afterwards, remove the seed password from wherever you put it.

On Render's free plan the service sleeps when idle, and the first request after
that can take up to a minute. The front ends allow for this.

Point both front ends at the API with `VITE_API_URL=https://<your-service>.onrender.com/api`.

## API overview

Everything is under `/api`. "Staff" routes need an `Authorization: Bearer <token>`
header from `POST /auth/login`. See `../design/SPEC.md` for the request and
response shapes.

- `GET /health`
- **Auth:** `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password`
- **Menu:** `GET /menu` (public, with settings), `GET /menu/all`, `POST /menu`, `PUT /menu/:id`, `DELETE /menu/:id`
- **Orders:** `POST /orders` (public checkout), `GET /orders/track` (public), `POST /orders/walkin`, `GET /orders/summary`, `GET /orders/board`, `GET /orders/sales`, `GET /orders`, `GET /orders/:id`, `PUT /orders/:id/status`, `PUT /orders/:id/payment`
- **Settings:** `GET /settings`, `PUT /settings`
- **Staff accounts:** `GET /users`, `POST /users`, `PATCH /users/:id`
- **Stock:** `GET|POST /inventory/items`, `PUT|DELETE /inventory/items/:id`, `GET|POST /inventory/movements`, `POST /inventory/counts`
