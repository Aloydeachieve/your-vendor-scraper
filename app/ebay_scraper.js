import puppeteer from "puppeteer";
import fs from "fs";

(async () => {
  const [, , searchUrl] = process.argv;
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const items = [];

  await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

  const productLinks = await page.$$eval('.s-item__link', els => els.map(el => el.href).slice(0,5));

  for (const link of productLinks) {
    const detail = await browser.newPage();
    await detail.goto(link, { waitUntil: "domcontentloaded" });

    const title = await detail.$eval("#itemTitle", el => el.textContent.trim()).catch(() => null);
    const price = await detail.$eval("#prcIsum, #prcIsum_bidPrice", el => el.textContent.trim()).catch(() => null);
    const seller = await detail.$eval(".mbg-nw", el => el.textContent.trim()).catch(() => null);

    items.push({ title, price, seller, profile_url: link });
    await detail.close();
  }

  await browser.close();
  fs.writeFileSync("ebay_vendors.json", JSON.stringify(items, null, 2));
})();