# The Himalayan Regency — Day Book

A deployable, mobile-friendly hotel Day Book using **HTML/CSS/JavaScript**, **Cloudflare Workers**, and **Cloudflare D1 (SQLite)**. Put this project in a GitHub repository; Cloudflare serves the site and the database stores records for multiple devices.

## Included

- `public/index.html` — Day Book, cash/online payments, pending rooms, car rounds, reports, ChatGPT JSON import, backup/export.
- `src/worker.js` — password login and version-checked D1 persistence API.
- `migrations/0001_init.sql` — production SQLite schema for D1.
- `database/starter.sqlite` — **empty local SQLite starter**, for inspection only; D1 uses the SQL migration, not an uploaded .sqlite file.
- `wrangler.jsonc` — Cloudflare config (replace placeholder D1 database ID).
- `.dev.vars.example` — local secret template. **Never commit real secrets.**

## Deploy to Cloudflare from GitHub

1. Create a new **private** GitHub repository and upload the extracted files to the repository root. GitHub stores the source; it is **not** the live SQL database.
2. Install Node.js 20+ on your machine. In a terminal in the project folder, run:

   ```bash
   npm install
   npx wrangler login
   npx wrangler d1 create himalayan-regency-db
   ```

3. Copy the `database_id` UUID displayed by D1 into `wrangler.jsonc` in place of `REPLACE_WITH_DATABASE_ID`. Keep the binding `DB`.
4. Apply the initial database schema **on Cloudflare**:

   ```bash
   npm run db:remote
   ```

5. Create strong secrets through Wrangler (enter values when prompted):

   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put SESSION_SECRET
   ```

   `ADMIN_PASSWORD` is the password used to sign into your website. `SESSION_SECRET` must be an unrelated random string of 32+ characters; do not use the same password. Do not store either in HTML, GitHub, or `wrangler.jsonc`.

6. Publish:

   ```bash
   npm run deploy
   ```

7. Open the `*.workers.dev` URL printed after deployment and sign in. Your devices will access the same Cloudflare D1 data.
8. Later changes: commit/push code to GitHub, and run `npm run deploy` for each release. To automate releases, connect the repository using Cloudflare's Git integration or configure a GitHub Action with Cloudflare credentials; do not assume a GitHub push alone deploys the app.

Official reference: https://developers.cloudflare.com/d1/get-started/ and https://developers.cloudflare.com/workers/static-assets/

## Develop on your laptop

Copy `.dev.vars.example` to `.dev.vars` and fill local testing credentials (the latter is ignored by Git). After setting the database ID in `wrangler.jsonc`:

```bash
npm install
npm run db:local
npm run dev
```

Visit the URL Wrangler prints (usually `http://localhost:8787`). `--local` uses a local D1 copy; `--remote` affects the production D1 database. **Never accidentally apply a destructive migration remotely.**

## Daily usage

1. Take three handwritten hotel sheets and send them to ChatGPT.
2. Verify extracted income, outgoing, payment mode (Cash or Online), payee (HA, car, supplier, person), expense/transfer/advance, pending rooms, and car rounds.
3. Ask ChatGPT for **verified Day Book JSON**; use **Import Data > Preview > Confirm** in the app.
4. Importing the same IDs again skips duplicates. Export a backup regularly.

The manager's handwritten **cash-in-hand / manager-held balance** figures are intentionally ignored.

**Accounting caveat:** This V1 continues the user's legacy Day Book definition: all outgoing entries reduce the operational carry-forward, regardless of whether labeled `expense`, `transfer`, or `advance`; the transaction is categorized separately. Transfers can be distinguished in the payment ledger, but are not automatically reconciled to a second account. Do not treat the Day Book net as formal profit without classifying transfers/advances.

## JSON import shape

```json
{
  "date": "2026-11-19",
  "entries": [
    {"id":"sample-income-209","type":"incoming","description":"Room 209","amount":6000,"method":"Online"},
    {"id":"sample-ha-transfer","type":"outgoing","description":"Money given to HA","amount":2000,"method":"Online","recipient":"HA","category":"transfer"},
    {"id":"sample-gas","type":"outgoing","description":"Gas refill","amount":1200,"method":"Cash","recipient":"Gas supplier","category":"expense"}
  ],
  "pending": [{"id":"sample-room-205","room":"205","guest":"Guest","due":1500}],
  "cars": [{"id":"sample-car-6168","date":"2026-11-19","car":"HP 58 6168","rounds":1,"amount":800}]
}
```

Use unique stable IDs (especially when two transactions have the same amount and description). The example above is **demo data** and not included in the database.

## Security and limitations

- Login cookie: Secure, HttpOnly, SameSite=Lax, signed with HMAC, valid seven days; no financial records are sent to localStorage.
- The HTML frontend is public, but financial API endpoints require an authenticated session.
- V1 uses a **single hotel-wide login**, not staff roles or an audit log. Put Cloudflare Access/rate limiting in front before production staff use, especially against repeated password attempts.
- Updates use an atomic revision check. If another device changes data before your edit saves, the app downloads a recovery backup and reloads cloud records rather than silently overwriting them.
- The app **does not OCR images**. ChatGPT extracts the sheets outside the app, and you import the reviewed JSON.
- A database starter file is not a production D1 database. Production data lives in Cloudflare; use D1 backups and exported JSON files to protect records.
