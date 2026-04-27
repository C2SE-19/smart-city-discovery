import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAdminDashboardOverview } from '../../services/api/adPackagesApi';
import { formatCurrencyVnd } from '../../services/adPackageStorage';
import './AdminDashboardPage.css';

const MONTH_OPTIONS = [3, 6, 12];
const PIE_COLORS = ['#2f66dc', '#23a27b', '#f28c28', '#d94a5a', '#7c5de2', '#18a3b7'];

function formatCompactNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function formatMonthLabel(monthKey) {
  const [yearRaw, monthRaw] = String(monthKey || '').split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey || 'N/A';
  }

  const parsed = new Date(Date.UTC(year, month - 1, 1));
  return parsed.toLocaleDateString('en-US', { month: 'short' });
}

function formatDelta(deltaValue) {
  const value = Number(deltaValue || 0);
  if (value > 0) {
    return `+${value.toFixed(1)}%`;
  }
  if (value < 0) {
    return `${value.toFixed(1)}%`;
  }
  return '0.0%';
}

function getDeltaTone(deltaValue) {
  const value = Number(deltaValue || 0);
  if (value > 0) {
    return 'positive';
  }
  if (value < 0) {
    return 'negative';
  }
  return 'neutral';
}

function buildPieGradient(series) {
  const rows = Array.isArray(series) ? series : [];
  const total = rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);

  if (!total) {
    return 'conic-gradient(#d9dfef 0deg 360deg)';
  }

  let currentDegree = 0;
  const segments = rows.map((row, index) => {
    const share = (Number(row.total) || 0) / total;
    const start = currentDegree;
    const end = currentDegree + (share * 360);
    currentDegree = end;
    return `${PIE_COLORS[index % PIE_COLORS.length]} ${start}deg ${end}deg`;
  });

  return `conic-gradient(${segments.join(', ')})`;
}

function AdminDashboardPage() {
  const [monthWindow, setMonthWindow] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardPayload, setDashboardPayload] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const payload = await fetchAdminDashboardOverview(monthWindow);
      setDashboardPayload(payload || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not load dashboard metrics right now.');
      setDashboardPayload(null);
    } finally {
      setLoading(false);
    }
  }, [monthWindow]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const overview = dashboardPayload?.overview || {};
  const deltas = overview?.deltas || {};
  const revenueSeries = useMemo(
    () => (Array.isArray(dashboardPayload?.revenueSeries) ? dashboardPayload.revenueSeries : []),
    [dashboardPayload]
  );
  const venueStatusBreakdown = useMemo(
    () => (Array.isArray(dashboardPayload?.venueStatusBreakdown) ? dashboardPayload.venueStatusBreakdown : []),
    [dashboardPayload]
  );

  const maxRevenue = useMemo(
    () => Math.max(...revenueSeries.map((row) => Number(row.revenue) || 0), 1),
    [revenueSeries]
  );

  const totalPieCount = useMemo(
    () => venueStatusBreakdown.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
    [venueStatusBreakdown]
  );

  const strongestMonth = useMemo(
    () => revenueSeries.slice().sort((first, second) => (second.revenue || 0) - (first.revenue || 0))[0] || null,
    [revenueSeries]
  );

  const metricCards = [
    {
      label: 'Total users',
      value: formatCompactNumber(overview.totalUsers),
      delta: deltas.usersPercent,
    },
    {
      label: 'Total packages',
      value: formatCompactNumber(overview.totalPackages),
      delta: deltas.packagesPercent,
    },
    {
      label: 'Total venues',
      value: formatCompactNumber(overview.totalVenues),
      delta: deltas.venuesPercent,
    },
    {
      label: 'Revenue this month',
      value: formatCurrencyVnd(overview.monthlyRevenue || 0),
      delta: deltas.revenuePercent,
    },
  ];

  return (
    <div className="admin-dashboard-page">
      <section className="admin-dashboard-hero" data-onboarding="admin-hero">
        <div>
          <p className="admin-dashboard-kicker">Administrative Overview</p>
          <h1>City growth and monetization at a glance</h1>
          <p className="admin-dashboard-description">
            Track user growth, package inventory, venue volume, and monthly ad revenue in one operational dashboard.
          </p>
        </div>

        <div className="admin-dashboard-hero-side">
          <div className="admin-dashboard-range-switch" role="tablist" aria-label="Dashboard month window">
            {MONTH_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`admin-dashboard-range-btn ${monthWindow === option ? 'is-active' : ''}`.trim()}
                onClick={() => setMonthWindow(option)}
              >
                {option}m
              </button>
            ))}
          </div>

          <div className="admin-dashboard-badge">
            <span>Data sync</span>
            <strong>
              {dashboardPayload?.generatedAt
                ? new Date(dashboardPayload.generatedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Live'}
            </strong>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="admin-dashboard-empty">
          <h3>Loading dashboard...</h3>
          <p>Fetching latest admin metrics and trends.</p>
        </section>
      ) : null}

      {!loading && error ? (
        <section className="admin-dashboard-empty">
          <h3>Unable to load dashboard</h3>
          <p>{error}</p>
          <button type="button" className="admin-dashboard-retry" onClick={loadDashboard}>
            Retry
          </button>
        </section>
      ) : null}

      {!loading && !error ? (
        <>
          <section className="admin-metrics-strip" data-onboarding="admin-metrics">
            {metricCards.map((card) => (
              <article key={card.label} className="admin-metric-card">
                <strong>{card.value}</strong>
                <span>{card.label}</span>
                <em className={`delta-${getDeltaTone(card.delta)}`.trim()}>
                  {formatDelta(card.delta)} vs previous month
                </em>
              </article>
            ))}
          </section>

          <section className="admin-dashboard-grid">
            <article className="admin-panel admin-panel-bars">
              <div className="admin-panel-head">
                <h3>Revenue by month</h3>
                <p>Paid package transactions in the selected window.</p>
              </div>

              {revenueSeries.length ? (
                <div className="admin-bars">
                  {revenueSeries.map((row) => {
                    const value = Number(row.revenue) || 0;
                    const heightPercent = Math.max(8, Math.round((value / maxRevenue) * 100));

                    return (
                      <div key={row.month} className="admin-bar-column">
                        <div className="admin-bar-value">{Math.round(value / 1000).toLocaleString('en-US')}k</div>
                        <div className="admin-bar-track">
                          <div className="admin-bar-fill" style={{ height: `${heightPercent}%` }} />
                        </div>
                        <span>{formatMonthLabel(row.month)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="admin-inline-empty">No paid transactions yet.</p>
              )}
            </article>

            <article className="admin-panel admin-panel-donut">
              <div className="admin-panel-head">
                <h3>Venue status distribution</h3>
                <p>Current moderation distribution across active venue statuses.</p>
              </div>

              {venueStatusBreakdown.length ? (
                <div className="admin-donut-layout">
                  <div className="admin-donut-visual" style={{ '--pie-gradient': buildPieGradient(venueStatusBreakdown) }}>
                    <div className="admin-donut-core">
                      <strong>{formatCompactNumber(totalPieCount)}</strong>
                      <span>venues</span>
                    </div>
                  </div>

                  <div className="admin-donut-legend">
                    {venueStatusBreakdown.map((item, index) => {
                      const share = totalPieCount ? ((Number(item.total) || 0) / totalPieCount) * 100 : 0;

                      return (
                        <div key={item.status} className="admin-donut-legend-item">
                          <span
                            className="admin-donut-dot"
                            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                          />
                          <div>
                            <p>{item.label}</p>
                            <strong>{formatCompactNumber(item.total)} ({share.toFixed(1)}%)</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="admin-inline-empty">No venue status data available.</p>
              )}
            </article>
          </section>

          <section className="admin-dashboard-insights">
            <article className="admin-panel">
              <div className="admin-panel-head">
                <h3>Peak revenue month</h3>
                <p>Highest monthly collection from successful package payments.</p>
              </div>
              <strong className="admin-insight-value">
                {strongestMonth ? formatMonthLabel(strongestMonth.month) : 'N/A'}
              </strong>
              <p className="admin-insight-subtext">
                {strongestMonth
                  ? `${formatCurrencyVnd(strongestMonth.revenue || 0)} with ${Number(strongestMonth.transactions || 0).toLocaleString('en-US')} paid transaction(s)`
                  : 'No revenue has been recorded in the selected period.'}
              </p>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}

export default AdminDashboardPage;
