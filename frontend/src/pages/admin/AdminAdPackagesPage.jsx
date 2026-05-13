import { useCallback, useEffect, useMemo, useState } from 'react';
import useAdminI18n from '../../hooks/useAdminI18n';
import {
  calculateDiscountedPackagePrice,
  formatCurrencyVnd,
  getAdPackages as getLegacyAdPackages,
  getPackageDurationMeta,
  getTierMeta,
  PACKAGE_DURATIONS,
  PACKAGE_FEATURES,
  PACKAGE_TIERS,
} from '../../services/adPackageStorage';
import {
  createAdminAdPackage,
  deleteAdminAdPackage,
  fetchAdminAdPackageStats,
  fetchAdminAdPackageUsages,
  fetchPublicAdPackages,
  updateAdminAdPackage,
} from '../../services/api/adPackagesApi';
import './AdminAdPackagesPage.css';

const VIEW_MODES = {
  packages: 'packages',
  stats: 'stats',
};

const STATS_MONTH_OPTIONS = [3, 6, 12];

const DEFAULT_FEATURES = {
  showInTrending: false,
  trendPushLimit: 1,
  trendDisplayHours: 2,
  showOnHomepageBanner: false,
  priorityReview: false,
  postLimitEnabled: false,
  postLimit: 10,
};

function stripToDigits(value) {
  return String(value || '').replace(/\D+/g, '');
}

function formatNumberInputValue(value) {
  const digits = stripToDigits(value);
  if (!digits) {
    return '';
  }

  return Number.parseInt(digits, 10).toLocaleString('vi-VN');
}

function buildInitialFormState() {
  return {
    name: '',
    tier: PACKAGE_TIERS.premium.value,
    price: '',
    discountPercent: '',
    durationMonths: PACKAGE_DURATIONS[0].value,
    features: {
      ...DEFAULT_FEATURES,
    },
  };
}

function buildFormStateFromPackage(packageItem) {
  return {
    name: packageItem.name || '',
    tier: packageItem.tier || PACKAGE_TIERS.basic.value,
    price: String(packageItem.price || ''),
    discountPercent: packageItem.discountPercent ? String(packageItem.discountPercent) : '',
    durationMonths: Number(packageItem.durationMonths) || PACKAGE_DURATIONS[0].value,
    features: {
      ...DEFAULT_FEATURES,
      ...(packageItem.features || {}),
      postLimit: Number(packageItem.features?.postLimit || DEFAULT_FEATURES.postLimit),
      trendPushLimit: Number(packageItem.features?.trendPushLimit || DEFAULT_FEATURES.trendPushLimit),
      trendDisplayHours: Number(packageItem.features?.trendDisplayHours || DEFAULT_FEATURES.trendDisplayHours),
    },
  };
}

function formatPackageFeatures(features = {}) {
  const enabledFeatures = [];

  if (features.showInTrending) {
    const pushLimit = Number(features.trendPushLimit);
    const displayHours = Number(features.trendDisplayHours);
    enabledFeatures.push('Shown in Trending section');
    if (Number.isFinite(pushLimit) && pushLimit > 0) {
      enabledFeatures.push(`Trending pushes: ${pushLimit}`);
    }
    if (Number.isFinite(displayHours) && displayHours > 0) {
      enabledFeatures.push(`Trending display time: ${displayHours} hour(s)`);
    }
  }

  if (features.showOnHomepageBanner) {
    enabledFeatures.push('Featured Post Badge (HOT)');
  }

  if (features.priorityReview) {
    enabledFeatures.push('Priority approval queue');
  }

  if (features.postLimitEnabled) {
    const postLimit = Number(features.postLimit);
    if (Number.isFinite(postLimit) && postLimit > 0) {
      enabledFeatures.push(`Post quantity limit: ${postLimit}`);
    }
  }

  if (!enabledFeatures.length) {
    return ['No boosted distribution options enabled'];
  }

  return enabledFeatures;
}

function formatCreatedAt(value) {
  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return 'Unknown date';
  }

  return timestamp.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMonthLabel(monthKey) {
  const [rawYear, rawMonth] = String(monthKey || '').split('-');
  const year = Number.parseInt(rawYear, 10);
  const month = Number.parseInt(rawMonth, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey;
  }

  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function formatUsageCount(count) {
  const normalized = Number(count) || 0;
  return normalized.toLocaleString('en-US');
}

function formatUsageDate(dateValue) {
  if (!dateValue) {
    return 'N/A';
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A';
  }

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AdminAdPackagesPage() {
  const { language, tx } = useAdminI18n();
  const [activeView, setActiveView] = useState(VIEW_MODES.packages);
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingPackageId, setDeletingPackageId] = useState(null);
  const [editingPackageId, setEditingPackageId] = useState('');
  const [confirmDeletePackage, setConfirmDeletePackage] = useState(null);
  const [formState, setFormState] = useState(() => buildInitialFormState());
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [statsMonthWindow, setStatsMonthWindow] = useState(6);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [statsPayload, setStatsPayload] = useState(null);
  const [selectedStatsPackageId, setSelectedStatsPackageId] = useState('');
  const [usageRows, setUsageRows] = useState([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState('');

  const isEditMode = Boolean(editingPackageId);

  const packageCounterText = useMemo(() => {
    const count = packages.length;
    return `${count} ${count === 1 ? 'package' : 'packages'} configured`;
  }, [packages.length]);

  const normalizedBasePrice = useMemo(() => {
    const digits = stripToDigits(formState.price);
    return digits ? Number.parseInt(digits, 10) : 0;
  }, [formState.price]);

  const normalizedDiscountPercent = useMemo(() => {
    const digits = stripToDigits(formState.discountPercent);
    return digits ? Number.parseInt(digits, 10) : 0;
  }, [formState.discountPercent]);

  const discountedPreviewPrice = useMemo(
    () => calculateDiscountedPackagePrice(normalizedBasePrice, normalizedDiscountPercent),
    [normalizedBasePrice, normalizedDiscountPercent]
  );

  const loadPackages = useCallback(async () => {
    setLoadingPackages(true);

    try {
      const packageRows = await fetchPublicAdPackages();

      if (!packageRows.length) {
        const legacyPackages = getLegacyAdPackages();

        if (legacyPackages.length) {
          await Promise.all(
            legacyPackages.map((legacyPackage) =>
              createAdminAdPackage({
                name: legacyPackage.name,
                tier: legacyPackage.tier,
                price: Number(legacyPackage.price) || 100000,
                durationMonths: legacyPackage.durationMonths,
                features: legacyPackage.features,
              }).catch(() => null)
            )
          );

          const migratedRows = await fetchPublicAdPackages();
          setPackages(Array.isArray(migratedRows) ? migratedRows : []);
          setSuccessMessage('Existing local packages were synced to shared storage.');
          return;
        }
      }

      setPackages(Array.isArray(packageRows) ? packageRows : []);
    } catch (error) {
      setFormError(error.response?.data?.message || 'Could not load ad packages. Please refresh and try again.');
    } finally {
      setLoadingPackages(false);
    }
  }, []);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');

    try {
      const payload = await fetchAdminAdPackageStats(statsMonthWindow);
      setStatsPayload(payload || null);
    } catch (error) {
      setStatsError(error.response?.data?.message || 'Could not load package statistics right now.');
      setStatsPayload(null);
    } finally {
      setStatsLoading(false);
    }
  }, [statsMonthWindow]);

  useEffect(() => {
    if (activeView === VIEW_MODES.stats) {
      loadStats();
    }
  }, [activeView, loadStats]);

  useEffect(() => {
    if (!statsPayload?.ranking?.length) {
      setSelectedStatsPackageId('');
      return;
    }

    const stillAvailable = statsPayload.ranking.some((row) => row.packageId === selectedStatsPackageId);
    if (stillAvailable) {
      return;
    }

    setSelectedStatsPackageId(statsPayload.topPackage?.packageId || statsPayload.ranking[0]?.packageId || '');
  }, [statsPayload, selectedStatsPackageId]);

  const loadUsageDetails = useCallback(async (packageId) => {
    if (!packageId) {
      setUsageRows([]);
      setUsageError('');
      return;
    }

    setUsageLoading(true);
    setUsageError('');

    try {
      const payload = await fetchAdminAdPackageUsages(packageId);
      setUsageRows(Array.isArray(payload?.usages) ? payload.usages : []);
    } catch (error) {
      setUsageRows([]);
      setUsageError(error.response?.data?.message || 'Could not load usage details.');
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView !== VIEW_MODES.stats || !selectedStatsPackageId) {
      return;
    }

    loadUsageDetails(selectedStatsPackageId);
  }, [activeView, selectedStatsPackageId, loadUsageDetails]);

  const resetPackageForm = useCallback(() => {
    setEditingPackageId('');
    setFormState(buildInitialFormState());
  }, []);

  const handleNameChange = (event) => {
    setFormState((currentState) => ({
      ...currentState,
      name: event.target.value,
    }));
  };

  const handleTierSelect = (tierValue) => {
    setFormState((currentState) => ({
      ...currentState,
      tier: tierValue,
    }));
  };

  const handlePriceChange = (event) => {
    setFormState((currentState) => ({
      ...currentState,
      price: stripToDigits(event.target.value),
    }));
  };

  const handleDiscountPercentChange = (event) => {
    setFormState((currentState) => ({
      ...currentState,
      discountPercent: stripToDigits(event.target.value),
    }));
  };

  const handleDurationSelect = (months) => {
    setFormState((currentState) => ({
      ...currentState,
      durationMonths: Number(months),
    }));
  };

  const handleFeatureToggle = (featureKey) => {
    setFormState((currentState) => {
      const isCurrentOn = Boolean(currentState.features[featureKey]);
      const nextFeatures = {
        ...currentState.features,
        [featureKey]: !isCurrentOn,
      };

      return {
        ...currentState,
        features: nextFeatures,
      };
    });
  };

  const handlePostLimitChange = (event) => {
    setFormState((currentState) => ({
      ...currentState,
      features: {
        ...currentState.features,
        postLimit: event.target.value,
      },
    }));
  };

  const handleTrendPushLimitChange = (event) => {
    setFormState((currentState) => ({
      ...currentState,
      features: {
        ...currentState.features,
        trendPushLimit: event.target.value,
      },
    }));
  };

  const handleTrendDisplayHoursChange = (event) => {
    setFormState((currentState) => ({
      ...currentState,
      features: {
        ...currentState.features,
        trendDisplayHours: event.target.value,
      },
    }));
  };

  const handleCreatePackage = async (event) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const normalizedName = String(formState.name || '').trim();
    if (normalizedName.length < 3) {
      setFormError('Package name must contain at least 3 characters.');
      return;
    }

    if (formState.features.postLimitEnabled) {
      const postLimit = Number(formState.features.postLimit);
      if (!Number.isFinite(postLimit) || postLimit < 1) {
        setFormError('Post quantity limit must be a number greater than 0.');
        return;
      }
    }

    const price = Number.parseInt(stripToDigits(formState.price), 10);
    if (!Number.isFinite(price) || price < 1000) {
      setFormError('Package price must be at least 1,000 VND.');
      return;
    }

    const discountPercent = formState.discountPercent === '' ? 0 : Number.parseInt(stripToDigits(formState.discountPercent), 10);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 99) {
      setFormError('Discount percent must be between 0 and 99.');
      return;
    }

    if (calculateDiscountedPackagePrice(price, discountPercent) <= 0) {
      setFormError('Discounted package price must stay above 0 VND.');
      return;
    }

    if (formState.features.showInTrending) {
      const trendPushLimit = Number(formState.features.trendPushLimit);
      if (!Number.isFinite(trendPushLimit) || trendPushLimit < 1 || trendPushLimit > 1000) {
        setFormError('Trending pushes must be between 1 and 1000.');
        return;
      }

      const trendDisplayHours = Number(formState.features.trendDisplayHours);
      if (!Number.isFinite(trendDisplayHours) || trendDisplayHours < 1 || trendDisplayHours > 168) {
        setFormError('Trending display duration must be between 1 and 168 hours.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload = {
        name: normalizedName,
        tier: formState.tier,
        price,
        discountPercent,
        durationMonths: Number(formState.durationMonths),
        features: {
          ...formState.features,
          postLimit: Number(formState.features.postLimit),
          trendPushLimit: formState.features.showInTrending ? Number(formState.features.trendPushLimit) : null,
          trendDisplayHours: formState.features.showInTrending ? Number(formState.features.trendDisplayHours) : null,
        },
      };

      if (isEditMode) {
        const updatedPackage = await updateAdminAdPackage(editingPackageId, payload);
        setPackages((currentItems) =>
          currentItems.map((item) => (item.id === editingPackageId ? updatedPackage : item))
        );
        setSuccessMessage('Package updated successfully.');
      } else {
        const createdPackage = await createAdminAdPackage(payload);
        setPackages((currentItems) => [createdPackage, ...currentItems]);
        setSuccessMessage('Package created and ready for merchant usage.');
      }

      resetPackageForm();

      if (activeView === VIEW_MODES.stats) {
        loadStats();
      }
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          (isEditMode ? 'Could not update package right now. Please try again.' : 'Could not create package right now. Please try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEditPackage = (packageItem) => {
    setFormError('');
    setSuccessMessage('');
    setEditingPackageId(packageItem.id);
    setFormState(buildFormStateFromPackage(packageItem));
  };

  const handleCancelEditPackage = () => {
    resetPackageForm();
    setFormError('');
    setSuccessMessage('');
  };

  const handleRequestDeletePackage = (packageItem) => {
    setConfirmDeletePackage(packageItem);
  };

  const handleDeletePackage = async () => {
    if (!confirmDeletePackage?.id) {
      return;
    }

    const packageId = confirmDeletePackage.id;
    setDeletingPackageId(packageId);
    setFormError('');

    try {
      await deleteAdminAdPackage(packageId);
      setPackages((currentItems) => currentItems.filter((item) => item.id !== packageId));
      setSuccessMessage('Package removed.');

      if (editingPackageId === packageId) {
        resetPackageForm();
      }

      if (activeView === VIEW_MODES.stats) {
        loadStats();
      }

      setConfirmDeletePackage(null);
    } catch (error) {
      setFormError(error.response?.data?.message || 'Could not remove this package. Please try again.');
    } finally {
      setDeletingPackageId(null);
    }
  };

  const chartDatasets = useMemo(() => {
    const allDatasets = Array.isArray(statsPayload?.datasets) ? statsPayload.datasets : [];

    return allDatasets
      .slice()
      .sort((first, second) => {
        if (second.activeCount !== first.activeCount) {
          return second.activeCount - first.activeCount;
        }

        return second.monthlyTotal - first.monthlyTotal;
      })
      .slice(0, 4);
  }, [statsPayload]);

  const maxChartValue = useMemo(() => {
    const values = chartDatasets.flatMap((dataset) => dataset.values || []);
    const maxValue = Math.max(0, ...values);
    return maxValue || 1;
  }, [chartDatasets]);

  const topPackageMeta = useMemo(() => {
    if (!statsPayload?.topPackage?.packageId) {
      return null;
    }

    return statsPayload.datasets?.find((dataset) => dataset.packageId === statsPayload.topPackage.packageId) || null;
  }, [statsPayload]);

  const totalMonthlyEvents = useMemo(() => {
    return chartDatasets.reduce((total, dataset) => total + (Number(dataset.monthlyTotal) || 0), 0);
  }, [chartDatasets]);

  return (
    <section className="admin-packages-page">
      <header className="admin-packages-header">
        <div className="admin-packages-header-copy">
        <p className="admin-packages-kicker">{tx('Campaign control')}</p>
        <h2>{tx('Ad Packages')}</h2>
        <p>
            {tx('Create package rules for merchant advertising. This workspace remains separated from map moderation.')}
        </p>

          <div className="admin-packages-view-switch" role="tablist" aria-label="Ad package views">
            <button
              type="button"
              className={`admin-packages-view-btn ${activeView === VIEW_MODES.packages ? 'is-active' : ''}`.trim()}
              onClick={() => setActiveView(VIEW_MODES.packages)}
            >
              {tx('Packages')}
            </button>
            <button
              type="button"
              className={`admin-packages-view-btn ${activeView === VIEW_MODES.stats ? 'is-active' : ''}`.trim()}
              onClick={() => setActiveView(VIEW_MODES.stats)}
            >
              {tx('Statisticals')}
            </button>
          </div>
        </div>

        <span className="admin-packages-counter">{packageCounterText}</span>
      </header>

      {activeView === VIEW_MODES.packages ? (
      <div className="admin-packages-layout">
        <article className="admin-packages-panel">
          <h3>{isEditMode ? tx('Edit Package') : tx('Create a New Package')}</h3>
          <p className="admin-packages-panel-helper">
            {isEditMode
              ? 'Update package identity, active duration and campaign capabilities.'
              : 'Define package identity, tier color family and campaign behavior.'}
          </p>

          <form className="admin-package-form" onSubmit={handleCreatePackage}>
            <div className="admin-package-form-field">
              <label htmlFor="package-name">{tx('Package name')}</label>
              <input
                id="package-name"
                type="text"
                value={formState.name}
                onChange={handleNameChange}
                placeholder="Example: Weekend Premium Reach"
                maxLength={80}
              />
            </div>

            <div className="admin-package-form-field">
              <label>{tx('Package type')}</label>
              <div className="admin-package-tier-selector">
                {Object.values(PACKAGE_TIERS).map((tierItem) => (
                  <button
                    key={tierItem.value}
                    type="button"
                    className={`admin-package-chip ${formState.tier === tierItem.value ? 'is-active' : ''}`.trim()}
                    onClick={() => handleTierSelect(tierItem.value)}
                    style={{
                      '--tier-color': tierItem.color,
                      '--tier-soft': tierItem.accent,
                    }}
                  >
                    <strong>{tx(tierItem.label)}</strong>
                    <span>{tierItem.value === 'premium' ? tx('Gold') : tierItem.value === 'boosted' ? tx('Silver') : tx('Bronze')}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-package-form-field">
              <label>{tx('Activation duration')}</label>
              <div className="admin-package-duration-selector">
                {PACKAGE_DURATIONS.map((durationOption) => (
                  <button
                    key={durationOption.value}
                    type="button"
                    className={`admin-package-chip ${Number(formState.durationMonths) === Number(durationOption.value) ? 'is-active' : ''}`.trim()}
                    onClick={() => handleDurationSelect(durationOption.value)}
                  >
                    <strong>{tx(durationOption.label)}</strong>
                    <span>{durationOption.days} {tx('days')}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-package-form-field">
              <div className="admin-package-price-grid">
                <div>
                  <label htmlFor="package-price">{tx('Package price (VND)')}</label>
                  <input
                    id="package-price"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9.]*"
                    value={formatNumberInputValue(formState.price)}
                    onChange={handlePriceChange}
                    placeholder="Example: 1.500.000"
                  />
                  <p className="admin-package-field-hint">Minimum 1.000 VND. Digits only.</p>
                </div>

                <div>
                  <label htmlFor="package-discount-percent">{tx('Discount (%)')}</label>
                  <input
                    id="package-discount-percent"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={stripToDigits(formState.discountPercent)}
                    onChange={handleDiscountPercentChange}
                    placeholder="Example: 15"
                  />
                  <p className="admin-package-field-hint">Enter 0 to keep the original price.</p>
                </div>
              </div>
              <div className="admin-package-price-preview" aria-live="polite">
                <span>{tx('Discounted price')}</span>
                <strong>{discountedPreviewPrice > 0 ? formatCurrencyVnd(discountedPreviewPrice) : tx('N/A')}</strong>
              </div>
            </div>

            <div className="admin-package-form-field">
              <label>{tx('Package capabilities')}</label>
              <div className="admin-package-toggle-grid">
                {PACKAGE_FEATURES.map((featureItem) => {
                  const isEnabled = Boolean(formState.features[featureItem.key]);

                  return (
                    <div key={featureItem.key} className="admin-package-toggle">
                      <div className="admin-package-toggle-copy">
                        <strong>{tx(featureItem.label)}</strong>
                        <span>{tx(featureItem.description)}</span>
                      </div>

                      <button
                        type="button"
                        className={`admin-package-switch ${isEnabled ? 'is-on' : ''}`.trim()}
                        onClick={() => handleFeatureToggle(featureItem.key)}
                        aria-pressed={isEnabled}
                        aria-label={language === 'vi' ? `Bật/tắt ${tx(featureItem.label)}` : `Toggle ${featureItem.label}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {formState.features.postLimitEnabled ? (
              <div className="admin-package-limit-field">
                <label htmlFor="package-post-limit">{tx('Maximum promoted posts')}</label>
                <input
                  id="package-post-limit"
                  type="number"
                  min="1"
                  max="10000"
                  value={formState.features.postLimit}
                  onChange={handlePostLimitChange}
                />
              </div>
            ) : null}

            {formState.features.showInTrending ? (
              <div className="admin-package-limit-field admin-package-trend-field-grid">
                <div>
                  <label htmlFor="package-trend-push-limit">{tx('Number of pushes')}</label>
                  <input
                    id="package-trend-push-limit"
                    type="number"
                    min="1"
                    max="1000"
                    value={formState.features.trendPushLimit}
                    onChange={handleTrendPushLimitChange}
                  />
                </div>

                <div>
                  <label htmlFor="package-trend-display-hours">{tx('Display duration (hours)')}</label>
                  <input
                    id="package-trend-display-hours"
                    type="number"
                    min="1"
                    max="168"
                    value={formState.features.trendDisplayHours}
                    onChange={handleTrendDisplayHoursChange}
                  />
                </div>
              </div>
            ) : null}

            {formError ? <p className="admin-package-form-error">{formError}</p> : null}
            {successMessage ? <p className="admin-package-form-success">{successMessage}</p> : null}

            <div className="admin-package-form-actions">
              <button type="submit" className="admin-package-submit" disabled={submitting}>
                {submitting ? (isEditMode ? tx('Saving...') : tx('Creating...')) : isEditMode ? tx('Save changes') : tx('Create package')}
              </button>
              {isEditMode ? (
                <button type="button" className="admin-package-secondary-btn" onClick={handleCancelEditPackage}>
                  {tx('Cancel edit')}
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="admin-packages-panel">
          <h3>{tx('Created Packages')}</h3>
          <p className="admin-packages-panel-helper">
            These package definitions are available in merchant advertisement flow.
          </p>

          <div className="admin-packages-list">
            {loadingPackages ? (
              <p className="admin-package-empty">{tx('Loading packages...')}</p>
            ) : packages.length === 0 ? (
              <p className="admin-package-empty">{tx('No package yet. Create the first package to activate merchant advertising.')}</p>
            ) : (
              packages.map((packageItem) => {
                const tierMeta = getTierMeta(packageItem.tier);
                const durationMeta = getPackageDurationMeta(packageItem.durationMonths);
                const featureSummary = formatPackageFeatures(packageItem.features);
                const discountedPackagePrice = Number(packageItem.discountedPrice || packageItem.price || 0);
                const hasDiscount = Number(packageItem.discountPercent || 0) > 0 && discountedPackagePrice < Number(packageItem.price || 0);

                return (
                  <article
                    key={packageItem.id}
                    className="admin-package-card"
                    style={{
                      '--tier-color': tierMeta.color,
                      '--tier-soft': tierMeta.accent,
                    }}
                  >
                    <div className="admin-package-card-head">
                      <div>
                        <strong>{packageItem.name}</strong>
                        <span>
                          {tx(durationMeta.label)} ({durationMeta.days} {tx('days')})
                        </span>
                        <span className="admin-package-price-label">{formatCurrencyVnd(discountedPackagePrice)}</span>
                        {hasDiscount ? (
                          <span className="admin-package-price-subtitle">
                            {formatCurrencyVnd(packageItem.price)} before discount ({packageItem.discountPercent}% off)
                          </span>
                        ) : null}
                      </div>

                      <span className="admin-package-tier-badge">{tx(tierMeta.label)}</span>
                    </div>

                    <div className="admin-package-card-body">
                      <ul className="admin-package-feature-list">
                        {featureSummary.map((featureLabel) => (
                          <li key={`${packageItem.id}-${featureLabel}`}>{tx(featureLabel)}</li>
                        ))}
                      </ul>

                      <div className="admin-package-card-meta">
                        <span>{tx('Created:')} {formatCreatedAt(packageItem.createdAt)}</span>

                        <div className="admin-package-card-actions">
                          <button
                            type="button"
                            className="admin-package-card-edit"
                            onClick={() => handleStartEditPackage(packageItem)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="admin-package-card-delete"
                            disabled={deletingPackageId === packageItem.id}
                            onClick={() => handleRequestDeletePackage(packageItem)}
                          >
                            {deletingPackageId === packageItem.id ? tx('Removing...') : tx('Delete')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </article>
      </div>
      ) : null}

      {activeView === VIEW_MODES.stats ? (
        <div className="admin-packages-stats-layout">
          <article className="admin-packages-panel admin-stats-overview-panel">
            <div className="admin-stats-head">
              <h3>{tx('Package Performance Dashboard')}</h3>
              <div className="admin-stats-range-switch">
                {STATS_MONTH_OPTIONS.map((monthOption) => (
                  <button
                    key={monthOption}
                    type="button"
                    className={`admin-stats-range-btn ${statsMonthWindow === monthOption ? 'is-active' : ''}`.trim()}
                    onClick={() => setStatsMonthWindow(monthOption)}
                  >
                    {monthOption} months
                  </button>
                ))}
              </div>
            </div>

            {statsLoading ? <p className="admin-package-empty">{tx('Loading statistics...')}</p> : null}
            {!statsLoading && statsError ? (
              <div className="admin-package-empty">
                <p>{statsError}</p>
                <button type="button" className="admin-package-secondary-btn" onClick={loadStats}>
                  {tx('Retry')}
                </button>
              </div>
            ) : null}

            {!statsLoading && !statsError ? (
              <>
                <div className="admin-stats-kpis">
                  <div className="admin-stats-kpi-card">
                    <span>{tx('Most used package')}</span>
                    <strong>{topPackageMeta?.packageName || 'No data yet'}</strong>
                    <em>{formatUsageCount(topPackageMeta?.activeCount || 0)} {tx('active assignments')}</em>
                  </div>
                  <div className="admin-stats-kpi-card">
                    <span>{tx('Active assignments')}</span>
                    <strong>{formatUsageCount(statsPayload?.totalActiveAssignments || 0)}</strong>
                    <em>Currently linked venue campaigns</em>
                  </div>
                  <div className="admin-stats-kpi-card">
                    <span>Monthly assignment events</span>
                    <strong>{formatUsageCount(totalMonthlyEvents)}</strong>
                    <em>In the last {statsMonthWindow} months</em>
                  </div>
                </div>

                <div className="admin-stats-chart-panel">
                  <div className="admin-stats-chart-grid">
                    {(statsPayload?.months || []).map((monthKey, monthIndex) => (
                      <div key={monthKey} className="admin-stats-chart-column">
                        <div className="admin-stats-chart-bars">
                          {chartDatasets.map((dataset) => {
                            const value = Number(dataset.values?.[monthIndex]) || 0;
                            const heightPercent = Math.max(6, Math.round((value / maxChartValue) * 100));
                            const tierMeta = getTierMeta(dataset.tier);

                            return (
                              <button
                                key={`${dataset.packageId}-${monthKey}`}
                                type="button"
                                className={`admin-stats-chart-bar ${selectedStatsPackageId === dataset.packageId ? 'is-selected' : ''}`.trim()}
                                style={{
                                  '--bar-color': tierMeta.color,
                                  height: `${heightPercent}%`,
                                }}
                                title={`${dataset.packageName}: ${formatUsageCount(value)} (${formatMonthLabel(monthKey)})`}
                                onClick={() => setSelectedStatsPackageId(dataset.packageId)}
                              >
                                <span>{value}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p>{formatMonthLabel(monthKey)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="admin-stats-legend">
                    {chartDatasets.map((dataset) => {
                      const tierMeta = getTierMeta(dataset.tier);
                      return (
                        <button
                          key={`legend-${dataset.packageId}`}
                          type="button"
                          className={`admin-stats-legend-item ${selectedStatsPackageId === dataset.packageId ? 'is-selected' : ''}`.trim()}
                          onClick={() => setSelectedStatsPackageId(dataset.packageId)}
                        >
                          <span style={{ backgroundColor: tierMeta.color }} />
                          {dataset.packageName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </article>

          <article className="admin-packages-panel admin-stats-usage-panel">
            <h3>{tx('Package Usage Details')}</h3>
            <p className="admin-packages-panel-helper">
              Click any package in ranking or chart to inspect venues and users currently linked to it.
            </p>

            {!statsLoading && !statsError ? (
              <div className="admin-stats-ranking-list">
                {(statsPayload?.ranking || []).map((row) => (
                  <button
                    key={`ranking-${row.packageId}`}
                    type="button"
                    className={`admin-stats-ranking-item ${selectedStatsPackageId === row.packageId ? 'is-active' : ''}`.trim()}
                    onClick={() => setSelectedStatsPackageId(row.packageId)}
                  >
                    <strong>{row.packageName}</strong>
                    <span>{formatUsageCount(row.activeCount)} active</span>
                    <em>{formatUsageCount(row.monthlyTotal)} {tx('events in selected window')}</em>
                  </button>
                ))}
              </div>
            ) : null}

            {usageLoading ? <p className="admin-package-empty">{tx('Loading package usage details...')}</p> : null}
            {!usageLoading && usageError ? <p className="admin-package-empty">{usageError}</p> : null}
            {!usageLoading && !usageError && !usageRows.length ? (
              <p className="admin-package-empty">No venue has actively selected this package yet.</p>
            ) : null}

            {!usageLoading && !usageError && usageRows.length ? (
              <div className="admin-stats-usage-table-wrap">
                <table className="admin-stats-usage-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Venue</th>
                      <th>Address</th>
                      <th>{tx('Assigned at')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageRows.map((usageRow) => (
                      <tr key={usageRow.assignmentId}>
                        <td>
                          <strong>{usageRow.user?.name || tx('Unknown user')}</strong>
                          <span>{usageRow.user?.email || tx('No email')}</span>
                        </td>
                        <td>{usageRow.venue?.name || tx('Unknown venue')}</td>
                        <td>{usageRow.venue?.address || tx('N/A')}</td>
                        <td>{formatUsageDate(usageRow.assignedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>
        </div>
      ) : null}

      {confirmDeletePackage ? (
        <div className="admin-package-confirm-overlay" role="dialog" aria-modal="true">
          <div className="admin-package-confirm-modal">
            <h3>{tx('Delete package?')}</h3>
            <p>
              This action will archive <strong>{confirmDeletePackage.name}</strong> from the active package list.
            </p>

            <div className="admin-package-confirm-actions">
              <button
                type="button"
                className="admin-package-secondary-btn"
                onClick={() => setConfirmDeletePackage(null)}
                disabled={deletingPackageId === confirmDeletePackage.id}
              >
                {tx('Cancel')}
              </button>
              <button
                type="button"
                className="admin-package-danger-btn"
                onClick={handleDeletePackage}
                disabled={deletingPackageId === confirmDeletePackage.id}
              >
                {deletingPackageId === confirmDeletePackage.id ? tx('Deleting...') : tx('Confirm delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AdminAdPackagesPage;
