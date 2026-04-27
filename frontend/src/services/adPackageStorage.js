const AD_PACKAGE_STORAGE_KEY = 'smartcity.ad-packages.v1';

export const PACKAGE_TIERS = {
  premium: {
    value: 'premium',
    label: 'Premium',
    color: '#d9a500',
    accent: '#fff4cc',
  },
  boosted: {
    value: 'boosted',
    label: 'Boosted',
    color: '#a1a8b5',
    accent: '#edf1f7',
  },
  basic: {
    value: 'basic',
    label: 'Basic',
    color: '#b9723d',
    accent: '#f8ebe2',
  },
};

export const PACKAGE_DURATIONS = [
  { value: 1, label: '1 month', days: 30 },
  { value: 3, label: '3 months', days: 90 },
  { value: 6, label: '6 months', days: 180 },
];

export const PACKAGE_FEATURES = [
  {
    key: 'showInTrending',
    label: 'Show in Trending',
    description: 'Place this post in high-traffic trending blocks.',
  },
  {
    key: 'showOnHomepageBanner',
    label: 'Featured Post Badge',
    description: 'Highlight posts with a HOT badge across the homepage and other listing surfaces.',
  },
  {
    key: 'priorityReview',
    label: 'Priority Approval',
    description: 'Move this post to a faster review queue.',
  },
  {
    key: 'postLimitEnabled',
    label: 'Post Quantity Limit',
    description: 'Enable and define how many posts this package can promote.',
  },
];

function readJsonArray(storageKey) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArray(storageKey, items) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(items));
}

function toDurationDays(months) {
  return Number(months) * 30;
}

export function formatCurrencyVnd(value) {
  const amount = Number.parseInt(value, 10) || 0;
  return `${amount.toLocaleString('vi-VN')} VND`;
}

export function normalizeDiscountPercent(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(99, Math.max(0, Math.trunc(parsed)));
}

export function calculateDiscountedPackagePrice(price, discountPercent = 0) {
  const normalizedPrice = Number.parseInt(price, 10) || 0;
  const normalizedDiscountPercent = normalizeDiscountPercent(discountPercent);

  if (normalizedPrice <= 0 || normalizedDiscountPercent <= 0) {
    return normalizedPrice;
  }

  return Math.max(0, Math.trunc(normalizedPrice - ((normalizedPrice * normalizedDiscountPercent) / 100)));
}

export function getAdPackages() {
  const packages = readJsonArray(AD_PACKAGE_STORAGE_KEY);
  return packages
    .slice()
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
}

export function createAdPackage(payload) {
  const currentPackages = getAdPackages();
  const durationMonths = Number(payload.durationMonths) || 1;
  const packageRecord = {
    id: `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(payload.name || '').trim(),
    tier: payload.tier,
    price: Number.parseInt(payload.price, 10) || 0,
    durationMonths,
    durationDays: toDurationDays(durationMonths),
    features: {
      showInTrending: Boolean(payload.features?.showInTrending),
      showOnHomepageBanner: Boolean(payload.features?.showOnHomepageBanner),
      priorityReview: Boolean(payload.features?.priorityReview),
      postLimitEnabled: Boolean(payload.features?.postLimitEnabled),
      postLimit: payload.features?.postLimitEnabled ? Number(payload.features?.postLimit || 0) : null,
    },
    createdAt: new Date().toISOString(),
  };

  writeJsonArray(AD_PACKAGE_STORAGE_KEY, [packageRecord, ...currentPackages]);

  return packageRecord;
}

export function deleteAdPackage(packageId) {
  const nextPackages = getAdPackages().filter((item) => item.id !== packageId);
  writeJsonArray(AD_PACKAGE_STORAGE_KEY, nextPackages);

  return nextPackages;
}

export function getTierMeta(tier) {
  return PACKAGE_TIERS[tier] || PACKAGE_TIERS.basic;
}

export function getPackageDurationMeta(durationMonths) {
  return PACKAGE_DURATIONS.find((option) => Number(option.value) === Number(durationMonths)) || PACKAGE_DURATIONS[0];
}
