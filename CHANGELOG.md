# 📋 CHANGELOG — Vendor Scraper / Clawbot

> **Purpose:** This file is updated every time a new feature is added, a bug is fixed, or anything important changes.
> It exists so that even after a conversation is lost, any AI assistant (or future-you!) can read this file and
> immediately understand where the project is and what to work on next.
>
> **Format:** Newest entries at the top.

---

## [2026-06-10] — Project Review & Changelog Created

### Added
- This `CHANGELOG.md` file to track all progress going forward.

### Notes / Context
- Conversation history was lost; this file now serves as the persistent memory of the project.
- Two terminal processes must be running simultaneously for the system to work (see **HOW TO START** section below).

---

## [2026-06-09] — Autonomous Campaign Engine (ClawdBot v2)

### Added
- **`CampaignSetting` model & migration** (`database/migrations/2026_06_09_192125_create_campaign_settings_table.php`)
  - Stores: campaign name, message template (custom or null), messages-per-hour rate, active/paused flag,
    target platforms (array), search URLs (array), and `kudicall_link` override.
  - Static helper `CampaignSetting::getActive()` — always returns (or creates) the single active campaign row.

- **`OutreachLog` model & migration** (`database/migrations/2026_06_09_192124_create_outreach_logs_table.php`)
  - Records every WhatsApp send attempt: vendor_id, channel, message_sent, status (sent/failed),
    phone, error_message, sent_at, replied_at.

- **`ScrapeThenOutreachJob`** (`app/Jobs/ScrapeThenOutreachJob.php`)
  - A single Laravel queue job that:
    1. Checks if the campaign is active (pauses itself if not).
    2. Runs the correct scraper script (Jiji, Konga, Jumia, eBay, Amazon, OLX) via a Node subprocess.
    3. Saves new vendors to the database.
    4. Automatically dispatches an `OutreachJob` for each *new* vendor, staggered 3 min apart.

- **`OutreachJob`** (`app/Jobs/OutreachJob.php`)
  - Picks up a vendor from the DB, reads campaign settings (custom template + link),
    then POSTs to Clawbot's HTTP server (`/send`) to send the WhatsApp message.
  - Auto-retries 3 times (1min → 5min → 15min) on failure.
  - Updates `vendors.status` → `contacted` on success, `failed` on permanent failure.
  - Logs every attempt to `outreach_logs`.

- **`ClawbotController`** (`app/Http/Controllers/ClawbotController.php`)
  - Laravel HTTP API to control everything from the dashboard / Blade UI.

- **Outreach columns on `vendors` table** (migration `2026_06_09_192125_add_outreach_columns_to_vendors_table.php`)
  - Added: `status`, `contacted_at`, `outreach_channel`, `last_reply`.

- **Jobs table** (`database/migrations/2026_06_09_192657_create_jobs_table.php`)
  - Standard Laravel database-backed queue table so jobs survive server restarts.

### Modified
- **`Vendor` model** — added `outreachLogs()` relationship + `scopePending()` scope.
- **`bot_server.js`** — added support for `custom_template` and `kudicall_link` overrides passed per-job.

---

## [2026-04-23] — Core Scraper & Clawbot v1

### Added
- **`Vendor` model & migration** — stores scraped vendor name, phone, whatsapp, products (JSON).
- **`app/scraper.js`** — main Jiji scraper using Puppeteer + stealth plugin. Logs into Jiji,
  scrolls listings, extracts vendor phone/WhatsApp/products.
- **`app/konga_scraper.js`** — Konga product scraper.
- **`app/jumia_scraper.js`** — Jumia product scraper.
- **`app/ebay_scraper.js`** — eBay product scraper.
- **`app/amazon_scraper.js`** — Amazon product scraper.
- **`app/olxGumtree_scraper.js`** — OLX/Gumtree scraper.
- **`app/clawbot/bot_server.js`** — WhatsApp bot server (Node.js + whatsapp-web.js).
  - Connects to WhatsApp via QR code scan (session saved after first scan).
  - Exposes HTTP API on port 3001: `POST /send`, `GET /health`, `GET /stats`.
  - In-memory send queue with 45–90 second human-like gaps between messages.
  - Rate limiter: max 20 messages/hour (configurable via `CLAWBOT_RATE_PER_HOUR` env var).
  - Auto-reconnects if WhatsApp disconnects.
- **`app/clawbot/message_templates.js`** — WhatsApp pitch message templates.
  - `buildPitchMessage(name, product)` — personalised intro mentioning the vendor's listing.
  - `buildLinkMessage()` — follow-up with the Kudicall signup link.
- **`VendorController`** (`app/Http/Controllers/VendorController.php`) — CRUD for vendors.
- **Laravel queue** setup using database driver.

---

## ═══════════════════════════════════════════════════════════════
## 🚀 HOW TO START THE SYSTEM (Read this every session!)
## ═══════════════════════════════════════════════════════════════

You need **TWO terminal windows** open at the same time in the project folder:
`C:\laragon\www\vendor-scraper`

### Terminal 1 — Start Clawbot (WhatsApp Bot)
```bash
npm run clawbot
```
Or equivalently:
```bash
node app/clawbot/bot_server.js
```
- **First time ever:** A QR code will appear in the terminal. Open WhatsApp on phone number
  `09031761631` → Linked Devices → Scan the QR code.
- **After that:** The session is saved. No QR needed — it just says "✅ WhatsApp client READY".
- Clawbot listens on **port 3001** and waits for Laravel to send it jobs.

### Terminal 2 — Start Laravel Queue Worker
```bash
php artisan queue:work --tries=3 --sleep=3
```
- This processes the `OutreachJob` and `ScrapeThenOutreachJob` jobs from the database queue.
- Laravel's queue jobs POST to Clawbot's port 3001 to actually send WhatsApp messages.
- Keep this running as long as you want the bot to work.

### Optional — Check Clawbot health
Open in browser: http://127.0.0.1:3001/health
Returns JSON showing if WhatsApp is connected, how many messages sent this hour, etc.

### Optional — Run the scraper manually (for testing)
```bash
node app/scraper.js "https://jiji.ng/search?query=phone+seller" 10
```

---

## 🗺️ WHAT THIS PROJECT DOES (Plain English Summary)

This is an **automated vendor outreach system** for **Kudicall** (a Nigerian marketplace app).

1. **Scrape** — The system visits online marketplaces (Jiji, Konga, Jumia, etc.) using a headless
   browser (Puppeteer) and finds people selling products. It collects their names, phone numbers,
   and what they sell.

2. **Save** — Those vendor details are saved to a MySQL database.

3. **Message** — For each new vendor, a WhatsApp message is automatically sent (via Clawbot)
   pitching them on joining Kudicall. The message mentions their actual product listing to feel
   personal. A follow-up message with the Kudicall signup link is sent 3.5 seconds later.

4. **Track** — Every message attempt is logged in `outreach_logs`. Vendor status is updated
   to `contacted`, `failed`, `pending`, or `converted`.

5. **Campaign Control** — The `campaign_settings` table controls everything: on/off switch,
   custom message template, messages-per-hour rate limit, and the Kudicall link to include.

---

## 🗂️ KEY FILES QUICK REFERENCE

| File | What it does |
|------|-------------|
| `app/clawbot/bot_server.js` | WhatsApp bot — the actual sender |
| `app/clawbot/message_templates.js` | The pitch message text |
| `app/Jobs/OutreachJob.php` | Laravel job that triggers one WhatsApp send |
| `app/Jobs/ScrapeThenOutreachJob.php` | Laravel job: scrape a URL → save vendors → queue outreach |
| `app/Models/Vendor.php` | DB model for scraped vendors |
| `app/Models/OutreachLog.php` | DB model for message logs |
| `app/Models/CampaignSetting.php` | DB model for campaign config |
| `app/Http/Controllers/ClawbotController.php` | Laravel API to control the campaign |
| `app/scraper.js` | Main Jiji scraper |
| `storage/logs/clawbot.log` | Clawbot's log file |

---

## 📌 NEXT / TODO (things to work on)

- [ ] Build a dashboard UI (Blade or API) to see vendor stats at a glance
- [ ] Add reply detection — update `vendors.last_reply` when a vendor replies on WhatsApp
- [ ] Cron job to auto-trigger `ScrapeThenOutreachJob` on a schedule
- [ ] Add email outreach channel alongside WhatsApp
- [ ] Deployed production environment setup

