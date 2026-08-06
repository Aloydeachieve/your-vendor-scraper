// ─────────────────────────────────────────────────────────────
// CLAWBOT — WhatsApp Bot Server
// ─────────────────────────────────────────────────────────────
// This runs as a persistent Node.js process.
// Laravel's OutreachJob calls it via HTTP POST /send
//
// HOW TO START:
//   node app/clawbot/bot_server.js
//
// FIRST RUN: Scan the QR code shown in your terminal with
// the WhatsApp on number 09031761631.
// Session is saved — no QR needed after that.
// ─────────────────────────────────────────────────────────────

import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

import qrcode from "qrcode-terminal";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildPitchMessage, buildLinkMessage } from "./message_templates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIG ──────────────────────────────────────────────────
const BOT_PORT = process.env.CLAWBOT_PORT || 3001;
const RATE_LIMIT = parseInt(process.env.CLAWBOT_RATE_PER_HOUR) || 20; // msgs/hour
const LINK_DELAY_MS = 3500; // delay between pitch msg and link msg
const LOG_FILE = path.resolve(__dirname, "../../storage/logs/clawbot.log");

// ─── LOGGER ──────────────────────────────────────────────────
function log(level, ...args) {
    const line = `[${new Date().toISOString()}] [${level}] ${args.join(" ")}`;
    console.log(line);
    try {
        const dir = path.dirname(LOG_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(LOG_FILE, line + "\n");
    } catch (_) {}
}

// ─── RATE LIMITER ─────────────────────────────────────────────
// Tracks how many messages sent in the current hour window
let sentThisHour = 0;
let hourWindowStart = Date.now();

function resetHourIfNeeded() {
    if (Date.now() - hourWindowStart >= 3600000) {
        sentThisHour = 0;
        hourWindowStart = Date.now();
        log("INFO", `Rate limit window reset. Fresh ${RATE_LIMIT} msgs allowed.`);
    }
}

function isRateLimited() {
    resetHourIfNeeded();
    return sentThisHour >= RATE_LIMIT;
}

function recordSent() {
    sentThisHour++;
}

// ─── SEND QUEUE ───────────────────────────────────────────────
// Simple in-memory queue to space out messages
const sendQueue = [];
let processingQueue = false;

async function enqueueSend(phone, name, product, jobId, customTemplate, kudicallLink) {
    return new Promise((resolve) => {
        sendQueue.push({ phone, name, product, jobId, customTemplate, kudicallLink, resolve });
        if (!processingQueue) processQueue();
    });
}

async function processQueue() {
    processingQueue = true;
    while (sendQueue.length > 0) {
        resetHourIfNeeded();
        if (isRateLimited()) {
            const waitMs = 3600000 - (Date.now() - hourWindowStart);
            log(
                "WARN",
                `Rate limit reached (${RATE_LIMIT}/hr). Queue paused for ${Math.round(waitMs / 60000)} min.`,
            );
            await sleep(waitMs);
            resetHourIfNeeded();
        }

        const job = sendQueue.shift();
        const result = await doSendMessages(
            job.phone,
            job.name,
            job.product,
            job.jobId,
            job.customTemplate,
            job.kudicallLink,
        );
        job.resolve(result);

        // Human-like gap between messages: 45–90 seconds
        if (sendQueue.length > 0) {
            const gap = randomBetween(45000, 90000);
            log("INFO", `Next message in ${Math.round(gap / 1000)}s...`);
            await sleep(gap);
        }
    }
    processingQueue = false;
}

// ─── ACTUAL SEND ──────────────────────────────────────────────
async function doSendMessages(phone, name, product, jobId, customTemplate = null, kudicallLink = null) {
    try {
        if (!client || !clientReady) {
            return { success: false, error: "WhatsApp client not ready" };
        }

        const chatId = formatPhoneForWhatsApp(phone);
        log("INFO", `[Job:${jobId}] Sending to ${phone} (${chatId})`);

        // ── Build pitch message ──────────────────────────────
        let pitchMsg;
        if (customTemplate) {
            // User-defined template: replace {name} and {product} placeholders
            const displayName    = name    || "there";
            const displayProduct = product || "your products";
            pitchMsg = customTemplate
                .replace(/\{name\}/gi,    displayName)
                .replace(/\{product\}/gi, displayProduct);
        } else {
            // Fall back to the built-in template
            pitchMsg = buildPitchMessage(name, product);
        }

        await client.sendMessage(chatId, pitchMsg);
        log("INFO", `[Job:${jobId}] Pitch sent to ${phone}`);

        // Short delay then send the link
        await sleep(LINK_DELAY_MS);

        // ── Build link message ───────────────────────────────
        // Override KUDICALL_LINK if campaign setting provides one
        const linkMsg = kudicallLink
            ? `🔗 ${kudicallLink}\n\nFeel free to explore and sign up — it's completely free!\nIf you have any questions, just reply here. 😊\n\n— *Team Kudicall*`
            : buildLinkMessage();

        await client.sendMessage(chatId, linkMsg);
        log("INFO", `[Job:${jobId}] Link sent to ${phone}`);

        recordSent();
        return { success: true, phone, sentThisHour };
    } catch (err) {
        log("ERROR", `[Job:${jobId}] Failed for ${phone}: ${err.message}`);
        return { success: false, error: err.message, phone };
    }
}

// ─── PHONE FORMATTER ──────────────────────────────────────────
function formatPhoneForWhatsApp(phone) {
    // Strip all non-digits
    let digits = phone.replace(/\D/g, "");
    // Nigerian number starting with 0 → replace with 234
    if (digits.startsWith("0") && digits.length === 11) {
        digits = "234" + digits.slice(1);
    }
    // Already has country code
    if (!digits.startsWith("234") && digits.length === 10) {
        digits = "234" + digits;
    }
    return `${digits}@c.us`;
}

// ─── WHATSAPP CLIENT ─────────────────────────────────────────
let client = null;
let clientReady = false;

function initWhatsAppClient() {
    log("INFO", "Initialising WhatsApp client...");

    client = new Client({
        authStrategy: new LocalAuth({
            clientId: "clawbot",
            dataPath: path.resolve(__dirname, "../../storage/app/clawbot_session"),
        }),
        puppeteer: {
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        },
    });

    client.on("qr", (qr) => {
        log(
            "INFO",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        );
        log("INFO", "QR CODE — Scan with WhatsApp on 09031761631:");
        log(
            "INFO",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        );
        qrcode.generate(qr, { small: true });
    });

    client.on("authenticated", () => {
        log("INFO", "✅ WhatsApp authenticated! Session saved.");
    });

    client.on("ready", () => {
        clientReady = true;
        log(
            "INFO",
            "✅ WhatsApp client READY. Clawbot is online and accepting jobs.",
        );
    });

    client.on("disconnected", (reason) => {
        clientReady = false;
        log("WARN", `WhatsApp disconnected: ${reason}. Reinitialising...`);
        setTimeout(initWhatsAppClient, 5000);
    });

    client.on("auth_failure", (msg) => {
        log(
            "ERROR",
            `Auth failure: ${msg}. Delete storage/app/clawbot_session and restart.`,
        );
    });

    client.initialize().catch((err) => {
        log("ERROR", "Client init error:", err.message);
    });
}

// ─── EXPRESS API SERVER ───────────────────────────────────────
const app = express();
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
    resetHourIfNeeded();
    res.json({
        status: clientReady ? "ready" : "not_ready",
        sentThisHour,
        rateLimit: RATE_LIMIT,
        queueLength: sendQueue.length,
        remainingThisHour: Math.max(0, RATE_LIMIT - sentThisHour),
    });
});

// Send a WhatsApp pitch to a vendor
// POST /send { phone, name, product, job_id, custom_template?, kudicall_link? }
app.post("/send", async (req, res) => {
    const { phone, name, product, job_id, custom_template, kudicall_link } = req.body;

    if (!phone) {
        return res.status(400).json({ success: false, error: "phone required" });
    }

    if (!clientReady) {
        return res
            .status(503)
            .json({
                success: false,
                error: "WhatsApp not ready. Check QR or session.",
            });
    }

    log("INFO", `[API] Queuing outreach to ${phone} (Job: ${job_id || "manual"})`);

    const result = await enqueueSend(
        phone,
        name,
        product,
        job_id || "manual",
        custom_template || null,
        kudicall_link  || null,
    );
    return res.json(result);
});

// Get current stats
app.get("/stats", (req, res) => {
    resetHourIfNeeded();
    res.json({
        clientReady,
        sentThisHour,
        rateLimit: RATE_LIMIT,
        remainingThisHour: Math.max(0, RATE_LIMIT - sentThisHour),
        queueLength: sendQueue.length,
    });
});

// ─── START ────────────────────────────────────────────────────
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

initWhatsAppClient();

app.listen(BOT_PORT, () => {
    log(
        "INFO",
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );
    log("INFO", `🤖 Clawbot server listening on port ${BOT_PORT}`);
    log(
        "INFO",
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );
});
