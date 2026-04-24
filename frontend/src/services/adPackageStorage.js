const AD_PACKAGE_STORAGE_KEY = 'smartcity.ad-packages.v1';
const AD_SELECTION_STORAGE_KEY = 'smartcity.ad-package-selections.v1';

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
    label: 'Show on Homepage Banner',
    description: 'Show campaign visuals on the homepage spotlight area.',
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

  const selectionRows = readJsonArray(AD_SELECTION_STORAGE_KEY);
  const nextSelections = selectionRows.filter((row) => row.packageId !== packageId);
  writeJsonArray(AD_SELECTION_STORAGE_KEY, nextSelections);

  return nextPackages;
}

export function getTierMeta(tier) {
  return PACKAGE_TIERS[tier] || PACKAGE_TIERS.basic;
}

export function getPackageDurationMeta(durationMonths) {
  return PACKAGE_DURATIONS.find((option) => Number(option.value) === Number(durationMonths)) || PACKAGE_DURATIONS[0];
}

export function getAdPackageSelectionByVenue(venueId) {
  const selections = readJsonArray(AD_SELECTION_STORAGE_KEY);
  return selections.find((item) => Number(item.venueId) === Number(venueId)) || null;
}

export function saveAdPackageSelection({ venueId, packageId }) {
  const selections = readJsonArray(AD_SELECTION_STORAGE_KEY);
  const normalizedVenueId = Number(venueId);
  const nextRow = {
    venueId: normalizedVenueId,
    packageId,
    selectedAt: new Date().toISOString(),
  };

  const nextSelections = [
    nextRow,
    ...selections.filter((item) => Number(item.venueId) !== normalizedVenueId),
  ];

  writeJsonArray(AD_SELECTION_STORAGE_KEY, nextSelections);

  return nextRow;
}
