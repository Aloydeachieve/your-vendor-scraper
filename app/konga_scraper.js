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
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    );

    const vendors = [];

    // Helper function to extract data from a single product page
    async function extractDetailData(detailUrl, pageInstance) {
        let title = await pageInstance
            .$eval("h1, ._2f9dd_1A1_s, .f20", (el) => el.textContent.trim())
            .catch(() => "Unknown Title");
        let price = await pageInstance
            .$eval("._50186_11l0w, .f30", (el) => el.textContent.trim())
            .catch(() => "Unknown Price");
        let sellerName = await pageInstance
            .$eval(".d9c39_1V_hD, ._3df79_1-lX6", (el) => el.textContent.trim())
            .catch(() => null);

        const contactInfo = await pageInstance.evaluate(() => {
            const html = document.body.innerText;
            const phoneMatch = html.match(
                /(?:0|\+?234)(?:\s)?(?:[789][01]\d)(?:\s)?(?:\d{3})(?:\s)?(?:\d{4})/,
            );
            const emailMatch = html.match(
                /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi,
            );
            return {
                phone: phoneMatch ? phoneMatch[0] : null,
                email: emailMatch ? emailMatch[0] : null,
            };
        });

        return {
            title,
            price,
            seller: sellerName,
            profile_url: detailUrl,
            phone: contactInfo.phone,
            whatsapp: null,
            email: contactInfo.email,
        };
    }

    try {
        // If the URL provided is already a product detail page
        if (searchUrl.includes("/product/") || searchUrl.includes(".com/p/")) {
            await page.goto(searchUrl, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
            });
            const data = await extractDetailData(searchUrl, page);
            vendors.push(data);
        } else {
            // It is a category listing page
            for (let p = 1; p <= parseInt(maxPages || 1); p++) {
                const urlToVisit = searchUrl.includes("?")
                    ? `${searchUrl}&page=${p}`
                    : `${searchUrl}?page=${p}`;

                await page.goto(urlToVisit, {
                    waitUntil: "domcontentloaded",
                    timeout: 60000,
                });
                await page.waitForTimeout(2000);

                const productLinks = await page.$$eval(
                    ".item > a, a.core",
                    (els) =>
                        els
                            .map((a) => a.href)
                            .filter(
                                (href) =>
                                    href &&
                                    (href.includes("/product/") ||
                                        href.includes(".com/p/")),
                            ),
                );

                const uniqueLinks = [...new Set(productLinks)].slice(0, 5);

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

                        const data = await extractDetailData(
                            productUrl,
                            productPage,
                        );
                        vendors.push(data);

                        await productPage.close();
                        await new Promise((r) => setTimeout(r, 2000));
                    } catch (detailErr) {
                        console.error(
                            `Failed parsing detail page: ${productUrl}`,
                            detailErr.message,
                        );
                    }
                }
            }
        }
    } catch (err) {
        console.error(`Scraping error: ${err.message}`);
    }

    await browser.close();
    fs.writeFileSync("konga_vendors.json", JSON.stringify(vendors, null, 2));

    // Using stdout to safely pass JSON back to PHP without intermingling with console.log
    process.stdout.write(JSON.stringify(vendors));
})();
