import puppeteer from "puppeteer";
import fs from "fs";

(async () => {
  const [, , searchUrl] = process.argv;
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
  const productLinks = await page.$$eval('a.a-link-normal.s-no-outline', els => els.map(el => el.href).slice(0,5));

  const items = [];
  for (const link of productLinks) {
    const detail = await browser.newPage();
    await detail.goto(link);

    const title = await detail.$eval("#productTitle", el => el.textContent.trim()).catch(() => null);
    const price = await detail.$eval(".a-price-whole", el => el.textContent.trim()).catch(() => null);

    items.push({ title, price, profile_url: link });
    await detail.close();
  }

  await browser.close();
  fs.writeFileSync("amazon_products.json", JSON.stringify(items, null,2));
})();