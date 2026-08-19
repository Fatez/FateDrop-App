const { chromium } = require('playwright');

function browserLaunchOptions() {
  const headless = process.env.FATEDROP_HEADLESS !== 'false';
  return {
    headless,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  };
}

async function openBrowserSession() {
  const cdpUrl = process.env.FATEDROP_CDP_URL?.trim();

  if (cdpUrl) {
    console.log(`Connecting to configured Chrome CDP endpoint: ${cdpUrl}`);
    const browser = await chromium.connectOverCDP(cdpUrl);
    const context = browser.contexts()[0];
    if (!context) throw new Error('Configured CDP browser has no usable context');
    return { browser, context, ownsBrowser: false, mode: 'cdp' };
  }

  console.log('Launching FateDrop-managed Chromium for cloud monitoring...');
  const browser = await chromium.launch(browserLaunchOptions());
  const context = await browser.newContext({
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  });
  return { browser, context, ownsBrowser: true, mode: 'managed' };
}

async function closeBrowserSession(session) {
  if (!session?.browser) return;
  if (session.ownsBrowser) await session.browser.close();
}

module.exports = { openBrowserSession, closeBrowserSession, browserLaunchOptions };
