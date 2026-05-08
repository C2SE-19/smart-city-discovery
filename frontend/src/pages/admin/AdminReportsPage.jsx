import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAdminRevenueReport } from '../../services/api/adPackagesApi';
import { formatCurrencyVnd, getTierMeta } from '../../services/adPackageStorage';
import './AdminReportsPage.css';

const RANGE_OPTIONS = [3, 6, 12];
const CHART_WIDTH = 760;
const CHART_HEIGHT = 280;
const CHART_PADDING = 28;
const REPORTS_LAST_SEEN_KEY = 'adminReportsLastSeen';
const BADGE_REFRESH_EVENT = 'admin-badges-refresh';

function formatMonthLabel(value) {
  const [rawYear, rawMonth] = String(value || '').split('-');
  const year = Number.parseInt(rawYear, 10);
  const month = Number.parseInt(rawMonth, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return value;
  }

  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) {
    return 'N/A';
  }

  const parsed = new Date(value);
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

function formatStatusLabel(status) {
  switch (String(status || '').trim().toLowerCase()) {
    case 'paid':
      return 'Paid';
    case 'pending_payment':
      return 'Pending payment';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Failed';
    default:
      return 'Unknown';
  }
}

function buildChartPaths(series) {
  if (!series.length) {
    return { linePath: '', areaPath: '', points: [] };
  }

  const maxRevenue = Math.max(...series.map((item) => Number(item.revenue) || 0), 1);
  const usableWidth = CHART_WIDTH - CHART_PADDING * 2;
  const usableHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const stepX = series.length > 1 ? usableWidth / (series.length - 1) : 0;

  const points = series.map((item, index) => {
    const revenue = Number(item.revenue) || 0;
    const x = CHART_PADDING + (stepX * index);
    const y = CHART_HEIGHT - CHART_PADDING - ((revenue / maxRevenue) * usableHeight);
    return { x, y, revenue, month: item.month, transactions: Number(item.transactions) || 0 };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const areaPath = [
    linePath,
    `L ${points[points.length - 1].x} ${CHART_HEIGHT - CHART_PADDING}`,
    `L ${points[0].x} ${CHART_HEIGHT - CHART_PADDING}`,
    'Z',
  ].join(' ');

  return { linePath, areaPath, points };
}

function AdminReportsPage() {
  const [monthWindow, setMonthWindow] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportPayload, setReportPayload] = useState(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const payload = await fetchAdminRevenueReport(monthWindow);
      setReportPayload(payload || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not load revenue analytics right now.');
      setReportPayload(null);
    } finally {
      setLoading(false);
    }
  }, [monthWindow]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    const now = Date.now();
    window.localStorage.setItem(REPORTS_LAST_SEEN_KEY, String(now));
    window.dispatchEvent(new Event(BADGE_REFRESH_EVENT));
  }, []);

  const overview = useMemo(() => reportPayload?.overview || {}, [reportPayload]);
  const revenueSeries = useMemo(
    () => (Array.isArray(reportPayload?.revenueSeries) ? reportPayload.revenueSeries : []),
    [reportPayload]
  );
  const packageRows = useMemo(
    () => (Array.isArray(reportPayload?.packageRows) ? reportPayload.packageRows : []),
    [reportPayload]
  );
  const statusBreakdown = useMemo(
    () => (Array.isArray(reportPayload?.statusBreakdown) ? reportPayload.statusBreakdown : []),
    [reportPayload]
  );
  const recentPayments = useMemo(
    () => (Array.isArray(reportPayload?.recentPayments) ? reportPayload.recentPayments : []),
    [reportPayload]
  );

  const chartModel = useMemo(() => buildChartPaths(revenueSeries), [revenueSeries]);
  const totalStatuses = useMemo(
    () => statusBreakdown.reduce((total, row) => total + (Number(row.total) || 0), 0),
    [statusBreakdown]
  );
  const topPackages = useMemo(
    () => packageRows.slice().sort((first, second) => second.revenue - first.revenue).slice(0, 5),
    [packageRows]
  );
  const mostUsedPackage = useMemo(
    () => packageRows.slice().sort((first, second) => second.activeAssignmentCount - first.activeAssignmentCount)[0] || null,
    [packageRows]
  );
  const maxPackageRevenue = useMemo(
    () => Math.max(...topPackages.map((item) => Number(item.revenue) || 0), 1),
    [topPackages]
  );

  return (
    <section className="admin-reports-page">
      <header className="admin-reports-header">
        <div>
          <p className="admin-reports-kicker">Finance Intelligence</p>
          <h2>Reports & Revenue</h2>
          <p>
            Monitor real package revenue, payment lifecycle health, and package demand across the advertising system.
          </p>
        </div>

        <div className="admin-reports-range-switch" role="tablist" aria-label="Revenue window">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`admin-reports-range-btn ${monthWindow === option ? 'is-active' : ''}`.trim()}
              onClick={() => setMonthWindow(option)}
            >
              {option} months
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="admin-reports-empty">
          <h3>Loading revenue dashboard...</h3>
          <p>Please wait while we aggregate package payments and usage signals.</p>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="admin-reports-empty">
          <h3>Unable to load analytics</h3>
          <p>{error}</p>
          <button type="button" className="admin-reports-secondary-btn" onClick={loadReport}>
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <section className="admin-reports-kpi-grid">
            <article className="admin-reports-kpi-card">
              <span>Revenue in window</span>
              <strong>{formatCurrencyVnd(overview.totalRevenueInWindow || 0)}</strong>
              <em>{Number(overview.totalTransactionsInWindow || 0)} successful payments</em>
            </article>
            <article className="admin-reports-kpi-card">
              <span>All-time revenue</span>
              <strong>{formatCurrencyVnd(overview.totalRevenueAllTime || 0)}</strong>
              <em>{Number(overview.paidTransactionsAllTime || 0)} paid package orders</em>
            </article>
            <article className="admin-reports-kpi-card">
              <span>Average order value</span>
              <strong>{formatCurrencyVnd(overview.averageOrderValue || 0)}</strong>
              <em>Across the selected reporting window</em>
            </article>
            <article className="admin-reports-kpi-card">
              <span>Active assignment coverage</span>
              <strong>{Number(overview.activeAssignments || 0).toLocaleString('en-US')}</strong>
              <em>{Number(overview.activePackagesSold || 0)} packages have generated revenue</em>
            </article>
          </section>

          <section className="admin-reports-main-grid">
            <article className="admin-reports-panel admin-reports-chart-panel">
              <div className="admin-reports-panel-head">
                <div>
                  <h3>Revenue Trend</h3>
                  <p>Monthly revenue and payment volume sourced from successful PayOS confirmations.</p>
                </div>
              </div>

              {chartModel.points.length ? (
                <div className="admin-reports-chart-wrap">
                  <svg
                    className="admin-reports-chart"
                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    role="img"
                    aria-label="Monthly revenue trend"
                  >
                    <defs>
                      <linearGradient id="revenueAreaGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                        <stop offset="0%" stopColor="#2f66dc" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#2f66dc" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {[0.25, 0.5, 0.75, 1].map((ratio) => {
                      const y = CHART_HEIGHT - CHART_PADDING - ((CHART_HEIGHT - CHART_PADDING * 2) * ratio);
                      return (
                        <line
                          key={`grid-${ratio}`}
                          x1={CHART_PADDING}
                          x2={CHART_WIDTH - CHART_PADDING}
                          y1={y}
                          y2={y}
                          className="admin-reports-chart-gridline"
                        />
                      );
                    })}

                    <path d={chartModel.areaPath} className="admin-reports-chart-area" />
                    <path d={chartModel.linePath} className="admin-reports-chart-line" />

                    {chartModel.points.map((point) => (
                      <g key={point.month}>
                        <circle cx={point.x} cy={point.y} r="5.5" className="admin-reports-chart-point" />
                        <text x={point.x} y={point.y - 12} className="admin-reports-chart-point-label">
                          {Math.round(point.revenue / 1000).toLocaleString('en-US')}k
                        </text>
                      </g>
                    ))}
                  </svg>

                  <div className="admin-reports-chart-axis">
                    {chartModel.points.map((point) => (
                      <div key={`axis-${point.month}`} className="admin-reports-chart-axis-item">
                        <strong>{formatMonthLabel(point.month)}</strong>
                        <span>{point.transactions} payment(s)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="admin-reports-inline-empty">No successful package payments yet.</p>
              )}
            </article>

            <article className="admin-reports-panel admin-reports-spotlight-panel">
              <div className="admin-reports-panel-head">
                <div>
                  <h3>Package Spotlight</h3>
                  <p>Which package is generating the most revenue and coverage right now.</p>
                </div>
              </div>

              <div className="admin-reports-spotlight-card">
                <span className="admin-reports-spotlight-label">Top revenue package</span>
                <strong>{overview.topPackage?.packageName || 'No revenue yet'}</strong>
                <p>{formatCurrencyVnd(overview.topPackage?.revenue || 0)} in confirmed payments</p>
                <div className="admin-reports-spotlight-metrics">
                  <div>
                    <span>Paid orders</span>
                    <strong>{Number(overview.topPackage?.paidCount || 0).toLocaleString('en-US')}</strong>
                  </div>
                  <div>
                    <span>Active merchants</span>
                    <strong>{Number(overview.topPackage?.activeMerchantCount || 0).toLocaleString('en-US')}</strong>
                  </div>
                </div>
              </div>

              <div className="admin-reports-insight-list">
                <article>
                  <span>Most used package</span>
                  <strong>{mostUsedPackage?.packageName || 'No active usage yet'}</strong>
                  <p>{Number(mostUsedPackage?.activeAssignmentCount || 0).toLocaleString('en-US')} active assignments</p>
                </article>
                <article>
                  <span>Revenue packages</span>
                  <strong>{Number(overview.activePackagesSold || 0).toLocaleString('en-US')}</strong>
                  <p>Packages with at least one paid transaction</p>
                </article>
              </div>
            </article>
          </section>

          <section className="admin-reports-secondary-grid">
            <article className="admin-reports-panel">
              <div className="admin-reports-panel-head">
                <div>
                  <h3>Payment Status Mix</h3>
                  <p>Track checkout health across pending, paid, cancelled, and failed package orders.</p>
                </div>
              </div>

              <div className="admin-reports-status-grid">
                {statusBreakdown.map((row) => (
                  <div key={row.status} className="admin-reports-status-card">
                    <span>{formatStatusLabel(row.status)}</span>
                    <strong>{Number(row.total || 0).toLocaleString('en-US')}</strong>
                    <em>
                      {totalStatuses
                        ? `${Math.round(((Number(row.total || 0) / totalStatuses) * 100))}% of all package orders`
                        : 'No package orders yet'}
                    </em>
                  </div>
                ))}
              </div>
            </article>

            <article className="admin-reports-panel">
              <div className="admin-reports-panel-head">
                <div>
                  <h3>Best-Selling Packages</h3>
                  <p>Revenue contribution, paid order count, and active assignment volume for each package.</p>
                </div>
              </div>

              <div className="admin-reports-package-list">
                {topPackages.length ? topPackages.map((item) => {
                  const tierMeta = getTierMeta(item.tier);
                  const widthPercent = Math.max(8, Math.round(((Number(item.revenue) || 0) / maxPackageRevenue) * 100));

                  return (
                    <article key={item.packageId} className="admin-reports-package-item">
                      <div className="admin-reports-package-head">
                        <div>
                          <strong>{item.packageName}</strong>
                          <span>{formatCurrencyVnd(item.price || 0)}</span>
                        </div>
                        <span
                          className="admin-reports-package-tier"
                          style={{
                            '--tier-color': tierMeta.color,
                            '--tier-soft': tierMeta.accent,
                          }}
                        >
                          {tierMeta.label}
                        </span>
                      </div>

                      <div className="admin-reports-package-bar-track">
                        <div
                          className="admin-reports-package-bar"
                          style={{
                            width: `${widthPercent}%`,
                            '--tier-color': tierMeta.color,
                          }}
                        />
                      </div>

                      <div className="admin-reports-package-meta">
                        <span>{formatCurrencyVnd(item.revenue || 0)} revenue</span>
                        <span>{Number(item.paidCount || 0).toLocaleString('en-US')} paid orders</span>
                        <span>{Number(item.activeAssignmentCount || 0).toLocaleString('en-US')} active assignments</span>
                      </div>
                    </article>
                  );
                }) : (
                  <p className="admin-reports-inline-empty">No package revenue yet.</p>
                )}
              </div>
            </article>
          </section>

          <section className="admin-reports-panel">
            <div className="admin-reports-panel-head">
              <div>
                <h3>Recent Successful Payments</h3>
                <p>The most recent advertising package payments confirmed in the system.</p>
              </div>
            </div>

            {recentPayments.length ? (
              <div className="admin-reports-table-wrap">
                <table className="admin-reports-table">
                  <thead>
                    <tr>
                      <th>Merchant</th>
                      <th>Package</th>
                      <th>Amount</th>
                      <th>Order code</th>
                      <th>Confirmed at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>
                          <strong>{payment.merchant?.name || 'Unknown merchant'}</strong>
                          <span>{payment.merchant?.email || 'No email'}</span>
                        </td>
                        <td>
                          <strong>{payment.package?.name || 'Archived package'}</strong>
                          <span>{payment.package?.tier || 'basic'}</span>
                        </td>
                        <td>{formatCurrencyVnd(payment.amount || 0)}</td>
                        <td>{payment.orderCode || payment.paymentReference || 'N/A'}</td>
                        <td>{formatDateTime(payment.paidAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-reports-inline-empty">There are no confirmed payments yet.</p>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

export default AdminReportsPage;
