import puppeteer from "puppeteer";
import fs from "fs";

(async () => {
    const [, , searchUrl, maxPages] = process.argv;
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    );

    const results = [];

    for (let p = 1; p <= parseInt(maxPages || 1); p++) {
        const urlToVisit = `${searchUrl}?page=${p}`;
        try {
            await page.goto(urlToVisit, { waitUntil: "domcontentloaded" });
            await new Promise((r) => setTimeout(r, 2000));

            const productLinks = await page.$$eval(
                'a[data-testid="product-card-title"]',
                (els) => els.map((a) => a.href),
            );

            const uniqueLinks = [...new Set(productLinks)].slice(0, 5);

            for (const detailUrl of uniqueLinks) {
                const detail = await browser.newPage();
                try {
                    await detail.goto(detailUrl, {
                        waitUntil: "domcontentloaded",
                    });
                    await new Promise((r) => setTimeout(r, 1500));

                    const title = await detail
                        .$eval("h1", (el) => el.textContent.trim())
                        .catch(() => null);
                    const price = await detail
                        .$eval("span[data-testid='product-price']", (el) =>
                            el.textContent.trim(),
                        )
                        .catch(() => null);
                    const seller = await detail
                        .$eval(".seller-name", (el) => el.textContent.trim())
                        .catch(() => null);

                    const bodyText = await detail.evaluate(
                        () => document.body.innerText,
                    );
                    const phoneMatch = bodyText.match(/(?:0|\+?234)\d{9,10}/);
                    const emailMatch = bodyText.match(
                        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
                    );

                    results.push({
                        title,
                        price,
                        seller,
                        profile_url: detailUrl,
                        phone: phoneMatch ? phoneMatch[0] : null,
                        email: emailMatch ? emailMatch[0] : null,
                    });
                } finally {
                    await detail.close();
                }
            }
        } catch (err) {
            console.error("Listing parse error:", err.message);
        }
    }

    await browser.close();
    fs.writeFileSync("jumia_vendors.json", JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
})();
