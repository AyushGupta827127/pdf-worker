import puppeteer from "puppeteer";

let browser;

export async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      executablePath:
        process.env.CHROME_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote"
      ]
    });
  }
  return browser;
}
