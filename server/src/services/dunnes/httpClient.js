import {
  DUNNES_WEBSITE_BASE_URL,
  REQUEST_TIMEOUT_MS,
} from './constants.js';

import {
  cleanText,
  createProductUrl,
  parsePrice,
  slugify,
} from './textUtils.js';

async function fetchWithTimeout(
  endpoint,
  options = {},
) {
  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () => {
        controller.abort();
      },
      REQUEST_TIMEOUT_MS,
    );

  try {
    return await fetch(
      endpoint,
      {
        ...options,

        signal:
          controller.signal,
      },
    );
  } finally {
    clearTimeout(
      timeoutId,
    );
  }
}

export async function fetchJson(
  endpoint,
) {
  try {
    const response =
      await fetchWithTimeout(
        endpoint,
        {
          method:
            'GET',

          headers: {
            Accept:
              'application/json',

            Origin:
              DUNNES_WEBSITE_BASE_URL,

            Referer:
              `${DUNNES_WEBSITE_BASE_URL}/`,

            'User-Agent':
              'Mozilla/5.0 DunnesSmartTrolley/1.0',
          },
        },
      );

    if (
      !response.ok
    ) {
      return null;
    }

    const contentType =
      String(
        response.headers.get(
          'content-type',
        ) || '',
      );

    if (
      !contentType.includes(
        'application/json',
      )
    ) {
      return null;
    }

    return await response.json();
  } catch (error) {
    return null;
  }
}

async function fetchHtml(
  endpoint,
) {
  if (!endpoint) {
    return '';
  }

  try {
    const response =
      await fetchWithTimeout(
        endpoint,
        {
          method:
            'GET',

          redirect:
            'follow',

          headers: {
            Accept:
              'text/html,application/xhtml+xml',

            'Accept-Language':
              'en-IE,en;q=0.9',

            'Cache-Control':
              'no-cache',

            Pragma:
              'no-cache',

            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150.0.0.0 Safari/537.36',
          },
        },
      );

    if (
      !response.ok
    ) {
      return '';
    }

    return await response.text();
  } catch (error) {
    return '';
  }
}

export async function fetchSearchHtml(
  query,
) {
  const resultEndpoints = [
    `${DUNNES_WEBSITE_BASE_URL}/results?page=1&q=${encodeURIComponent(
      query,
    )}&skip=0`,

    `${DUNNES_WEBSITE_BASE_URL}/search?q=${encodeURIComponent(
      query,
    )}`,
  ];

  for (
    const endpoint of resultEndpoints
  ) {
    const html =
      await fetchHtml(
        endpoint,
      );

    if (html) {
      return html;
    }
  }

  return '';
}

function getMonthNumber(
  value,
) {
  const monthName =
    String(value || '')
      .trim()
      .slice(0, 3)
      .toLowerCase();

  const months = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  return months[monthName] ??
    null;
}

function parseDunnesDate(
  value,
  endOfDay = false,
) {
  if (!value) {
    return {
      displayDate:
        null,

      utcDate:
        null,
    };
  }

  const cleanedDate =
    cleanText(value)
      .replace(
        /(\d+)(st|nd|rd|th)/gi,
        '$1',
      )
      .replace(/,/g, '')
      .trim();

  const match =
    cleanedDate.match(
      /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/,
    );

  if (!match) {
    return {
      displayDate:
        cleanText(value),

      utcDate:
        null,
    };
  }

  const day =
    Number(match[1]);

  const month =
    getMonthNumber(
      match[2],
    );

  const year =
    Number(match[3]);

  if (
    !Number.isInteger(day) ||
    month === null ||
    !Number.isInteger(year)
  ) {
    return {
      displayDate:
        cleanText(value),

      utcDate:
        null,
    };
  }

  const date =
    endOfDay
      ? new Date(
          Date.UTC(
            year,
            month,
            day,
            23,
            59,
            59,
            999,
          ),
        )
      : new Date(
          Date.UTC(
            year,
            month,
            day,
            0,
            0,
            0,
            0,
          ),
        );

  return {
    displayDate:
      cleanText(value),

    utcDate:
      date.toISOString(),
  };
}

function extractMinimumQuantity(
  promotionName,
) {
  const match =
    cleanText(
      promotionName,
    ).match(
      /(?:buy\s+)?(\d+)\s+for\s+[€£]?\s*\d/i,
    );

  if (!match) {
    return null;
  }

  const quantity =
    Number(match[1]);

  return Number.isFinite(
    quantity,
  ) && quantity > 0
    ? quantity
    : null;
}

function extractProductPagePrice(
  pageText,
) {
  const prices = [
    ...pageText.matchAll(
      /€\s*(\d+(?:[.,]\d{1,2})?)/g,
    ),
  ]
    .map(
      (match) =>
        parsePrice(
          match[1],
        ),
    )
    .filter(
      (price) =>
        Number.isFinite(price),
    );

  return prices.length > 0
    ? prices[0]
    : null;
}

function extractPromotionName(
  pageText,
) {
  const patterns = [
    /\bBuy\s+\d+\s+for\s+€\s*\d+(?:[.,]\d{1,2})?\b/i,

    /\b\d+\s+for\s+€\s*\d+(?:[.,]\d{1,2})?\b/i,

    /\bSave\s+€\s*\d+(?:[.,]\d{1,2})?\b/i,

    /\bHalf\s+Price\b/i,

    /\bBetter\s+Than\s+Half\s+Price\b/i,

    /\bBuy\s+One\s+Get\s+One\s+Free\b/i,

    /\bBOGOF\b/i,
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      pageText.match(
        pattern,
      );

    if (match?.[0]) {
      return cleanText(
        match[0],
      );
    }
  }

  return '';
}

function extractPromotionDates(
  pageText,
) {
  const fullDateMatch =
    pageText.match(
      /Sales?\s+price\s+valid\s+from\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})\s+until\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i,
    );

  if (fullDateMatch) {
    return {
      start:
        parseDunnesDate(
          fullDateMatch[1],
          false,
        ),

      end:
        parseDunnesDate(
          fullDateMatch[2],
          true,
        ),
    };
  }

  const shortDateMatch =
    pageText.match(
      /Offer\s+Valid:\s*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+)\s*-\s*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+)/i,
    );

  if (!shortDateMatch) {
    return {
      start: {
        displayDate:
          null,

        utcDate:
          null,
      },

      end: {
        displayDate:
          null,

        utcDate:
          null,
      },
    };
  }

  const currentYear =
    new Date().getUTCFullYear();

  return {
    start:
      parseDunnesDate(
        `${shortDateMatch[1]} ${currentYear}`,
        false,
      ),

    end:
      parseDunnesDate(
        `${shortDateMatch[2]} ${currentYear}`,
        true,
      ),
  };
}

function createWebPromotionId(
  promotionName,
  startDate,
  endDate,
) {
  const promotionKey =
    [
      slugify(
        promotionName,
      ),

      startDate ||
        'no-start',

      endDate ||
        'no-end',
    ]
      .filter(Boolean)
      .join('_');

  return (
    `WEB_${promotionKey}` ||
    'WEB_PROMOTION'
  );
}

function extractPromotionFromProductPage(
  html,
) {
  if (!html) {
    return {
      price:
        null,

      promotions:
        [],
    };
  }

  const pageText =
    cleanText(html);

  const promotionName =
    extractPromotionName(
      pageText,
    );

  if (!promotionName) {
    return {
      price:
        extractProductPagePrice(
          pageText,
        ),

      promotions:
        [],
    };
  }

  const promotionDates =
    extractPromotionDates(
      pageText,
    );

  const minimumQuantity =
    extractMinimumQuantity(
      promotionName,
    );

  const promotionType =
    minimumQuantity
      ? 'BulkPromotion'
      : 'ProductPromotion';

  const promotion = {
    id:
      createWebPromotionId(
        promotionName,
        promotionDates.start
          .utcDate,
        promotionDates.end
          .utcDate,
      ),

    name:
      promotionName,

    description:
      promotionName,

    type:
      promotionType,

    promotionType,

    minimumQuantity,

    startDate:
      promotionDates.start
        .displayDate,

    startDateUtc:
      promotionDates.start
        .utcDate,

    endDate:
      promotionDates.end
        .displayDate,

    endDateUtc:
      promotionDates.end
        .utcDate,

    limit:
      null,

    threshold:
      null,

    limitPerSku:
      null,

    pointsBased:
      false,

    loyaltyBased:
      false,

    externalOffers:
      false,

    isMoneyOff:
      true,

    promotionSource:
      'dunnes-product-page',
  };

  return {
    price:
      extractProductPagePrice(
        pageText,
      ),

    promotions: [
      promotion,
    ],
  };
}

export async function fetchProductPagePromotion(
  product,
) {
  const productUrl =
    createProductUrl(
      product,
    );

  if (!productUrl) {
    return {
      productUrl:
        '',

      price:
        null,

      promotions:
        [],
    };
  }

  const html =
    await fetchHtml(
      productUrl,
    );

  const pagePromotion =
    extractPromotionFromProductPage(
      html,
    );

  return {
    productUrl,

    price:
      pagePromotion.price,

    promotions:
      pagePromotion.promotions,
  };
}

