import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ————————————————————————————————————————————
// Auto-load .env so credentials work locally
// without needing to set $env: in the terminal
// ————————————————————————————————————————————
function loadEnv() {
    const envPath = path.resolve(__dirname, "../.env");
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key && !process.env[key]) process.env[key] = val;
    }
}
loadEnv();

// ————————————————————————————————————————————
// COOKIE PERSISTENCE
// Cookies are saved to storage/app/jiji_cookies.json
// After login: cookies are saved automatically
// On next run: cookies are loaded, login is skipped
// This lets Railway run headless: true (no display needed)
// ————————————————————————————————————————————
const COOKIES_PATH = path.resolve(
    __dirname,
    "../storage/app/jiji_cookies.json",
);

function saveCookies(cookies) {
    try {
        const dir = path.dirname(COOKIES_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
        console.log(
            `[COOKIES] Saved ${cookies.length} cookies to jiji_cookies.json`,
        );
    } catch (e) {
        console.error("[COOKIES] Failed to save cookies:", e.message);
    }
}

async function loadAndApplyCookies(page) {
    try {
        // Also support JIJI_COOKIES env var (base64 JSON) for Railway
        const cookieSource = process.env.JIJI_COOKIES
            ? Buffer.from(process.env.JIJI_COOKIES, "base64").toString("utf-8")
            : fs.existsSync(COOKIES_PATH)
              ? fs.readFileSync(COOKIES_PATH, "utf-8")
              : null;

        if (!cookieSource) return false;

        const cookies = JSON.parse(cookieSource);
        await page.setCookie(...cookies);
        console.log(`[COOKIES] Loaded ${cookies.length} saved cookies`);
        return true;
    } catch (e) {
        console.error("[COOKIES] Failed to load cookies:", e.message);
        return false;
    }
}

async function isLoggedIn(page) {
    try {
        await page.goto("https://jiji.ng", {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });
        await sleep(2000);
        return await page.evaluate(
            () => !document.querySelector('a[href="/?auth=Login"]'),
        );
    } catch (e) {
        return false;
    }
}

// ————————————————————————————————————————————
// LOGIN
// Debug showed:
//   - Sign in href is "/?auth=Login" (not /auth-login)
//   - There are 4 buttons with class qa-fw-button:
//     "Sell", "All Nigeria", (search), "E-mail or phone"
//   - Must use Puppeteer handle.click() (NOT evaluate el.click())
//     to properly trigger Vue.js event handlers
// ————————————————————————————————————————————
async function loginToJiji(page) {
    if (!process.env.JIJI_EMAIL || !process.env.JIJI_PASSWORD) {
        console.log("[LOGIN] No credentials in env, skipping login.");
        return false;
    }

    try {
        console.log("[LOGIN] Navigating to jiji.ng...");
        await page
            .goto("https://jiji.ng", {
                waitUntil: "domcontentloaded",
                timeout: 45000,
            })
            .catch(() => {});
        await sleep(2500);

        // Step 1: Click "Sign in" link — href is "/?auth=Login"
        let signInClicked = false;
        try {
            await page.click('a[href="/?auth=Login"]');
            signInClicked = true;
            console.log("[LOGIN] Clicked a[href='/?auth=Login']");
        } catch (e) {
            // Fallback: find by text using element handles (native Puppeteer click)
            const links = await page.$$("a");
            for (const el of links) {
                const text = await el.evaluate((n) =>
                    n.textContent.trim().toLowerCase(),
                );
                if (text === "sign in") {
                    await el.click();
                    signInClicked = true;
                    console.log("[LOGIN] Clicked Sign in (by text)");
                    break;
                }
            }
        }

        if (!signInClicked) {
            console.log("[LOGIN] Could not find Sign in link.");
            return false;
        }

        // Give Vue.js animation time to fully render the modal
        // (fixed sleep is more reliable than waitForFunction for CSS transitions)
        await sleep(3500);

        // Then wait an additional 5s for the E-mail button to be in DOM
        await page
            .waitForFunction(
                () =>
                    Array.from(document.querySelectorAll("button")).some((b) =>
                        b.textContent.toLowerCase().includes("e-mail"),
                    ),
                { timeout: 5000 },
            )
            .catch(() => {}); // if still not there after 5s, try anyway

        // Step 2: Click the "E-mail or phone" button in the modal
        // There are multiple buttons.qa-fw-button — must select by text, not by selector
        // Use Puppeteer's native element handle click (NOT evaluate() click)
        let emailBtnClicked = false;
        const allButtons = await page.$$("button");
        for (const btn of allButtons) {
            const text = await btn.evaluate((n) =>
                n.textContent.toLowerCase().trim(),
            );
            if (text.includes("e-mail") || text.includes("email or phone")) {
                await btn.click(); // Native Puppeteer click triggers Vue.js event handlers
                emailBtnClicked = true;
                console.log(
                    "[LOGIN] Clicked E-mail or phone button (native handle click)",
                );
                break;
            }
        }

        if (!emailBtnClicked) {
            console.log("[LOGIN] E-mail or phone button not found in modal.");
            return false;
        }

        // Step 3: Wait up to 12 seconds for the form (email + password inputs) to appear
        console.log("[LOGIN] Waiting for email/password form...");
        const pwInput = await page
            .waitForSelector('input[type="password"]', { timeout: 12000 })
            .catch(() => null);

        if (!pwInput) {
            console.log("[LOGIN] Password input never appeared after 12s.");
            return false;
        }
        console.log("[LOGIN] Login form appeared. Filling credentials...");

        // Fill email/phone field — exclude the search bar by placeholder
        const allInputs = await page.$$("input");
        let emailInput = null;
        for (const inp of allInputs) {
            const attrs = await inp.evaluate((n) => ({
                type: n.type,
                placeholder: n.placeholder.toLowerCase(),
            }));
            if (
                (attrs.type === "email" ||
                    attrs.type === "tel" ||
                    attrs.type === "text") &&
                !attrs.placeholder.includes("looking")
            ) {
                emailInput = inp;
                break;
            }
        }

        if (emailInput) {
            await emailInput.click({ clickCount: 3 });
            await emailInput.type(process.env.JIJI_EMAIL.trim(), { delay: 60 });
        }

        // Fill password
        await pwInput.click({ clickCount: 3 });
        await pwInput.type(process.env.JIJI_PASSWORD.trim(), { delay: 60 });

        // Step 4: Click SIGN IN — class qa-login-submit or type=submit
        const formButtons = await page.$$("button");
        for (const btn of formButtons) {
            const cls = await btn.evaluate((n) => n.className);
            const type = await btn.evaluate((n) => n.type);
            const text = await btn.evaluate((n) =>
                n.textContent.trim().toUpperCase(),
            );
            if (
                cls.includes("qa-login-submit") ||
                type === "submit" ||
                text === "SIGN IN"
            ) {
                await btn.click();
                console.log("[LOGIN] Clicked SIGN IN submit button");
                break;
            }
        }

        await sleep(4000);

        // Check logged in: Sign in link presence
        const loggedIn = await page.evaluate(() => {
            return (
                !document.querySelector('a[href="/?auth=Login"]') &&
                !!document.querySelector(
                    '[class*="header-user"], [class*="avatar"], [class*="profile"]',
                )
            );
        });

        if (loggedIn) {
            console.log("[LOGIN] Logged in successfully!");
            // Save cookies so future runs skip this entire login flow
            const cookies = await page.cookies();
            saveCookies(cookies);
        } else {
            console.log("[LOGIN] Login uncertain, continuing...");
        }
        return loggedIn;
    } catch (err) {
        console.error("[LOGIN] Error:", err.message);
        return false;
    }
}

// ————————————————————————————————————————————
// EXTRACT CONTACT FROM ONE PRODUCT PAGE
//
// How Jiji works (confirmed via debug):
//   - Product page has a.b-show-contact button
//   - Clicking it (when logged in) makes Jiji's Vue
//     call their API and update DOM with phone in:
//     a.qa-show-contact[href^="tel:"] or popover
//   - Without login: click fires but nothing happens
// ————————————————————————————————————————————
async function extractJijiDetail(detailUrl, browser) {
    const productPage = await browser.newPage();
    try {
        await productPage.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        );

        console.log("[SCRAPE] Visiting:", detailUrl);
        await productPage.goto(detailUrl, {
            waitUntil: "domcontentloaded",
            timeout: 45000,
        });
        await sleep(2000);

        // ——— STEP 1: Check if phone already visible (logged-in sellers show it directly)
        let phones = [];
        let initialCheck = await productPage.evaluate(() => {
            const el = document.querySelector(
                'a.qa-show-contact[href^="tel:"]',
            );
            if (el) return el.getAttribute("href").replace("tel:", "").trim();
            const span = document.querySelector("span.qa-show-contact-phone");
            if (span) {
                const t = span.textContent.trim().replace(/\s/g, "");
                if (/^0\d{8,10}$/.test(t)) return t;
            }
            return null;
        });

        if (initialCheck) {
            phones.push(initialCheck);
            console.log(`[SCRAPE] Phone already visible: ${initialCheck}`);
        } else {
            // ——— STEP 2: Click the "Show contact" button with Puppeteer's native click
            // This uses page.click() which triggers Vue's @click event handler
            // which then calls the Jiji API to reveal the number
            let clicked = false;
            try {
                await productPage.click(".b-show-contact");
                clicked = true;
            } catch (e) {
                try {
                    await productPage.click(".qa-show-contact");
                    clicked = true;
                } catch (e2) {}
            }

            if (clicked) {
                // Wait for the phone number to appear in the DOM (up to 5s)
                await productPage
                    .waitForFunction(
                        () =>
                            document.querySelector(
                                'a.qa-show-contact[href^="tel:"]',
                            ) ||
                            document.querySelector(
                                ".b-show-contacts-popover",
                            ) ||
                            document.querySelectorAll('a[href^="tel:"]')
                                .length > 0,
                        { timeout: 5000 },
                    )
                    .catch(() => {}); // timeout is OK — just means not logged in
            }

            // ——— STEP 3: Extract from updated DOM
            phones = await productPage.evaluate(() => {
                const nums = [];

                // Check updated show contact button href
                document
                    .querySelectorAll('a.qa-show-contact[href^="tel:"]')
                    .forEach((a) => {
                        const n = a
                            .getAttribute("href")
                            .replace("tel:", "")
                            .trim();
                        if (n && !nums.includes(n)) nums.push(n);
                    });

                // Check contacts popover
                const popover = document.querySelector(
                    ".b-show-contacts-popover",
                );
                if (popover) {
                    popover.querySelectorAll('a[href^="tel:"]').forEach((a) => {
                        const n = a
                            .getAttribute("href")
                            .replace("tel:", "")
                            .trim();
                        if (n && !nums.includes(n)) nums.push(n);
                    });
                    popover
                        .querySelectorAll("span.qa-show-contact-phone")
                        .forEach((s) => {
                            const t = s.textContent.trim().replace(/\s/g, "");
                            if (/^0\d{8,10}$/.test(t) && !nums.includes(t))
                                nums.push(t);
                        });
                }

                // Fallback: any tel: link on the page
                if (!nums.length) {
                    document
                        .querySelectorAll('a[href^="tel:"]')
                        .forEach((a) => {
                            const n = a
                                .getAttribute("href")
                                .replace("tel:", "")
                                .trim();
                            if (n && !nums.includes(n)) nums.push(n);
                        });
                }

                return nums;
            });
        }

        // ——— EXTRACT TITLE, PRICE, SELLER, WHATSAPP ———
        const data = await productPage.evaluate(() => {
            const titleEl =
                document.querySelector(".b-advert-title-inner") ||
                document.querySelector('[class*="advert-title"]') ||
                document.querySelector("main h1") ||
                document.querySelector("h1");

            const priceEl =
                document.querySelector(".qa-advert-price") ||
                document.querySelector(".qa-advert-price-view-value") ||
                document.querySelector('[itemprop="price"]');

            const sellerEl =
                document.querySelector(".b-seller-block__name") ||
                document.querySelector(".b-seller-info__name") ||
                document.querySelector('[class*="seller"] [class*="name"]');

            const waEl = document.querySelector('a[href*="wa.me/"]');

            return {
                title: titleEl?.textContent?.trim() || document.title || "N/A",
                price: priceEl?.textContent?.trim() || "N/A",
                seller_name: sellerEl?.textContent?.trim() || null,
                whatsapp: waEl
                    ? (waEl.getAttribute("href") || "").match(
                          /wa\.me\/(\d+)/,
                      )?.[1]
                    : null,
            };
        });

        console.log(
            `[SCRAPE] "${data.title}" | phones: [${phones.join(", ")}] | wa: ${data.whatsapp}`,
        );

        return {
            ...data,
            phone: phones[0] || null,
            all_phones: phones,
            profile_url: detailUrl,
            email: null,
        };
    } catch (err) {
        console.error("[SCRAPE] Failed for", detailUrl, ":", err.message);
        return {
            title: "Error",
            price: null,
            phone: null,
            all_phones: [],
            whatsapp: null,
            seller_name: null,
            profile_url: detailUrl,
            email: null,
        };
    } finally {
        await productPage.close();
    }
}

// ————————————————————————————————————————————
// MAIN
// ————————————————————————————————————————————
(async () => {
    const [, , searchUrl, maxArg] = process.argv;
    if (!searchUrl) {
        console.error("Usage: node scraper.js <searchUrl> [limit]");
        process.exit(1);
    }

    const limit = Math.min(parseInt(maxArg) || 5, 100);

    // headless: false is required — Jiji's Show Contact API call only works
    // in a non-headless Chromium (the stealth fingerprint matters).
    // On Railway: set DISPLAY env var or wrap with xvfb-run (see Dockerfile).
    const hasSavedCookies =
        !!process.env.JIJI_COOKIES || fs.existsSync(COOKIES_PATH);

    const browser = await puppeteer.launch({
        headless: false,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--window-size=1280,800",
        ],
    });

    const mainPage = await browser.newPage();
    await mainPage.setViewport({ width: 1280, height: 800 });
    await mainPage.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    );

    // ——— SESSION SETUP: try saved cookies first, fallback to full login ———
    if (hasSavedCookies) {
        console.log("[COOKIES] Found saved session, loading cookies...");
        await loadAndApplyCookies(mainPage);
        const stillLoggedIn = await isLoggedIn(mainPage);
        if (stillLoggedIn) {
            console.log("[COOKIES] Session still valid — skipping login!");
        } else {
            console.log(
                "[COOKIES] Session expired. Closing to re-login with headless: false...",
            );
            await browser.close();

            // Re-launch in non-headless mode to do the full login flow
            const loginBrowser = await puppeteer.launch({
                headless: false,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--window-size=1280,800",
                ],
            });
            const loginPage = await loginBrowser.newPage();
            await loginPage.setViewport({ width: 1280, height: 800 });
            await loginPage.setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            );
            await loginToJiji(loginPage); // saves fresh cookies
            await loginBrowser.close();

            // Re-launch headless with fresh cookies
            const freshBrowser = await puppeteer.launch({
                headless: true,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--window-size=1280,800",
                ],
            });
            // Re-run main logic with fresh browser (simplified — just restart process)
            console.log(
                "[COOKIES] Fresh cookies saved. Please re-run the scraper.",
            );
            await freshBrowser.close();
            process.exit(0);
        }
    } else {
        // No cookies at all — do a full login (browser already launched headless: false)
        await loginToJiji(mainPage); // saves cookies on success
    }

    const vendors = [];

    try {
        console.log("[NAV] Going to:", searchUrl);
        await mainPage
            .goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 })
            .catch(() =>
                console.error("[NAV] Navigation failed for:", searchUrl),
            );
        await sleep(2500);

        // Detect page type
        const isProductPage = await mainPage.evaluate(() => {
            return (
                !!document.querySelector("a.qa-show-contact") ||
                !!document.querySelector(".b-show-contact") ||
                !!document.querySelector(".b-seller-info") ||
                !!document.querySelector('a[href^="tel:"]')
            );
        });

        if (isProductPage) {
            console.log("[NAV] Single product page detected.");
            const data = await extractJijiDetail(searchUrl, browser);
            vendors.push(data);
        } else {
            console.log(
                "[NAV] Category page detected. Collecting product links...",
            );

            const productLinks = await mainPage.evaluate(() => {
                const seen = new Set();
                const links = [];
                document.querySelectorAll("a[href]").forEach((a) => {
                    const href = a.href;
                    if (
                        href &&
                        href.includes("jiji.ng") &&
                        href.includes(".html") &&
                        !href.includes("/login") &&
                        !href.includes("/static/") &&
                        !href.includes("/blog/") &&
                        !href.includes("/auth") &&
                        !seen.has(href)
                    ) {
                        seen.add(href);
                        links.push(href);
                    }
                });
                return links;
            });

            const uniqueLinks = productLinks.slice(0, limit);
            console.log(
                `[NAV] Found ${uniqueLinks.length} product links to scrape.`,
            );

            for (const productUrl of uniqueLinks) {
                const data = await extractJijiDetail(productUrl, browser);
                vendors.push(data);
                await sleep(800);
            }
        }
    } catch (err) {
        console.error("[NAV] Error:", err.message);
    }

    await browser.close();
    fs.writeFileSync("vendors.json", JSON.stringify(vendors, null, 2));
    process.stdout.write(JSON.stringify(vendors));
})();
