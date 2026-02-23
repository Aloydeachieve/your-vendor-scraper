const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const [, , searchUrl, maxPages] = process.argv;
  const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
  const page = await browser.newPage();
  
  const vendors = [];
  for(let p=1; p<=parseInt(maxPages); p++) {
    await page.goto(`${searchUrl}?page=${p}`, {waitUntil: 'networkidle2'});
    const products = await page.$$eval('.b-adapter__item', els => 
      els.slice(0,5).map(el => {
        const title = el.querySelector('h3')?.textContent?.trim();
        const price = el.querySelector('.amount')?.textContent?.trim();
        const link = el.querySelector('a[href*="/user/"], a[href*="/shop/"]');
        return link ? {title, price, profile_url: 'https://jiji.ng' + link.href} : null;
      }).filter(Boolean)
    );
    
    for(const product of products) {
      await page.goto(product.profile_url);
      const contacts = await page.evaluate(() => {
        const phone = document.querySelector('a[href^="tel:"]')?.href?.replace('tel:','') ||
                     [...document.querySelectorAll('*')].find(el => el.textContent.match(/\+\d{10,}/))?.textContent?.trim();
        const whatsapp = document.querySelector('a[href*="whatsapp"]')?.href?.match(/wa\.me\/(\d+)/)?.[1];
        const email = document.querySelector('a[href^="mailto:"]')?.href?.replace('mailto:','');
        return {phone, whatsapp, email};
      });
      vendors.push({...product, ...contacts});
    }
    await new Promise(r=>setTimeout(r,2000));
  }
  
  await browser.close();
  fs.writeFileSync('vendors.json', JSON.stringify(vendors));
  console.log(JSON.stringify(vendors));
})();
