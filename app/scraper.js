import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";

puppeteer.use(StealthPlugin());

(async () => {
    const [, , searchUrl, maxPages] = process.argv;
    const browser = await puppeteer.launch({
        headless: "new", // Use the newer headless mode which is harder to detect
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage" // Prevents memory crashes in Docker
        ]
    });

    const page = await browser.newPage();
    const vendors = [];

    try {
        // 1. Visit the search page
        await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });

        // 2. Extract Product Links (Jiji uses .b-list-advert-base__item)
        const productLinks = await page.$$eval('a[href*=".html"]', (els) => 
            els.map(el => el.href).filter(href => href.includes('/it/')) // Filter for actual items
        );

        const uniqueLinks = [...new Set(productLinks)].slice(0, 5);

        for (const productUrl of uniqueLinks) {
            const productPage = await browser.newPage();
            try {
                await productPage.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 45000 });

                // Jiji hides phone numbers behind a button that triggers an API call
                const showButton = await productPage.$('button[class*="qa-show-contact"]');
                if (showButton) {
                    await showButton.click();
                    // Wait for the text to change from "Show Contact" to the actual number
                    await new Promise(r => setTimeout(r, 1500)); 
                }

                const data = await productPage.evaluate(() => {
                    const phoneEl = document.querySelector('a[href^="tel:"]');
                    return {
                        title: document.querySelector('h1')?.textContent?.trim() || "N/A",
                        price: document.querySelector('span[itemprop="price"]')?.getAttribute('content') || "N/A",
                        phone: phoneEl ? phoneEl.getAttribute('href').replace('tel:', '') : "Hidden",
                    };
                });

                vendors.push({ ...data, profile_url: productUrl });
            } catch (e) {
                // Silently skip failed product pages
            } finally {
                await productPage.close();
            }
        }
    } catch (err) {
        console.error("Navigation error:", err.message);
    }

    await browser.close();
    process.stdout.write(JSON.stringify(vendors)); // Ensure Laravel gets the JSON
})();
