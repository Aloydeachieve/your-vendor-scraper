import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const [, , searchUrl, maxPages] = process.argv;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const vendors = [];

  for (let p = 1; p <= parseInt(maxPages); p++) {
    await page.goto(`${searchUrl}&page=${p}`, { waitUntil: 'networkidle2' });

    // 1️⃣ Collect product detail URLs
    const productLinks = await page.$$eval('a[href$=".html"]', links => 
      links.map(a => a.href).filter(Boolean)
    );

    for (const detailUrl of productLinks.slice(0, 5)) {
      try {
        await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // 2️⃣ Try to click the "Show contact" button
        try {
          await page.waitForSelector('button:has-text("Show contact"), span:has-text("Show contact")', { timeout: 3000 });
          await page.click('button:has-text("Show contact"), span:has-text("Show contact")');
          await page.waitForTimeout(1500);
        } catch {}

        // 3️⃣ Extract phone/whatsapp/email
        const contact = await page.evaluate(() => {
          const phoneEl = document.querySelector('a[href^="tel:"]');
          const whatsappEl = document.querySelector('a[href*="whatsapp"]');

          return {
            phone: phoneEl ? phoneEl.href.replace('tel:', '') : null,
            whatsapp: whatsappEl ? whatsappEl.href.match(/wa.me\/(\d+)/)?.[1] : null,
            email: document.querySelector('a[href^="mailto:"]')?.href.replace('mailto:', '') ?? null
          };
        });

        vendors.push({ detailUrl, ...contact });
      } catch (e) {
        console.error('Error visiting detail:', detailUrl, e.message);
      }
    }
  }

  await browser.close();

  fs.writeFileSync('vendors.json', JSON.stringify(vendors, null, 2));
  console.log(JSON.stringify(vendors));
})();