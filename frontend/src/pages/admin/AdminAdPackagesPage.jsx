import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  showOnHomepageBanner: false,
  priorityReview: false,
  postLimitEnabled: false,
  postLimit: 10,
};

function buildInitialFormState() {
  return {
    name: '',
    tier: PACKAGE_TIERS.premium.value,
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
    durationMonths: Number(packageItem.durationMonths) || PACKAGE_DURATIONS[0].value,
    features: {
      ...DEFAULT_FEATURES,
      ...(packageItem.features || {}),
      postLimit: Number(packageItem.features?.postLimit || DEFAULT_FEATURES.postLimit),
    },
  };
}

function formatPackageFeatures(features = {}) {
  const enabledFeatures = [];

  if (features.showInTrending) {
    enabledFeatures.push('Shown in Trending section');
  }

  if (features.showOnHomepageBanner) {
    enabledFeatures.push('Shown on Homepage Banner');
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

    setSubmitting(true);

    try {
      const payload = {
        name: normalizedName,
        tier: formState.tier,
        durationMonths: Number(formState.durationMonths),
        features: {
          ...formState.features,
          postLimit: Number(formState.features.postLimit),
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
          <p className="admin-packages-kicker">Campaign control</p>
          <h2>Ad Packages</h2>
          <p>
            Create package rules for merchant advertising. This workspace remains separated from map moderation.
          </p>

          <div className="admin-packages-view-switch" role="tablist" aria-label="Ad package views">
            <button
              type="button"
              className={`admin-packages-view-btn ${activeView === VIEW_MODES.packages ? 'is-active' : ''}`.trim()}
              onClick={() => setActiveView(VIEW_MODES.packages)}
            >
              Packages
            </button>
            <button
              type="button"
              className={`admin-packages-view-btn ${activeView === VIEW_MODES.stats ? 'is-active' : ''}`.trim()}
              onClick={() => setActiveView(VIEW_MODES.stats)}
            >
              Statisticals
            </button>
          </div>
        </div>

        <span className="admin-packages-counter">{packageCounterText}</span>
      </header>

      {activeView === VIEW_MODES.packages ? (
      <div className="admin-packages-layout">
        <article className="admin-packages-panel">
          <h3>{isEditMode ? 'Edit Package' : 'Create a New Package'}</h3>
          <p className="admin-packages-panel-helper">
            {isEditMode
              ? 'Update package identity, active duration and campaign capabilities.'
              : 'Define package identity, tier color family and campaign behavior.'}
          </p>

          <form className="admin-package-form" onSubmit={handleCreatePackage}>
            <div className="admin-package-form-field">
              <label htmlFor="package-name">Package name</label>
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
              <label>Package type</label>
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
                    <strong>{tierItem.label}</strong>
                    <span>{tierItem.value === 'premium' ? 'Gold' : tierItem.value === 'boosted' ? 'Silver' : 'Bronze'}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-package-form-field">
              <label>Activation duration</label>
              <div className="admin-package-duration-selector">
                {PACKAGE_DURATIONS.map((durationOption) => (
                  <button
                    key={durationOption.value}
                    type="button"
                    className={`admin-package-chip ${Number(formState.durationMonths) === Number(durationOption.value) ? 'is-active' : ''}`.trim()}
                    onClick={() => handleDurationSelect(durationOption.value)}
                  >
                    <strong>{durationOption.label}</strong>
                    <span>{durationOption.days} days</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-package-form-field">
              <label>Package capabilities</label>
              <div className="admin-package-toggle-grid">
                {PACKAGE_FEATURES.map((featureItem) => {
                  const isEnabled = Boolean(formState.features[featureItem.key]);

                  return (
                    <div key={featureItem.key} className="admin-package-toggle">
                      <div className="admin-package-toggle-copy">
                        <strong>{featureItem.label}</strong>
                        <span>{featureItem.description}</span>
                      </div>

                      <button
                        type="button"
                        className={`admin-package-switch ${isEnabled ? 'is-on' : ''}`.trim()}
                        onClick={() => handleFeatureToggle(featureItem.key)}
                        aria-pressed={isEnabled}
                        aria-label={`Toggle ${featureItem.label}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {formState.features.postLimitEnabled ? (
              <div className="admin-package-limit-field">
                <label htmlFor="package-post-limit">Maximum promoted posts</label>
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

            {formError ? <p className="admin-package-form-error">{formError}</p> : null}
            {successMessage ? <p className="admin-package-form-success">{successMessage}</p> : null}

            <div className="admin-package-form-actions">
              <button type="submit" className="admin-package-submit" disabled={submitting}>
                {submitting ? (isEditMode ? 'Saving...' : 'Creating...') : isEditMode ? 'Save changes' : 'Create package'}
              </button>
              {isEditMode ? (
                <button type="button" className="admin-package-secondary-btn" onClick={handleCancelEditPackage}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="admin-packages-panel">
          <h3>Created Packages</h3>
          <p className="admin-packages-panel-helper">
            These package definitions are available in merchant advertisement flow.
          </p>

          <div className="admin-packages-list">
            {loadingPackages ? (
              <p className="admin-package-empty">Loading packages...</p>
            ) : packages.length === 0 ? (
              <p className="admin-package-empty">No package yet. Create the first package to activate merchant advertising.</p>
            ) : (
              packages.map((packageItem) => {
                const tierMeta = getTierMeta(packageItem.tier);
                const durationMeta = getPackageDurationMeta(packageItem.durationMonths);
                const featureSummary = formatPackageFeatures(packageItem.features);

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
                          {durationMeta.label} ({durationMeta.days} days)
                        </span>
                      </div>

                      <span className="admin-package-tier-badge">{tierMeta.label}</span>
                    </div>

                    <div className="admin-package-card-body">
                      <ul className="admin-package-feature-list">
                        {featureSummary.map((featureLabel) => (
                          <li key={`${packageItem.id}-${featureLabel}`}>{featureLabel}</li>
                        ))}
                      </ul>

                      <div className="admin-package-card-meta">
                        <span>Created: {formatCreatedAt(packageItem.createdAt)}</span>

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
                            {deletingPackageId === packageItem.id ? 'Removing...' : 'Delete'}
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
              <h3>Package Performance Dashboard</h3>
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

            {statsLoading ? <p className="admin-package-empty">Loading statistics...</p> : null}
            {!statsLoading && statsError ? (
              <div className="admin-package-empty">
                <p>{statsError}</p>
                <button type="button" className="admin-package-secondary-btn" onClick={loadStats}>
                  Retry
                </button>
              </div>
            ) : null}

            {!statsLoading && !statsError ? (
              <>
                <div className="admin-stats-kpis">
                  <div className="admin-stats-kpi-card">
                    <span>Most used package</span>
                    <strong>{topPackageMeta?.packageName || 'No data yet'}</strong>
                    <em>{formatUsageCount(topPackageMeta?.activeCount || 0)} active assignments</em>
                  </div>
                  <div className="admin-stats-kpi-card">
                    <span>Active assignments</span>
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
            <h3>Package Usage Details</h3>
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
                    <em>{formatUsageCount(row.monthlyTotal)} events in selected window</em>
                  </button>
                ))}
              </div>
            ) : null}

            {usageLoading ? <p className="admin-package-empty">Loading package usage details...</p> : null}
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
                      <th>Assigned at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageRows.map((usageRow) => (
                      <tr key={usageRow.assignmentId}>
                        <td>
                          <strong>{usageRow.user?.name || 'Unknown user'}</strong>
                          <span>{usageRow.user?.email || 'No email'}</span>
                        </td>
                        <td>{usageRow.venue?.name || 'Unknown venue'}</td>
                        <td>{usageRow.venue?.address || 'N/A'}</td>
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
            <h3>Delete package?</h3>
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
                Cancel
              </button>
              <button
                type="button"
                className="admin-package-danger-btn"
                onClick={handleDeletePackage}
                disabled={deletingPackageId === confirmDeletePackage.id}
              >
                {deletingPackageId === confirmDeletePackage.id ? 'Deleting...' : 'Confirm delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AdminAdPackagesPage;
