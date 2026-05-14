import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import translations from '../../constants/translations';
import { APP_ROUTES } from '../../constants/routes';
import useUserI18n from '../../hooks/useUserI18n';
import {
  fetchMerchantTrendingOverview,
  pushMerchantTrendingVenue,
} from '../../services/api/adPackagesApi';
import './MerchantDashboard.css';

const MenuItems = [
  { id: 'overview', icon: '🏠', translationKey: 'overview' },
  { id: 'posts', icon: '🏪', translationKey: 'posts' },
  { id: 'transactions', icon: '📊', translationKey: 'transactions' },
  { id: 'support', icon: '💬', translationKey: 'support' }
];

const DEFAULT_CHART_DAYS = 7;

function formatDateTime(value, locale = 'en-US', tx = (text) => text) {
  if (!value) {
    return tx('N/A');
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return tx('N/A');
  }

  return parsed.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateKeyLabel(value, locale = 'en-US') {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '0.00%';
  }

  return `${numeric.toFixed(2)}%`;
}

function buildPushHistoryLabel(entry, fallbackIndex = 0) {
  const pushNumber = Number(entry?.pushNumber) || fallbackIndex + 1;
  const pushedAtText = formatDateTime(entry?.pushedAt);
  return `Push #${pushNumber} · ${pushedAtText}`;
}

function buildLocalizedPushHistoryLabel(entry, locale, tx, fallbackIndex = 0) {
  const pushNumber = Number(entry?.pushNumber) || fallbackIndex + 1;
  const pushedAtText = formatDateTime(entry?.pushedAt, locale, tx);
  return `${tx('Push cycle')} #${pushNumber} · ${pushedAtText}`;
}

function MerchantDashboardPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { locale, tx } = useUserI18n();
  const { user, logout } = useAuth();
  const t = translations[language] || translations.en;
  const [activeMenu, setActiveMenu] = useState('overview');
  const [overviewPayload, setOverviewPayload] = useState({
    summary: {},
    days: DEFAULT_CHART_DAYS,
    dateKeys: [],
    items: [],
  });
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [pushingVenueId, setPushingVenueId] = useState('');
  const [selectedPushHistoryIdByAssignment, setSelectedPushHistoryIdByAssignment] = useState({});
  const [expandedPushHistoryByAssignment, setExpandedPushHistoryByAssignment] = useState({});

  const loadAdvertisingOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError('');

    try {
      const payload = await fetchMerchantTrendingOverview(DEFAULT_CHART_DAYS);
      setOverviewPayload({
        summary: payload?.summary || {},
        days: Number(payload?.days) || DEFAULT_CHART_DAYS,
        dateKeys: Array.isArray(payload?.dateKeys) ? payload.dateKeys : [],
        items: Array.isArray(payload?.items) ? payload.items : [],
      });
    } catch (error) {
      setOverviewError(error?.response?.data?.message || tx('Unable to load advertising overview right now.'));
      setOverviewPayload({
        summary: {},
        days: DEFAULT_CHART_DAYS,
        dateKeys: [],
        items: [],
      });
    } finally {
      setOverviewLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    if (activeMenu === 'overview') {
      loadAdvertisingOverview();
    }
  }, [activeMenu, loadAdvertisingOverview]);

  const overviewItems = useMemo(
    () => (Array.isArray(overviewPayload?.items) ? overviewPayload.items : []),
    [overviewPayload]
  );

  const dashboardSummary = useMemo(() => {
    return overviewItems.reduce(
      (summary, item) => {
        const stats = item?.stats || {};
        summary.coveredVenues += 1;
        summary.trendingEligible += item?.supportsTrending ? 1 : 0;
        summary.totalPushes += Number(stats.pushCountUsed) || 0;
        summary.totalClicks += Number(stats.totalClicks) || 0;
        summary.totalImpressions += Number(stats.totalImpressions) || 0;
        return summary;
      },
      {
        coveredVenues: 0,
        trendingEligible: 0,
        totalPushes: 0,
        totalClicks: 0,
        totalImpressions: 0,
      }
    );
  }, [overviewItems]);

  const overallCtrPercent = useMemo(() => {
    if (!dashboardSummary.totalImpressions) {
      return 0;
    }

    return (dashboardSummary.totalClicks / dashboardSummary.totalImpressions) * 100;
  }, [dashboardSummary.totalClicks, dashboardSummary.totalImpressions]);

  const summaryCards = useMemo(
    () => [
      {
        label: tx('Covered venues'),
        value: Number(overviewPayload?.summary?.coveredVenueCount) || dashboardSummary.coveredVenues,
      },
      {
        label: tx('Trending ready'),
        value: Number(overviewPayload?.summary?.trendingEligibleVenueCount) || dashboardSummary.trendingEligible,
      },
      {
        label: tx('Total pushes'),
        value: dashboardSummary.totalPushes,
      },
      {
        label: tx('Total clicks'),
        value: dashboardSummary.totalClicks,
      },
    ],
    [dashboardSummary, overviewPayload, tx]
  );

  const getUserInitial = () => {
    if (user?.fullname) {
      return user.fullname.charAt(0).toUpperCase();
    }
    return 'H';
  };

  const handleLogout = () => {
    logout();
    navigate(APP_ROUTES.LOGIN);
  };

  const handlePublishClick = () => {
    navigate(APP_ROUTES.MERCHANT_WORKBENCH);
  };

  const handleAdvertiseAccount = () => {
    navigate(APP_ROUTES.MERCHANT_POST_ADVERTISE);
  };

  const handleMenuClick = (menuId) => {
    setActiveMenu(menuId);

    if (menuId === 'posts') {
      navigate(APP_ROUTES.MERCHANT_POSTS);
    } else if (menuId === 'transactions') {
      navigate(APP_ROUTES.MERCHANT_TRANSACTIONS);
    } else if (menuId === 'support') {
      navigate(APP_ROUTES.FEEDBACK);
    } else if (menuId === 'overview') {
      navigate(APP_ROUTES.MERCHANT_DASHBOARD);
    }
  };

  const handlePushTrend = async (item) => {
    const venueId = item?.venue?.id;
    const trendState = item?.trendState || {};

    if (!venueId || !item?.supportsTrending) {
      return;
    }

    if (trendState.isAdvertising || trendState.isCoolingDown) {
      const nextPushAtText = trendState.nextPushAt
        ? formatDateTime(trendState.nextPushAt, locale, tx)
        : tx('later');
      setActionMessage(tx('This venue cannot be pushed now. Next push time: {{time}}.', { time: nextPushAtText }));
      return;
    }

    if ((Number(trendState.pushesRemaining) || 0) <= 0) {
      setActionMessage(tx('This venue has no push credits remaining in the current account package.'));
      return;
    }

    setActionMessage('');
    setPushingVenueId(String(venueId));

    try {
      await pushMerchantTrendingVenue(venueId);
      setActionMessage(tx('Push started successfully. The venue is now active in Trending.'));
      setExpandedPushHistoryByAssignment((currentState) => ({
        ...currentState,
        [String(item.assignmentId)]: true,
      }));
      await loadAdvertisingOverview();
    } catch (error) {
      setActionMessage(error?.response?.data?.message || tx('Unable to push this venue right now.'));
    } finally {
      setPushingVenueId('');
    }
  };

  const renderOverviewContent = () => {
    if (overviewLoading) {
      return (
        <div className="merchant-dashboard-content">
          <h2>{tx('Advertising Overview')}</h2>
          <p>{tx('Loading account coverage and venue analytics...')}</p>
        </div>
      );
    }

    if (overviewError) {
      return (
        <div className="merchant-dashboard-content">
          <h2>{tx('Advertising Overview')}</h2>
          <p>{overviewError}</p>
          <button type="button" className="merchant-publish-btn" onClick={loadAdvertisingOverview}>
            {tx('Retry')}
          </button>
        </div>
      );
    }

    return (
      <div className="merchant-dashboard-content merchant-trend-overview">
        <div className="merchant-trend-header">
          <div>
            <p className="merchant-trend-kicker">{tx('Account-wide advertising')}</p>
            <h2>{tx('Advertising Overview')}</h2>
            <p>{tx('Track package coverage, venue clicks, and trending push activity for your whole merchant account.')}</p>
          </div>

          <div className="merchant-trend-header-actions">
            <div className="merchant-trend-package-chip">
              <span>{tx('Current package')}</span>
              <strong>{overviewPayload?.summary?.activePackage?.name || tx('No active package')}</strong>
            </div>

            <button type="button" className="merchant-publish-btn" onClick={loadAdvertisingOverview}>
              {tx('Refresh')}
            </button>
          </div>
        </div>

        <div className="merchant-trend-summary-grid">
          {summaryCards.map((card) => (
            <article key={card.label} className="merchant-trend-summary-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>

        <div className="merchant-trend-account-strip">
          <p>
            <strong>{tx('Overall CTR:')}</strong> {formatPercent(overallCtrPercent)}
          </p>
          <p>
            <strong>{tx('Scope:')}</strong> {tx('All current and future venues in this merchant account use the active package.')}
          </p>
        </div>

        {actionMessage ? <p className="merchant-trend-action-message">{actionMessage}</p> : null}

        {!overviewItems.length ? (
          <div className="merchant-trend-empty-copy">
            <p>{tx('No venue is covered yet. Purchase an advertising package from Manage Posts to activate account-wide coverage.')}</p>
          </div>
        ) : (
          <div className="merchant-trend-list">
            {overviewItems.map((item) => {
              const venueId = String(item?.venue?.id || '');
              const assignmentId = String(item?.assignmentId || '');
              const trendState = item?.trendState || {};
              const stats = item?.stats || {};
              const chartRows = Array.isArray(stats.chart) ? stats.chart : [];
              const pushHistoryRows = Array.isArray(item?.pushHistory) ? item.pushHistory : [];
              const selectedPushHistoryId = selectedPushHistoryIdByAssignment[assignmentId]
                || pushHistoryRows[0]?.id
                || '';
              const selectedPushHistory = pushHistoryRows.find((entry) => String(entry?.id || '') === String(selectedPushHistoryId))
                || pushHistoryRows[0]
                || null;
              const isPushHistoryOpen = Boolean(expandedPushHistoryByAssignment[assignmentId]);
              const maxChartClicks = Math.max(1, ...chartRows.map((row) => Number(row?.clicks) || 0));
              const canPush = item?.supportsTrending
                && !trendState.isAdvertising
                && !trendState.isCoolingDown
                && (Number(trendState.pushesRemaining) || 0) > 0;
              const pushButtonLabel = trendState.isAdvertising
                ? tx('Advertising...')
                : trendState.isCoolingDown
                  ? tx('Cooling down')
                  : (Number(trendState.pushesRemaining) || 0) <= 0
                    ? tx('No pushes left')
                    : tx('Push to Trending');

              return (
                <article key={assignmentId} className="merchant-trend-item-card">
                  <div className="merchant-trend-item-head">
                    <div>
                      <div className="merchant-trend-item-title-row">
                        <h3>{item?.venue?.name || tx('Untitled venue')}</h3>
                        <span className={`merchant-trend-status-pill ${item?.supportsTrending ? 'is-trending' : 'is-standard'}`}>
                          {item?.supportsTrending ? tx('Trending enabled') : tx('Click analytics only')}
                        </span>
                      </div>
                      <p>{item?.venue?.address || tx('No address')}</p>
                    </div>

                    <span className="merchant-trend-item-tier">{item?.package?.tier || 'basic'}</span>
                  </div>

                  <div className="merchant-trend-item-meta-grid">
                    <p><strong>{tx('Package:')}</strong> {item?.package?.name || tx('No package')}</p>
                    <p><strong>{tx('Duration:')}</strong> {Number(item?.package?.durationDays || 0)} {tx('day(s)')}</p>
                    <p><strong>{tx('Total clicks:')}</strong> {Number(stats.totalClicks) || 0}</p>
                    <p><strong>{tx('CTR:')}</strong> {formatPercent(stats.ctrPercent || 0)}</p>
                    {item?.supportsTrending ? (
                      <>
                        <p><strong>{tx('Pushes used:')}</strong> {Number(trendState.pushCountUsed) || 0} / {Number(item?.trendConfig?.pushLimit) || 0}</p>
                        <p><strong>{tx('Pushes remaining:')}</strong> {Number(trendState.pushesRemaining) || 0}</p>
                        <p><strong>{tx('Display duration:')}</strong> {Number(item?.trendConfig?.displayHours) || 0} {tx('hour(s)')}</p>
                        <p><strong>{tx('Active until:')}</strong> {formatDateTime(trendState.activeUntil, locale, tx)}</p>
                        <p><strong>{tx('Next push:')}</strong> {formatDateTime(trendState.nextPushAt, locale, tx)}</p>
                        <p><strong>{tx('Current status:')}</strong> {trendState.isAdvertising ? tx('Advertising') : trendState.isCoolingDown ? tx('Cooling down') : tx('Ready')}</p>
                      </>
                    ) : (
                      <>
                        <p><strong>{tx('Trending access:')}</strong> {tx('Not included in this package')}</p>
                        <p><strong>{tx('Push analytics:')}</strong> {tx('Hidden for non-trending packages')}</p>
                      </>
                    )}
                  </div>

                  <div className="merchant-trend-item-actions">
                    {item?.supportsTrending ? (
                      <>
                        <button
                          type="button"
                          className="merchant-trend-push-btn"
                          disabled={pushingVenueId === venueId || !canPush}
                          onClick={() => handlePushTrend(item)}
                        >
                          {pushingVenueId === venueId ? tx('Pushing...') : pushButtonLabel}
                        </button>

                        <button
                          type="button"
                          className="merchant-trend-history-toggle-btn"
                          disabled={!pushHistoryRows.length}
                          onClick={() => {
                            setExpandedPushHistoryByAssignment((currentState) => ({
                              ...currentState,
                              [assignmentId]: !currentState[assignmentId],
                            }));
                          }}
                        >
                          {pushHistoryRows.length
                            ? (isPushHistoryOpen ? tx('Hide Push Statistics') : tx('View Push Statistics'))
                            : tx('No Push Statistics')}
                        </button>
                      </>
                    ) : (
                      <p className="merchant-trend-mode-note">
                        {tx('This venue uses the account package, but push controls are hidden because Show in Trending is not enabled.')}
                      </p>
                    )}
                  </div>

                  {item?.supportsTrending && isPushHistoryOpen && pushHistoryRows.length ? (
                    <div className="merchant-trend-history-panel">
                      <div className="merchant-trend-history-head">
                        <div>
                          <h4>{tx('Push Statistics')}</h4>
                          <p>{tx('Select one push cycle to review timing and click results.')}</p>
                        </div>

                        <label className="merchant-trend-history-select-wrap">
                          <span>{tx('Push cycle')}</span>
                          <select
                            value={selectedPushHistoryId}
                            onChange={(event) => {
                              const nextHistoryId = event.target.value;
                              setSelectedPushHistoryIdByAssignment((currentState) => ({
                                ...currentState,
                                [assignmentId]: nextHistoryId,
                              }));
                            }}
                          >
                            {pushHistoryRows.map((entry, index) => (
                              <option key={entry.id || `push-history-${assignmentId}-${index + 1}`} value={entry.id}>
                                {buildLocalizedPushHistoryLabel(entry, locale, tx, index)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {selectedPushHistory ? (
                        <div className="merchant-trend-history-card">
                          <p><strong>{tx('Push slot:')}</strong> {buildLocalizedPushHistoryLabel(selectedPushHistory, locale, tx)}</p>
                          <p><strong>{tx('Advertising until:')}</strong> {formatDateTime(selectedPushHistory.activeUntil, locale, tx)}</p>
                          <p><strong>{tx('Cooldown until:')}</strong> {formatDateTime(selectedPushHistory.cooldownUntil, locale, tx)}</p>
                          <p><strong>{tx('Clicks in this push:')}</strong> {Number(selectedPushHistory.clickCount) || 0}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="merchant-trend-chart">
                    <div className="merchant-trend-chart-head">
                      <h4>{tx('Click Trend')} ({overviewPayload.days} {tx('days')})</h4>
                      {!item?.supportsTrending ? (
                        <span>{tx('Push metrics unavailable')}</span>
                      ) : null}
                    </div>

                    {!chartRows.length ? (
                      <p className="merchant-trend-chart-empty">{tx('No click analytics data yet.')}</p>
                    ) : (
                      chartRows.map((row) => {
                        const clicks = Number(row?.clicks) || 0;
                        const barWidth = Math.max(6, Math.round((clicks / maxChartClicks) * 100));

                        return (
                          <div key={`${assignmentId}-${row.date}`} className="merchant-trend-chart-row">
                            <span>{formatDateKeyLabel(row.date, locale)}</span>
                            <div className="merchant-trend-chart-track">
                              <div className="merchant-trend-chart-bar" style={{ width: `${barWidth}%` }} />
                            </div>
                            <span>{clicks} {tx('clicks')} | {formatPercent(row.ctrPercent || 0)}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="merchant-dashboard-container">
      <div className="merchant-shell">
        <aside className="merchant-sidebar">
          <div data-onboarding="merchant-sidebar">
            <div className="merchant-sidebar-header">
              <div className="merchant-user-info">
                <div className="merchant-user-avatar">{getUserInitial()}</div>
                <div className="merchant-user-details">
                  <h3>{user?.fullname || tx('Merchant account')}</h3>
                  <p>{tx('Merchant')}</p>
                </div>
              </div>
            </div>

            <div className="merchant-primary-actions" data-onboarding="merchant-publish-button">
              <button
                className="merchant-publish-btn merchant-primary-action-btn"
                onClick={handlePublishClick}
              >
                {t.merchant.publish}
              </button>
              <button
                type="button"
                className="merchant-advertise-btn merchant-primary-action-btn"
                onClick={handleAdvertiseAccount}
              >
                {tx('Advertise')}
              </button>
            </div>

            <nav className="merchant-menu" data-onboarding="merchant-menu">
              {MenuItems.map((item) => (
                <button
                  key={item.id}
                  className={`merchant-menu-item ${activeMenu === item.id ? 'active' : ''}`}
                  onClick={() => handleMenuClick(item.id)}
                >
                  <span className="merchant-menu-icon">{item.icon}</span>
                  <span className="merchant-menu-label">{t.merchant[item.translationKey]}</span>
                </button>
              ))}
            </nav>

            <div className="merchant-sidebar-footer">
              <button className="merchant-logout-btn" onClick={handleLogout}>{t.merchant.logout}</button>
            </div>
          </div>
        </aside>

        <main className="merchant-main-content">
          {renderOverviewContent()}
        </main>
      </div>
    </div>
  );
}

export default MerchantDashboardPage;
