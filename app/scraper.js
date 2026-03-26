import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";

puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loginToJiji(page) {
    try {
        console.log("[LOGIN] Navigating to jiji.ng...");
        await page
            .goto("https://jiji.ng", {
                waitUntil: "domcontentloaded",
                timeout: 45000,
            })
            .catch(() => {});

        await sleep(2000);

        // Step 1: Click the top-right "Sign in" link to open the first modal
        const signInClicked = await page.evaluate(() => {
            const links = Array.from(
                document.querySelectorAll("a, button, span"),
            );
            const signIn = links.find(
                (el) =>
                    el.textContent.trim().toLowerCase() === "sign in" ||
                    el.textContent.trim().toLowerCase() === "login",
            );
            if (signIn) {
                signIn.click();
                return true;
            }
            return false;
        });

        if (!signInClicked) {
            console.log(
                "[LOGIN] Could not find Sign in button, skipping login.",
            );
            return;
        }

        await sleep(2000);

        // Step 2: On the first modal, click "E-mail or phone" to go to second modal
        const emailBtnClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button, a"));
            const emailBtn = btns.find(
                (el) =>
                    el.textContent.toLowerCase().includes("e-mail") ||
                    el.textContent.toLowerCase().includes("email or phone"),
            );
            if (emailBtn) {
                emailBtn.click();
                return true;
            }
            return false;
        });

        if (!emailBtnClicked) {
            console.log("[LOGIN] Could not find E-mail or phone button.");
            return;
        }

        await sleep(2000);

        if (!process.env.JIJI_EMAIL || !process.env.JIJI_PASSWORD) {
            console.log("[LOGIN] No credentials set in environment, skipping.");
            return;
        }

        // Step 3: Type email and password using puppeteer's page.type (more reliable)
        const emailInput = await page.$(
            'input[type="email"], input[type="text"], input[type="tel"]',
        );
        if (!emailInput) {
            console.log("[LOGIN] Could not find email input field.");
            return;
        }

        await emailInput.click({ clickCount: 3 });
        await emailInput.type(process.env.JIJI_EMAIL, { delay: 80 });

        const passwordInput = await page.$('input[type="password"]');
        if (!passwordInput) {
            console.log("[LOGIN] Could not find password input field.");
            return;
        }

        await passwordInput.click({ clickCount: 3 });
        await passwordInput.type(process.env.JIJI_PASSWORD, { delay: 80 });

        // Step 4: Click the green SIGN IN button
        const signInSubmitClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button"));
            const btn = btns.find(
                (b) =>
                    b.textContent.trim().toUpperCase() === "SIGN IN" ||
                    b.type === "submit",
            );
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });

        await sleep(3000);

        // Check if we are now logged in (avatar or user icon should be present)
        const loggedIn = await page.evaluate(() => {
            return (
                !!document.querySelector('[data-testid="user-avatar"]') ||
                !!document.querySelector(".header-user-area") ||
                !document.querySelector('a[href*="login"]')
            );
        });

        if (loggedIn) {
            console.log("[LOGIN] Successfully logged in!");
        } else {
            console.log("[LOGIN] Login may have failed, but continuing...");
        }
    } catch (err) {
        console.error("[LOGIN] Error during login:", err.message);
    }
}

async function extractJijiDetail(detailUrl, browser) {
    const productPage = await browser.newPage();
    try {
        console.log("[SCRAPE] Visiting product:", detailUrl);
        await productPage.goto(detailUrl, {
            waitUntil: "domcontentloaded",
            timeout: 45000,
        });
        await sleep(2500);

        // Try to click any "Show contact" / "Show phone" button by text content
        await productPage.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button, a"));
            const showBtn = btns.find(
                (b) =>
                    b.textContent.toLowerCase().includes("show contact") ||
                    b.textContent.toLowerCase().includes("show phone") ||
                    b.textContent.toLowerCase().includes("show number") ||
                    b.classList.contains("qa-show-contact"),
            );
            if (showBtn) {
                showBtn.click();
                return true;
            }
            return false;
        });

        await sleep(2000);

        // Extract all contact info
        const data = await productPage.evaluate(() => {
            const phoneEl = document.querySelector('a[href^="tel:"]');
            const whatsappEl = document.querySelector('a[href*="wa.me/"]');
            const titleEl =
                document.querySelector(".b-advert-title-inner") ||
                document.querySelector('[class*="advert-title"]') ||
                document.querySelector("main h1") ||
                document.querySelector("article h1") ||
                document.querySelector("h1");
            const priceEl = document.querySelector(
                ".qa-advert-price, .b-advert-price, [class*='price'] span",
            );
            const sellerEl = document.querySelector(
                ".b-seller-info__name, [class*='seller-name'], [class*='user-name']",
            );

            return {
                title: titleEl?.textContent?.trim() || document.title || "N/A",
                price: priceEl?.textContent?.trim() || "N/A",
                phone: phoneEl
                    ? phoneEl.getAttribute("href").replace("tel:", "").trim()
                    : null,
                whatsapp: whatsappEl
                    ? whatsappEl
                          .getAttribute("href")
                          .match(/wa\.me\/(\d+)/)?.[1]
                    : null,
                seller_name: sellerEl?.textContent?.trim() || null,
            };
        });

        console.log(
            `[SCRAPE] Got data for: ${data.title} | phone: ${data.phone} | wa: ${data.whatsapp}`,
        );
        return { ...data, profile_url: detailUrl, email: null };
    } catch (err) {
        console.error("[SCRAPE] Failed for", detailUrl, ":", err.message);
        return {
            title: "Error",
            price: null,
            phone: null,
            whatsapp: null,
            seller_name: null,
            profile_url: detailUrl,
            email: null,
        };
    } finally {
        await productPage.close();
    }
}

(async () => {
    const [, , searchUrl, maxPagesArg] = process.argv;
    if (!searchUrl) {
        console.error("Usage: node scraper.js <searchUrl> [maxPages]");
        process.exit(1);
    }

    const limit = parseInt(maxPagesArg) || 5;

    const browser = await puppeteer.launch({
        headless: "new",
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

    // ——— LOGIN ———
    await loginToJiji(page);

    const vendors = [];

    try {
        console.log("[NAV] Navigating to target URL:", searchUrl);
        await page
            .goto(searchUrl, {
                waitUntil: "domcontentloaded",
                timeout: 45000,
            })
            .catch(() =>
                console.error("[NAV] Failed to navigate to:", searchUrl),
            );
        await sleep(2500);

        // Check if this is a product detail page or a category listing page
        const isProductPage = await page.evaluate(() => {
            // Product pages have a seller info section or a contact section
            return (
                !!document.querySelector(".b-seller-info") ||
                !!document.querySelector(".qa-show-contact") ||
                !!document.querySelector('a[href^="tel:"]') ||
                !!document.querySelector('a[href*="wa.me/"]')
            );
        });

        if (isProductPage) {
            console.log("[NAV] Detected single product page.");
            const data = await extractJijiDetail(searchUrl, browser);
            vendors.push(data);
        } else {
            console.log(
                "[NAV] Detected category page. Collecting product links...",
            );

            // Get all product listing links from the category page
            const productLinks = await page.evaluate(() => {
                const seen = new Set();
                const links = [];
                // Jiji product links are anchor tags inside listing item wrappers
                document.querySelectorAll("a[href]").forEach((a) => {
                    const href = a.href;
                    if (
                        href &&
                        href.includes("jiji.ng") &&
                        href.includes(".html") &&
                        !href.includes("/static/") &&
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
                await sleep(1000); // polite delay between requests
            }
        }
    } catch (err) {
        console.error("[NAV] Top-level scraping error:", err.message);
    }

    await browser.close();
    fs.writeFileSync("vendors.json", JSON.stringify(vendors, null, 2));
    process.stdout.write(JSON.stringify(vendors));
})();
