import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";

puppeteer.use(StealthPlugin());

(async () => {
    const [, , searchUrl, maxPages] = process.argv;

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
        ],
    });

    const page = await browser.newPage();

    // ——— LOGIN ———
    try {
        await page.goto("https://jiji.ng/login", {
            waitUntil: "domcontentloaded",
        });
        await page.waitForTimeout(2000);

        if (process.env.JIJI_EMAIL && process.env.JIJI_PASSWORD) {
            await page.type(
                'input[name="email"], input[type="email"]',
                process.env.JIJI_EMAIL,
            );
            await page.type(
                'input[name="password"], input[type="password"]',
                process.env.JIJI_PASSWORD,
            );

            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: "networkidle2" }),
            ]).catch(() =>
                console.log(
                    "Navigation timeout on login, continuing anyway...",
                ),
            );
            console.log("Login sequence completed.");
        }
    } catch (loginErr) {
        console.error("Login sequence failed (ignoring):", loginErr.message);
    }

    const vendors = [];

    async function extractJijiDetail(detailUrl, pageInstance) {
        try {
            const showBtn = await pageInstance.$(
                'button.qa-show-contact, .b-seller-info__action-button, button:has-text("Show contact")',
            );
            if (showBtn) {
                await showBtn.click();
                await pageInstance.waitForTimeout(2000);
            }
        } catch (e) {}

        const data = await pageInstance.evaluate(() => {
            const phoneEl = document.querySelector('a[href^="tel:"]');
            const watsappEl = document.querySelector('a[href*="wa.me/"]');
            return {
                title:
                    document
                        .querySelector("h1, .b-advert-title-inner")
                        ?.textContent?.trim() || "N/A",
                price:
                    document
                        .querySelector(
                            '.qa-advert-price, .amount, span[itemprop="price"]',
                        )
                        ?.textContent?.trim() || "N/A",
                phone: phoneEl
                    ? phoneEl.getAttribute("href").replace("tel:", "")
                    : null,
                whatsapp: watsappEl
                    ? watsappEl.getAttribute("href").match(/wa\.me\/(\d+)/)?.[1]
                    : null,
            };
        });

        return { ...data, profile_url: detailUrl, email: null };
    }

    try {
        // If the URL provided is already a product detail page
        if (searchUrl.includes(".html") && !searchUrl.includes("?page=")) {
            await page.goto(searchUrl, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
            });
            await page.waitForTimeout(2000);
            const data = await extractJijiDetail(searchUrl, page);
            vendors.push(data);
        } else {
            // It is a category listing page
            await page.goto(searchUrl, {
                waitUntil: "networkidle2",
                timeout: 60000,
            });
            await page.waitForTimeout(2000);

            const productLinks = await page.$$eval(
                '.b-list-advert__item-wrapper, .b-list-advert__item, .b-list-advert-base, .b-adapter__item, a[href*=".html"]',
                (els) =>
                    els
                        .map((el) => {
                            let link =
                                el.tagName === "A" ? el : el.querySelector("a");
                            return link ? link.href : null;
                        })
                        .filter(
                            (href) =>
                                href &&
                                (href.includes(".html") ||
                                    href.includes("/user/") ||
                                    href.includes("/shop/")),
                        ),
            );

            const uniqueLinks = [...new Set(productLinks)].slice(0, 5);

            for (const productUrl of uniqueLinks) {
                const productPage = await browser.newPage();
                try {
                    await productPage.goto(productUrl, {
                        waitUntil: "domcontentloaded",
                        timeout: 45000,
                    });
                    const data = await extractJijiDetail(
                        productUrl,
                        productPage,
                    );
                    vendors.push(data);
                } catch (e) {
                    console.error("Detail scrape error:", e.message);
                } finally {
                    await productPage.close();
                }
            }
        }
    } catch (err) {
        console.error("Scraping error:", err.message);
    }

    await browser.close();
    fs.writeFileSync("vendors.json", JSON.stringify(vendors, null, 2));

    // Output ONLY JSON to stdout for PHP to capture safely
    process.stdout.write(JSON.stringify(vendors));
})();
