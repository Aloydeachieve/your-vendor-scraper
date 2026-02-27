import puppeteer from "puppeteer";
import fs from "fs";

(async () => {
    const [, , searchUrl, maxPages] = process.argv;
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
        ],
    });

    const page = await browser.newPage();

    // Anti-bot bypass attempts (simple)
    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    );

    const vendors = [];

    for (let p = 1; p <= parseInt(maxPages || 1); p++) {
        const urlToVisit = searchUrl.includes("?")
            ? `${searchUrl}&page=${p}`
            : `${searchUrl}?page=${p}`;

        try {
            await page.goto(urlToVisit, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
            });
            await page.waitForTimeout(2000); // Wait for dynamic content

            // Get all product links from the listing page
            const productLinks = await page.$$eval(
                '.b-list-advert__item-wrapper, .b-list-advert__item, .b-list-advert-base, .b-adapter__item, a[href*="/user/"], a[href*="/shop/"]',
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

            // Unique links only
            const uniqueLinks = [...new Set(productLinks)].slice(0, 5); // Limit to 5 for testing

            for (const productUrl of uniqueLinks) {
                try {
                    const productPage = await browser.newPage();
                    await productPage.setUserAgent(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                    );
                    await productPage.goto(productUrl, {
                        waitUntil: "domcontentloaded",
                        timeout: 45000,
                    });

                    let phone = null;
                    let whatsapp = null;
                    let title = await productPage
                        .$eval("h1, .b-advert-title-inner", (el) =>
                            el.textContent.trim(),
                        )
                        .catch(() => "Unknown Title");
                    let price = await productPage
                        .$eval(".qa-advert-price, .amount", (el) =>
                            el.textContent.trim(),
                        )
                        .catch(() => "Unknown Price");

                    // Attempt to click the "Show contact" button to reveal number
                    try {
                        const showContactBtn = await productPage.$(
                            'button.qa-show-contact, .b-seller-info__action-button, button:has-text("Show contact")',
                        );
                        if (showContactBtn) {
                            await showContactBtn.click();
                            await productPage.waitForTimeout(2000); // Wait for API response/reveal
                        }
                    } catch (e) {}

                    // Extract revealed contact info
                    const contactInfo = await productPage.evaluate(() => {
                        let p =
                            document
                                .querySelector('a[href^="tel:"]')
                                ?.href?.replace("tel:", "") ||
                            [...document.querySelectorAll("*")]
                                .find((el) =>
                                    el.textContent.match(/\+?\d{10,14}/),
                                )
                                ?.textContent?.trim()
                                ?.match(/\+?\d{10,14}/)?.[0] ||
                            null;
                        let w =
                            document
                                .querySelector('a[href*="wa.me/"]')
                                ?.href?.match(/wa\.me\/(\d+)/)?.[1] || null;
                        return { phone: p, whatsapp: w };
                    });

                    phone = contactInfo.phone;
                    whatsapp = contactInfo.whatsapp;

                    vendors.push({
                        title,
                        price,
                        profile_url: productUrl,
                        phone,
                        whatsapp,
                        email: null, // Jiji rarely lists emails publicly
                    });

                    await productPage.close();
                    await new Promise((r) => setTimeout(r, 2000)); // Delay between requests
                } catch (detailErr) {
                    console.error(
                        `Failed parsing detail page: ${productUrl}`,
                        detailErr.message,
                    );
                }
            }
        } catch (listErr) {
            console.error(
                `Failed parsing listing page: ${urlToVisit}`,
                listErr.message,
            );
        }
    }

    await browser.close();
    fs.writeFileSync("vendors.json", JSON.stringify(vendors, null, 2));
    console.log(JSON.stringify(vendors));
})();
