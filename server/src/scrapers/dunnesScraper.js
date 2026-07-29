import { chromium } from 'playwright';

const ALLOWED_HOSTNAME = 'www.dunnesstoresgrocery.com';

function validateDunnesUrl(productUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(productUrl);
  } catch {
    throw new Error('The product URL is invalid.');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed.');
  }

  if (parsedUrl.hostname !== ALLOWED_HOSTNAME) {
    throw new Error('Only Dunnes Stores Grocery URLs are allowed.');
  }

  if (!parsedUrl.pathname.startsWith('/product/')) {
    throw new Error('The URL must be a Dunnes product page.');
  }

  return parsedUrl.toString();
}

function extractPrice(pageText, productName) {
  const productPosition = pageText.indexOf(productName);

  const relevantText =
    productPosition >= 0
      ? pageText.slice(
          productPosition + productName.length,
          productPosition + productName.length + 800
        )
      : pageText;

  const priceMatch = relevantText.match(
    /€\s*(\d+(?:[.,]\d{1,2})?)/
  );

  if (!priceMatch) {
    return null;
  }

  return Number(priceMatch[1].replace(',', '.'));
}

function extractProductNumber(pageText) {
  const match = pageText.match(
    /Product Number:\s*(\d+)/
  );

  return match?.[1] || '';
}

export async function scrapeDunnesProduct(productUrl) {
  const safeUrl = validateDunnesUrl(productUrl);

  let browser;

  try {
    browser = await chromium.launch({
      headless: false,
    });

    const context = await browser.newContext({
      locale: 'en-IE',
      viewport: {
        width: 1280,
        height: 900,
      },
    });

    const page = await context.newPage();

    await page.goto(safeUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForLoadState('networkidle', {
      timeout: 15000,
    }).catch(() => {
      console.log(
        'Page did not reach network idle, continuing.'
      );
    });

    const titleLocator = page
      .locator('h1, h2')
      .filter({
        hasText: /\S+/,
      })
      .first();

    await titleLocator.waitFor({
      state: 'visible',
      timeout: 15000,
    });

    const name = (
      await titleLocator.textContent()
    )?.trim();

    if (!name) {
      throw new Error(
        'The product name could not be found.'
      );
    }

    const pageText = await page
      .locator('body')
      .innerText();

    const price = extractPrice(pageText, name);

    if (!Number.isFinite(price)) {
      throw new Error(
        'The product price could not be found.'
      );
    }

    const productNumber =
      extractProductNumber(pageText);

    const image = await page
      .locator('meta[property="og:image"]')
      .getAttribute('content')
      .catch(() => '');

    return {
      name,
      price,
      currency: 'EUR',
      productNumber,
      image: image || '',
      url: safeUrl,
      source: 'dunnes-browser',
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(
      `Dunnes product lookup failed: ${error.message}`
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}