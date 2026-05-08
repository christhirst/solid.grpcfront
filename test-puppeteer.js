const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  page.on('console', msg => console.log(`[CONSOLE ${msg.type()}]`, msg.text()));
  page.on('pageerror', err => console.error(`[PAGE ERROR]`, err));
  page.on('response', response => {
    if (!response.ok()) {
      console.log(`[NETWORK ERROR] ${response.status()} ${response.url()}`);
    }
  });

  try {
    await page.goto('http://localhost:3000/workflows/test_final_123', { waitUntil: 'networkidle0' });
    console.log("Page loaded. Waiting for 3 seconds...");
    await new Promise(r => setTimeout(r, 3000));
    console.log("Dumping body snippet:");
    const body = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
    console.log(body);
  } catch (err) {
    console.error("Navigation failed:", err);
  }

  await browser.close();
})();
