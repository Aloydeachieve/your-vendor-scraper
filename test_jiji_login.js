import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
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
    const clickedSignIn = await page
        .click('a[href*="login"], a[data-testid="login-button"], [class*="login"], [class*="sign-in"]')
        .then(() => true)
        .catch(() => {
            console.error("Could not click sign in");
            return false;
        });

    if (!clickedSignIn) {
        await browser.close();
        process.exit(1);
    }

    await page.waitForTimeout(5000); // let modal open

    const html = await page.evaluate(() => {
        const modal = document.querySelector(
            '.b-auth-modal, .b-modal:has(input[type="password"]), [class*="auth"], form',
        );
        return modal ? modal.innerHTML : document.body.innerHTML;
    });

    // Save to a file to examine
    fs.writeFileSync("jiji_modal.html", html);
    console.log("Saved jiji_modal.html");

    await browser.close();
})();
