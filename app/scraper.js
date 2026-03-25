import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";

puppeteer.use(StealthPlugin());

(async () => {
    const [, , searchUrl, maxPages] = process.argv;
    if (!searchUrl) {
        console.error("Usage: node scraper.js <searchUrl> [maxPages]");
        process.exit(1);
    }

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
        await page
            .goto("https://jiji.ng", {
                waitUntil: "domcontentloaded",
                timeout: 45000,
            })
            .catch(() => {});

        // open login modal
        const loginBtn = await page.$(
            'a[href*="login"], a[data-testid="login-button"], [class*="login"], [class*="sign-in"]',
        );
        if (loginBtn) {
            await loginBtn.click().catch(() => {});
            await new Promise((r) => setTimeout(r, 2000)); // let modal open
        }

        if (process.env.JIJI_EMAIL && process.env.JIJI_PASSWORD) {
            // Emulate typing in the modal inputs using React value setters
            await page.evaluate(
                (email, password) => {
                    const pwInputs = Array.from(
                        document.querySelectorAll('input[type="password"]'),
                    );
                    if (!pwInputs.length) return;
                    const pwInput = pwInputs[pwInputs.length - 1]; // Usually the actual password field
                    const form =
                        pwInput.closest("form") ||
                        pwInput.parentElement.parentElement.parentElement;

                    // Find email/phone input
                    const textInputs = Array.from(
                        form.querySelectorAll(
                            'input:not([type="password"]):not([type="hidden"])',
                        ),
                    );
                    const emailInput = textInputs.find(
                        (i) =>
                            i.type === "email" ||
                            (i.placeholder &&
                                i.placeholder
                                    .toLowerCase()
                                    .includes("email")) ||
                            (i.name &&
                                i.name.toLowerCase().includes("email")) ||
                            (i.name &&
                                i.name.toLowerCase().includes("user_id")) ||
                            i.type === "text" ||
                            i.type === "tel",
                    );

                    if (emailInput && pwInput) {
                        // React 16+ friendly value setter
                        const nativeInputValueSetter =
                            Object.getOwnPropertyDescriptor(
                                window.HTMLInputElement.prototype,
                                "value",
                            ).set;

                        nativeInputValueSetter.call(emailInput, email);
                        emailInput.dispatchEvent(
                            new Event("input", { bubbles: true }),
                        );
                        emailInput.dispatchEvent(
                            new Event("change", { bubbles: true }),
                        );

                        nativeInputValueSetter.call(pwInput, password);
                        pwInput.dispatchEvent(
                            new Event("input", { bubbles: true }),
                        );
                        pwInput.dispatchEvent(
                            new Event("change", { bubbles: true }),
                        );

                        const submitBtn = form.querySelector(
                            'button[type="submit"], button',
                        );
                        if (submitBtn) {
                            submitBtn.click();
                        }
                    }
                },
                process.env.JIJI_EMAIL,
                process.env.JIJI_PASSWORD,
            );

            await new Promise((r) => setTimeout(r, 3000)); // Wait for login to process
        }

        console.log("Logged in successfully");
    } catch (loginErr) {
        console.error("Login sequence failed (ignoring):", loginErr.message);
    }

    const vendors = [];

    async function extractJijiDetail(detailUrl, pageInstance) {
        try {
            const showBtn = await pageInstance.$(
                "button.qa-show-contact, .b-seller-info__action-button",
            );
            if (showBtn) {
                await showBtn.click();
                await new Promise((r) => setTimeout(r, 2000));
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
        // First go to the URL
        await page
            .goto(searchUrl, {
                waitUntil: "domcontentloaded",
                timeout: 45000,
            })
            .catch(() => console.error("Navigation failed to URL:", searchUrl));
        await new Promise((r) => setTimeout(r, 2000));

        // Determine if it is a single product page or a category page dynamically
        const isProductPage = await page.evaluate(() => {
            return !!document.querySelector(".b-seller-info, .qa-show-contact");
        });

        if (isProductPage) {
            const data = await extractJijiDetail(searchUrl, page);
            vendors.push(data);
        } else {
            // It is a category listing page
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
