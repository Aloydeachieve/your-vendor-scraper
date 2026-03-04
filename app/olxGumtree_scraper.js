import puppeteer from "puppeteer";
import fs from "fs";

(async () => {
  const [, , searchUrl] = process.argv;
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const result = [];

  await page.goto(searchUrl);

  const links = await page.$$eval('a[href*="/item/"]', els => els.map(el => el.href).slice(0, 5));

  for (const link of links) {
    const detail = await browser.newPage();
    await detail.goto(link);

    const title = await detail.$eval("h1", el => el.innerText).catch(() => null);

    const phone = await detail.evaluate(() => {
      const btn = document.querySelector('button.show-phone, .contact-btn');
      if (btn) {
        btn.click();
        return new Promise(res => setTimeout(() => {
          const p = document.querySelector('a[href^="tel:"]');
          res(p ? p.href.replace('tel:', '') : null);
        }, 1500));
      }
      return null;
    });

    result.push({ title, phone, profile_url: link });
    await detail.close();
  }

  await browser.close();
  fs.writeFileSync("olx_gumtree.json", JSON.stringify(result, null,2));
})();