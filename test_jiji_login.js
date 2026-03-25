import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    console.log("Going to jiji.ng...");
    await page.goto("https://jiji.ng", { waitUntil: "networkidle2" });

    console.log("Clicking sign in...");
    await page
        .click('a[href*="login"], a[data-testid="login-button"]')
        .catch(() => console.error("Could not click sign in"));

    await page.waitForTimeout(2000); // let modal open

    const html = await page.evaluate(() => {
        const modal = document.querySelector(
            '.b-auth-modal, .b-modal:has(input[type="password"]), [class*="auth"], form',
        );
        return modal ? modal.innerHTML : document.body.innerHTML;
    });

    // Save to a file to examine
    import("fs").then((fs) => fs.writeFileSync("jiji_modal.html", html));
    console.log("Saved jiji_modal.html");

    await browser.close();
})();
