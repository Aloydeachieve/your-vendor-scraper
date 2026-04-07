import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Random sleep between min and max ms — more human-like than fixed delays
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomSleep = (min, max) =>
    sleep(Math.floor(Math.random() * (max - min + 1)) + min);

// ————————————————————————————————————————————
// ENV LOADER
// Reads .env file so credentials work locally
// without needing to set $env: in terminal
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
// ACCOUNTS
// Supports multiple Jiji accounts for rotation.
// In your .env, define ONE of these:
//
//   Option A — Single account (original):
//     JIJI_EMAIL=you@gmail.com
//     JIJI_PASSWORD=yourpass
//
//   Option B — Multiple accounts (rotation):
//     JIJI_ACCOUNTS=[{"email":"acc1@gmail.com","password":"pass1"},{"email":"acc2@gmail.com","password":"pass2"}]
//
// Accounts rotate every ROTATE_EVERY products (default: 50)
// ————————————————————————————————————————————
const ROTATE_EVERY = parseInt(process.env.ROTATE_EVERY) || 50;

function loadAccounts() {
    // Priority: JIJI_ACCOUNTS array → single JIJI_EMAIL/PASSWORD
    if (process.env.JIJI_ACCOUNTS) {
        try {
            const accounts = JSON.parse(process.env.JIJI_ACCOUNTS);
            if (Array.isArray(accounts) && accounts.length > 0) {
                console.log(
                    `[ACCOUNTS] Loaded ${accounts.length} account(s) for rotation.`,
                );
                return accounts;
            }
        } catch (e) {
            console.error(
                "[ACCOUNTS] Failed to parse JIJI_ACCOUNTS JSON:",
                e.message,
            );
        }
    }
    // Fallback: single account
    if (process.env.JIJI_EMAIL && process.env.JIJI_PASSWORD) {
        return [
            {
                email: process.env.JIJI_EMAIL,
                password: process.env.JIJI_PASSWORD,
            },
        ];
    }
    return [];
}

// ————————————————————————————————————————————
// COOKIE PERSISTENCE (per account)
// Each account gets its own cookie file:
//   storage/app/jiji_cookies_0.json  (account 0)
//   storage/app/jiji_cookies_1.json  (account 1)
//   ...
// ————————————————————————————————————————————
function cookiePath(accountIndex) {
    return path.resolve(
        __dirname,
        `../storage/app/jiji_cookies_${accountIndex}.json`,
    );
}

function saveCookies(cookies, accountIndex) {
    try {
        const filePath = cookiePath(accountIndex);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2));
        console.log(
            `[COOKIES][acc${accountIndex}] Saved ${cookies.length} cookies.`,
        );
    } catch (e) {
        console.error(`[COOKIES][acc${accountIndex}] Save failed:`, e.message);
    }
}

async function loadAndApplyCookies(page, accountIndex) {
    try {
        const filePath = cookiePath(accountIndex);
        if (!fs.existsSync(filePath)) return false;
        const cookies = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        await page.setCookie(...cookies);
        console.log(
            `[COOKIES][acc${accountIndex}] Loaded ${cookies.length} cookies.`,
        );
        return true;
    } catch (e) {
        console.error(`[COOKIES][acc${accountIndex}] Load failed:`, e.message);
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
// LOGIN (for one account)
// ————————————————————————————————————————————
async function loginToJiji(page, account, accountIndex) {
    const { email, password } = account;
    if (!email || !password) {
        console.log(`[LOGIN][acc${accountIndex}] No credentials, skipping.`);
        return false;
    }

    try {
        console.log(`[LOGIN][acc${accountIndex}] Navigating to jiji.ng...`);
        await page
            .goto("https://jiji.ng", {
                waitUntil: "domcontentloaded",
                timeout: 45000,
            })
            .catch(() => {});
        await sleep(2500);

        // Click "Sign in" — href is "/?auth=Login"
        let signInClicked = false;
        try {
            await page.click('a[href="/?auth=Login"]');
            signInClicked = true;
            console.log(`[LOGIN][acc${accountIndex}] Clicked Sign in.`);
        } catch (e) {
            const links = await page.$$("a");
            for (const el of links) {
                const text = await el.evaluate((n) =>
                    n.textContent.trim().toLowerCase(),
                );
                if (text === "sign in") {
                    await el.click();
                    signInClicked = true;
                    console.log(
                        `[LOGIN][acc${accountIndex}] Clicked Sign in (by text).`,
                    );
                    break;
                }
            }
        }

        if (!signInClicked) {
            console.log(`[LOGIN][acc${accountIndex}] Sign in link not found.`);
            return false;
        }

        // Wait for Vue modal to render the E-mail button
        await sleep(3500);
        await page
            .waitForFunction(
                () =>
                    Array.from(document.querySelectorAll("button")).some((b) =>
                        b.textContent.toLowerCase().includes("e-mail"),
                    ),
                { timeout: 5000 },
            )
            .catch(() => {});

        // Click "E-mail or phone" button (correct one by text, not first selector)
        let emailBtnClicked = false;
        const allButtons = await page.$$("button");
        for (const btn of allButtons) {
            const text = await btn.evaluate((n) =>
                n.textContent.toLowerCase().trim(),
            );
            if (text.includes("e-mail") || text.includes("email or phone")) {
                await btn.click();
                emailBtnClicked = true;
                console.log(
                    `[LOGIN][acc${accountIndex}] Clicked E-mail button.`,
                );
                break;
            }
        }

        if (!emailBtnClicked) {
            console.log(`[LOGIN][acc${accountIndex}] E-mail button not found.`);
            return false;
        }

        // Wait for login form
        console.log(`[LOGIN][acc${accountIndex}] Waiting for form...`);
        const pwInput = await page
            .waitForSelector('input[type="password"]', { timeout: 12000 })
            .catch(() => null);

        if (!pwInput) {
            console.log(`[LOGIN][acc${accountIndex}] Form didn't appear.`);
            return false;
        }
        console.log(`[LOGIN][acc${accountIndex}] Form appeared. Filling...`);

        // Fill email (skip placeholder=search bar)
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
            await emailInput.type(email.trim(), { delay: 60 });
        }

        await pwInput.click({ clickCount: 3 });
        await pwInput.type(password.trim(), { delay: 60 });

        // Click SIGN IN
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
                console.log(`[LOGIN][acc${accountIndex}] Clicked SIGN IN.`);
                break;
            }
        }

        await sleep(4000);

        const loggedIn = await page.evaluate(
            () => !document.querySelector('a[href="/?auth=Login"]'),
        );

        if (loggedIn) {
            console.log(`[LOGIN][acc${accountIndex}] Logged in successfully!`);
            const cookies = await page.cookies();
            saveCookies(cookies, accountIndex);
        } else {
            console.log(
                `[LOGIN][acc${accountIndex}] Login failed (wrong credentials?).`,
            );
        }
        return loggedIn;
    } catch (err) {
        console.error(`[LOGIN][acc${accountIndex}] Error:`, err.message);
        return false;
    }
}

// ————————————————————————————————————————————
// SESSION SETUP FOR ONE ACCOUNT
// Try cookies first → if expired → full login
// Returns a ready-to-use browser instance
// ————————————————————————————————————————————
async function setupAccountSession(account, accountIndex) {
    const hasCookies = fs.existsSync(cookiePath(accountIndex));

    const browser = await puppeteer.launch({
        headless: false, // required for Show Contact API + login
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--window-size=1280,800",
        ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    );

    if (hasCookies) {
        console.log(`[SESSION][acc${accountIndex}] Loading saved cookies...`);
        await loadAndApplyCookies(page, accountIndex);
        const valid = await isLoggedIn(page);
        if (valid) {
            console.log(
                `[SESSION][acc${accountIndex}] Cookies valid — login skipped!`,
            );
            return { browser, page };
        }
        console.log(
            `[SESSION][acc${accountIndex}] Cookies expired, doing fresh login...`,
        );
    }

    await loginToJiji(page, account, accountIndex);
    return { browser, page };
}

// ————————————————————————————————————————————
// EXTRACT CONTACT FROM ONE PRODUCT PAGE
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
        await randomSleep(1500, 3000); // human-like delay on page load

        let phones = [];

        // Check if phone already visible
        const directPhone = await productPage.evaluate(() => {
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

        if (directPhone) {
            phones.push(directPhone);
        } else {
            // Click Show Contact button
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
                    .catch(() => {});
            }

            phones = await productPage.evaluate(() => {
                const nums = [];
                document
                    .querySelectorAll('a.qa-show-contact[href^="tel:"]')
                    .forEach((a) => {
                        const n = a
                            .getAttribute("href")
                            .replace("tel:", "")
                            .trim();
                        if (n && !nums.includes(n)) nums.push(n);
                    });
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

        const data = await productPage.evaluate(() => {
            const titleEl =
                document.querySelector(".b-advert-title-inner") ||
                document.querySelector('[class*="advert-title"]') ||
                document.querySelector("h1");
            const priceEl =
                document.querySelector(".qa-advert-price") ||
                document.querySelector(".qa-advert-price-view-value") ||
                document.querySelector('[itemprop="price"]');
            const sellerEl =
                document.querySelector(".b-seller-block__name") ||
                document.querySelector(".b-seller-info__name");
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

    const limit = Math.min(parseInt(maxArg) || 5, 1000);
    const accounts = loadAccounts();

    if (accounts.length === 0) {
        console.error(
            "[ACCOUNTS] No accounts found. Set JIJI_EMAIL+JIJI_PASSWORD or JIJI_ACCOUNTS in .env",
        );
        process.exit(1);
    }

    console.log(
        `[MAIN] Scraping up to ${limit} products. Rotating every ${ROTATE_EVERY} products across ${accounts.length} account(s).`,
    );

    const vendors = [];
    let currentAccountIndex = 0;
    let currentBrowser = null;
    let currentPage = null;

    // Setup first account session
    const firstSession = await setupAccountSession(
        accounts[currentAccountIndex],
        currentAccountIndex,
    );
    currentBrowser = firstSession.browser;
    currentPage = firstSession.page;

    try {
        console.log("[NAV] Going to:", searchUrl);
        await currentPage
            .goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 })
            .catch(() => console.error("[NAV] Navigation failed:", searchUrl));
        await sleep(2500);

        // Detect single product vs category listing
        const isProductPage = await currentPage.evaluate(() => {
            return (
                !!document.querySelector("a.qa-show-contact") ||
                !!document.querySelector(".b-show-contact") ||
                !!document.querySelector(".b-seller-info") ||
                !!document.querySelector('a[href^="tel:"]')
            );
        });

        if (isProductPage) {
            console.log("[NAV] Single product page detected.");
            const data = await extractJijiDetail(searchUrl, currentBrowser);
            vendors.push(data);
        } else {
            console.log("[NAV] Category page. Collecting product links...");

            const productLinks = await currentPage.evaluate(() => {
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
            console.log(`[NAV] Found ${uniqueLinks.length} product links.`);

            for (let i = 0; i < uniqueLinks.length; i++) {
                // ——— ACCOUNT ROTATION ———
                // Switch account every ROTATE_EVERY products (but not on very first one)
                if (i > 0 && i % ROTATE_EVERY === 0 && accounts.length > 1) {
                    const nextIndex =
                        (currentAccountIndex + 1) % accounts.length;
                    console.log(
                        `\n[ROTATE] ${ROTATE_EVERY} products done with acc${currentAccountIndex}. Switching to acc${nextIndex}...`,
                    );
                    await currentBrowser.close();
                    const nextSession = await setupAccountSession(
                        accounts[nextIndex],
                        nextIndex,
                    );
                    currentBrowser = nextSession.browser;
                    currentPage = nextSession.page;
                    currentAccountIndex = nextIndex;
                    console.log(
                        `[ROTATE] Now using acc${currentAccountIndex}.\n`,
                    );
                }

                const data = await extractJijiDetail(
                    uniqueLinks[i],
                    currentBrowser,
                );
                vendors.push(data);

                // ——— RANDOM DELAY (human behavior) ———
                // Between 1.5s and 4s — varies like a human browsing
                await randomSleep(1500, 4000);
            }
        }
    } catch (err) {
        console.error("[NAV] Error:", err.message);
    }

    await currentBrowser.close();
    fs.writeFileSync("vendors.json", JSON.stringify(vendors, null, 2));
    process.stdout.write(JSON.stringify(vendors));
})();
