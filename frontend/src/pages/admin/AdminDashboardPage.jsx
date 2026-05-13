import { useCallback, useEffect, useMemo, useState } from 'react';
import useAdminI18n from '../../hooks/useAdminI18n';
import { fetchAdminDashboardOverview } from '../../services/api/adPackagesApi';
import { formatCurrencyVnd } from '../../services/adPackageStorage';
import './AdminDashboardPage.css';

const MONTH_OPTIONS = [3, 6, 12];
const PIE_COLORS = ['#2f66dc', '#23a27b', '#f28c28', '#d94a5a', '#7c5de2', '#18a3b7'];

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
  const { tx, formatDateTime, formatMonthLabel, formatNumber } = useAdminI18n();
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
      setError(requestError?.response?.data?.message || tx('Could not load dashboard metrics right now.'));
      setDashboardPayload(null);
    } finally {
      setLoading(false);
    }
  }, [monthWindow, tx]);

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
      value: formatNumber(overview.totalUsers),
      delta: deltas.usersPercent,
    },
    {
      label: 'Total packages',
      value: formatNumber(overview.totalPackages),
      delta: deltas.packagesPercent,
    },
    {
      label: 'Total venues',
      value: formatNumber(overview.totalVenues),
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
          <p className="admin-dashboard-kicker">{tx('Administrative Overview')}</p>
          <h1>{tx('City growth and monetization at a glance')}</h1>
          <p className="admin-dashboard-description">
            {tx('Track user growth, package inventory, venue volume, and monthly ad revenue in one operational dashboard.')}
          </p>
        </div>

        <div className="admin-dashboard-hero-side">
          <div className="admin-dashboard-range-switch" role="tablist" aria-label={tx('Dashboard month window')}>
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
            <span>{tx('Data sync')}</span>
            <strong>
              {dashboardPayload?.generatedAt
                ? formatDateTime(dashboardPayload.generatedAt, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : tx('Live')}
            </strong>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="admin-dashboard-empty">
          <h3>{tx('Loading dashboard...')}</h3>
          <p>{tx('Fetching latest admin metrics and trends.')}</p>
        </section>
      ) : null}

      {!loading && error ? (
        <section className="admin-dashboard-empty">
          <h3>{tx('Unable to load dashboard')}</h3>
          <p>{error}</p>
          <button type="button" className="admin-dashboard-retry" onClick={loadDashboard}>
            {tx('Retry')}
          </button>
        </section>
      ) : null}

      {!loading && !error ? (
        <>
          <section className="admin-metrics-strip" data-onboarding="admin-metrics">
            {metricCards.map((card) => (
              <article key={card.label} className="admin-metric-card">
                <strong>{card.value}</strong>
                <span>{tx(card.label)}</span>
                <em className={`delta-${getDeltaTone(card.delta)}`.trim()}>
                  {formatDelta(card.delta)} {tx('vs previous month')}
                </em>
              </article>
            ))}
          </section>

          <section className="admin-dashboard-grid">
            <article className="admin-panel admin-panel-bars">
              <div className="admin-panel-head">
                <h3>{tx('Revenue by month')}</h3>
                <p>{tx('Paid package transactions in the selected window.')}</p>
              </div>

              {revenueSeries.length ? (
                <div className="admin-bars">
                  {revenueSeries.map((row) => {
                    const value = Number(row.revenue) || 0;
                    const heightPercent = Math.max(8, Math.round((value / maxRevenue) * 100));

                    return (
                      <div key={row.month} className="admin-bar-column">
                        <div className="admin-bar-value">{formatNumber(Math.round(value / 1000))}k</div>
                        <div className="admin-bar-track">
                          <div className="admin-bar-fill" style={{ height: `${heightPercent}%` }} />
                        </div>
                        <span>{formatMonthLabel(row.month)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="admin-inline-empty">{tx('No paid transactions yet.')}</p>
              )}
            </article>

            <article className="admin-panel admin-panel-donut">
              <div className="admin-panel-head">
                <h3>{tx('Venue status distribution')}</h3>
                <p>{tx('Current moderation distribution across active venue statuses.')}</p>
              </div>

              {venueStatusBreakdown.length ? (
                <div className="admin-donut-layout">
                  <div className="admin-donut-visual" style={{ '--pie-gradient': buildPieGradient(venueStatusBreakdown) }}>
                    <div className="admin-donut-core">
                      <strong>{formatNumber(totalPieCount)}</strong>
                      <span>{tx('venues')}</span>
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
                            <p>{tx(item.label || item.status || '')}</p>
                            <strong>{formatNumber(item.total)} ({share.toFixed(1)}%)</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="admin-inline-empty">{tx('No venue status data available.')}</p>
              )}
            </article>
          </section>

          <section className="admin-dashboard-insights">
            <article className="admin-panel">
              <div className="admin-panel-head">
                <h3>{tx('Peak revenue month')}</h3>
                <p>{tx('Highest monthly collection from successful package payments.')}</p>
              </div>
              <strong className="admin-insight-value">
                {strongestMonth ? formatMonthLabel(strongestMonth.month) : tx('N/A')}
              </strong>
              <p className="admin-insight-subtext">
                {strongestMonth
                  ? `${formatCurrencyVnd(strongestMonth.revenue || 0)} • ${formatNumber(strongestMonth.transactions || 0)} ${tx('payment(s)')}`
                  : tx('No revenue has been recorded in the selected period.')}
              </p>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}

export default AdminDashboardPage;
