import crypto from 'node:crypto';

import {
  FieldValue,
} from 'firebase-admin/firestore';

import {
  adminDb,
} from '../config/firebaseAdmin.js';

const APP_ID =
  'dunnes-trolley';

const PROMOTION_CACHE_HOURS =
  Number(
    process.env
      .PROMOTION_CACHE_HOURS ||
      24,
  );

function getAppDocument() {
  return adminDb
    .collection(
      'artifacts',
    )
    .doc(APP_ID);
}

function getPromotionCollection() {
  return getAppDocument()
    .collection(
      'promotions',
    );
}

function getDunnesProductCollection() {
  return getAppDocument()
    .collection(
      'dunnesProducts',
    );
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseSku(value) {
  const sku =
    String(value || '')
      .replace(/\D/g, '')
      .trim();

  return /^\d{6,15}$/.test(
    sku,
  )
    ? sku
    : '';
}

function normaliseMoney(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const numberValue =
    Number(value);

  return Number.isFinite(
    numberValue,
  ) &&
    numberValue >= 0
    ? Number(
        numberValue.toFixed(2),
      )
    : null;
}

function normaliseDate(value) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function toJavaScriptDate(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toDate ===
    'function'
  ) {
    return value.toDate();
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createGeneratedPromotionId(
  campaign,
) {
  const canonicalValue = [
    cleanText(
      campaign.name,
    ).toLowerCase(),

    campaign.promotionType ||
      '',

    campaign.minimumQuantity ??
      '',

    campaign.bundlePrice ??
      '',

    campaign.startDateUtc ||
      '',

    campaign.endDateUtc ||
      '',
  ].join('|');

  const hash =
    crypto
      .createHash('sha256')
      .update(canonicalValue)
      .digest('hex')
      .slice(0, 14);

  const promotionSlug =
    slugify(
      campaign.name,
    ).slice(0, 48) ||
    'promotion';

  return (
    `AI_${promotionSlug}_${hash}`
  );
}

function createPromotionId(
  campaign,
) {
  const reportedId =
    cleanText(
      campaign.reportedId,
    )
      .replace(
        /[^A-Za-z0-9_-]/g,
        '_',
      )
      .slice(0, 120);

  return (
    reportedId ||
    createGeneratedPromotionId(
      campaign,
    )
  );
}

function normaliseCampaign(
  campaign,
) {
  const id =
    createPromotionId(
      campaign,
    );

  const eligibleSkus = [
    ...new Set(
      (
        Array.isArray(
          campaign.eligibleSkus,
        )
          ? campaign.eligibleSkus
          : []
      )
        .map(normaliseSku)
        .filter(Boolean),
    ),
  ];

  return {
    id,

    reportedId:
      cleanText(
        campaign.reportedId,
      ),

    name:
      cleanText(
        campaign.name,
      ),

    description:
      cleanText(
        campaign.description ||
          campaign.name,
      ),

    promotionType:
      cleanText(
        campaign.promotionType ||
          'ProductPromotion',
      ),

    minimumQuantity:
      Number.isFinite(
        Number(
          campaign.minimumQuantity,
        ),
      )
        ? Number(
            campaign.minimumQuantity,
          )
        : null,

    bundlePrice:
      normaliseMoney(
        campaign.bundlePrice,
      ),

    startDateUtc:
      normaliseDate(
        campaign.startDateUtc,
      ),

    endDateUtc:
      normaliseDate(
        campaign.endDateUtc,
      ),

    loyaltyBased:
      Boolean(
        campaign.loyaltyBased,
      ),

    pointsBased:
      Boolean(
        campaign.pointsBased,
      ),

    isMoneyOff:
      campaign.isMoneyOff !==
      false,

    eligibleSkus,

    confidence:
      Number(
        Number(
          campaign.confidence ||
            0,
        ).toFixed(4),
      ),

    evidence:
      cleanText(
        campaign.evidence,
      ),

    sourceUrls: [
      ...new Set(
        (
          Array.isArray(
            campaign.sourceUrls,
          )
            ? campaign.sourceUrls
            : []
        )
          .map(
            (url) =>
              String(
                url || '',
              ).trim(),
          )
          .filter(Boolean),
      ),
    ],

    source:
      'dunnes-ai-agent',
  };
}

function createPromotionSnapshot(
  campaign,
) {
  return {
    id:
      campaign.id,

    name:
      campaign.name,

    description:
      campaign.description,

    promotionType:
      campaign.promotionType,

    minimumQuantity:
      campaign.minimumQuantity,

    bundlePrice:
      campaign.bundlePrice,

    startDateUtc:
      campaign.startDateUtc,

    endDateUtc:
      campaign.endDateUtc,

    loyaltyBased:
      campaign.loyaltyBased,

    pointsBased:
      campaign.pointsBased,

    isMoneyOff:
      campaign.isMoneyOff,

    confidence:
      campaign.confidence,

    promotionSource:
      campaign.source,
  };
}

function isCampaignActive(
  campaign,
  now = new Date(),
) {
  if (!campaign) {
    return false;
  }

  const startDate =
    campaign.startDateUtc
      ? new Date(
          campaign.startDateUtc,
        )
      : null;

  const endDate =
    campaign.endDateUtc
      ? new Date(
          campaign.endDateUtc,
        )
      : null;

  if (
    startDate &&
    !Number.isNaN(
      startDate.getTime(),
    ) &&
    now < startDate
  ) {
    return false;
  }

  if (
    endDate &&
    !Number.isNaN(
      endDate.getTime(),
    ) &&
    now > endDate
  ) {
    return false;
  }

  return true;
}

function isCacheFresh(
  checkedAt,
) {
  const checkedDate =
    toJavaScriptDate(
      checkedAt,
    );

  if (!checkedDate) {
    return false;
  }

  const cacheDuration =
    PROMOTION_CACHE_HOURS *
    60 *
    60 *
    1000;

  return (
    Date.now() -
      checkedDate.getTime() <
    cacheDuration
  );
}

export async function getCachedPromotionsForSku(
  sku,
) {
  const cleanSku =
    normaliseSku(sku);

  if (!cleanSku) {
    return {
      sku:
        '',

      promotions:
        [],

      promotionIds:
        [],

      cacheFresh:
        false,
    };
  }

  const productSnapshot =
    await getDunnesProductCollection()
      .doc(cleanSku)
      .get();

  if (!productSnapshot.exists) {
    return {
      sku:
        cleanSku,

      promotions:
        [],

      promotionIds:
        [],

      cacheFresh:
        false,
    };
  }

  const productData =
    productSnapshot.data();

  const promotionIds = [
    ...new Set(
      (
        Array.isArray(
          productData.promotionIds,
        )
          ? productData.promotionIds
          : []
      )
        .map(
          (id) =>
            String(
              id || '',
            ).trim(),
        )
        .filter(Boolean),
    ),
  ];

  let promotions = [];

  if (
    promotionIds.length > 0
  ) {
    const promotionSnapshots =
      await Promise.all(
        promotionIds.map(
          (promotionId) =>
            getPromotionCollection()
              .doc(promotionId)
              .get(),
        ),
      );

    promotions =
      promotionSnapshots
        .filter(
          (snapshot) =>
            snapshot.exists,
        )
        .map(
          (snapshot) => ({
            id:
              snapshot.id,

            ...snapshot.data(),
          }),
        )
        .filter(
          (campaign) =>
            isCampaignActive(
              campaign,
            ),
        )
        .map(
          createPromotionSnapshot,
        );
  }

  return {
    sku:
      cleanSku,

    promotions,

    promotionIds:
      promotions.map(
        (promotion) =>
          promotion.id,
      ),

    cacheFresh:
      isCacheFresh(
        productData
          .promotionCheckedAt,
      ),
  };
}

export async function savePromotionDiscovery({
  requestedSkus,
  campaigns,
  noPromotionSkus,
}) {
  const cleanRequestedSkus = [
    ...new Set(
      (
        Array.isArray(
          requestedSkus,
        )
          ? requestedSkus
          : []
      )
        .map(normaliseSku)
        .filter(Boolean),
    ),
  ];

  const normalisedCampaigns =
    (
      Array.isArray(campaigns)
        ? campaigns
        : []
    )
      .map(
        normaliseCampaign,
      )
      .filter(
        (campaign) =>
          campaign.name &&
          campaign.eligibleSkus
            .length > 0,
      );

  const cleanNoPromotionSkus = [
    ...new Set(
      (
        Array.isArray(
          noPromotionSkus,
        )
          ? noPromotionSkus
          : []
      )
        .map(normaliseSku)
        .filter(Boolean),
    ),
  ];

  const promotionCollection =
    getPromotionCollection();

  const productCollection =
    getDunnesProductCollection();

  const batch =
    adminDb.batch();

  normalisedCampaigns.forEach(
    (campaign) => {
      batch.set(
        promotionCollection.doc(
          campaign.id,
        ),
        {
          ...campaign,

          eligibleSkus:
            FieldValue.arrayUnion(
              ...campaign.eligibleSkus,
            ),

          lastCheckedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),

          createdAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge:
            true,
        },
      );

      const promotionSnapshot =
        createPromotionSnapshot(
          campaign,
        );

      campaign.eligibleSkus.forEach(
        (sku) => {
          batch.set(
            productCollection.doc(
              sku,
            ),
            {
              dunnesSku:
                sku,

              promotionIds:
                FieldValue.arrayUnion(
                  campaign.id,
                ),

              promotions:
                FieldValue.arrayUnion(
                  promotionSnapshot,
                ),

              hasPromotion:
                true,

              promotionCheckedAt:
                FieldValue.serverTimestamp(),

              promotionUpdatedAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp(),
            },
            {
              merge:
                true,
            },
          );
        },
      );
    },
  );

  const checkedSkus = [
    ...new Set([
      ...cleanRequestedSkus,
      ...cleanNoPromotionSkus,
    ]),
  ];

  checkedSkus.forEach(
    (sku) => {
      const linkedCampaigns =
        normalisedCampaigns.filter(
          (campaign) =>
            campaign.eligibleSkus.includes(
              sku,
            ),
        );

      batch.set(
        productCollection.doc(
          sku,
        ),
        {
          dunnesSku:
            sku,

          promotionCheckedAt:
            FieldValue.serverTimestamp(),

          hasPromotion:
            linkedCampaigns.length >
            0,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge:
            true,
        },
      );
    },
  );

  await batch.commit();

  console.log(
    'Promotion campaigns saved to Firebase:',
    {
      requestedSkus:
        cleanRequestedSkus,

      campaignCount:
        normalisedCampaigns.length,

      campaigns:
        normalisedCampaigns.map(
          (campaign) => ({
            id:
              campaign.id,

            name:
              campaign.name,

            eligibleSkus:
              campaign.eligibleSkus,
          }),
        ),
    },
  );

  return normalisedCampaigns;
}