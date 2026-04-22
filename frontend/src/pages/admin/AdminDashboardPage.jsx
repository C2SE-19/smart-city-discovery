import './AdminDashboardPage.css';

const metricCards = [
  { label: 'Approved venues', value: '750K', delta: '+12.4%' },
  { label: 'Pending reviews', value: '7,500', delta: '+08.2%' },
  { label: 'Ad revenue', value: '7,500', delta: '+18.1%' },
  { label: 'District coverage', value: '94%', delta: '+03.8%' },
];

const donutLegend = [
  { label: 'Venues Approved', value: '251K' },
  { label: 'Pending Review', value: '176K' },
  { label: 'Ad Revenue', value: '176K' },
];

const barData = [56, 102, 80, 116, 82, 128, 81, 58, 88, 79];
const chartDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S', 'M', 'T', 'W'];

function DonutLegend() {
  return (
    <div className="admin-donut-legend">
      {donutLegend.map((item, index) => (
        <div key={item.label} className="admin-donut-legend-item">
          <span className={`admin-donut-dot color-${index + 1}`} />
          <div>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartBars({ compact = false }) {
  return (
    <>
      <div className="admin-chart-scale">
        <span>160</span>
        <span>120</span>
        <span>80</span>
        <span>40</span>
        <span>0</span>
      </div>

      <div className="admin-bars">
        {barData.map((value, index) => (
          <div key={`${compact ? 'compact' : 'regular'}-${value}-${index}`} className="admin-bar-column">
            <div className="admin-bar-track">
              <div
                className="admin-bar-base"
                style={{ height: `${Math.max(value - (compact ? 30 : 38), 26)}px` }}
              />
              <div
                className="admin-bar-top"
                style={{ height: `${Math.min(value, compact ? 62 : 64)}px` }}
              />
            </div>
            <span>{chartDays[index]}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function AdminDashboardPage() {
  return (
    <div className="admin-dashboard-page">
      <section className="admin-dashboard-hero" data-onboarding="admin-hero">
        <div>
          <p className="admin-dashboard-kicker">Administrative overview</p>
          <h1>Monitor wards, merchant submissions and promotion activity in one place.</h1>
          <p className="admin-dashboard-description">
            This workspace is shaped for your project: GIS boundary management, merchant approval,
            content moderation and advertising package control.
          </p>
        </div>

        <div className="admin-dashboard-badge">
          <span>Live status</span>
          <strong>City map synchronized</strong>
        </div>
      </section>

      <section className="admin-metrics-strip" data-onboarding="admin-metrics">
        {metricCards.map((card) => (
          <article key={card.label} className="admin-metric-card">
            <strong>{card.value}</strong>
            <span>{card.label}</span>
            <em>{card.delta}</em>
          </article>
        ))}
      </section>

      <section className="admin-dashboard-grid admin-dashboard-grid-top">
        <article className="admin-panel admin-panel-donut">
          <div className="admin-panel-head">
            <span>This Week</span>
            <span className="admin-panel-caret">v</span>
          </div>

          <div className="admin-donut-layout">
            <div className="admin-donut-visual">
              <div className="admin-donut-ring ring-outer" />
              <div className="admin-donut-ring ring-inner" />
              <div className="admin-donut-core" />
            </div>

            <DonutLegend />
          </div>
        </article>

        <article className="admin-panel admin-panel-bars">
          <ChartBars />
        </article>
      </section>

      <section className="admin-dashboard-grid admin-dashboard-grid-bottom">
        <article className="admin-panel admin-panel-bars wide">
          <div className="admin-panel-head">
            <span>This Week</span>
            <span className="admin-panel-caret">v</span>
          </div>

          <ChartBars compact />
        </article>

        <article className="admin-panel admin-panel-donut compact">
          <div className="admin-donut-layout compact">
            <div className="admin-donut-visual small">
              <div className="admin-donut-ring ring-outer" />
              <div className="admin-donut-ring ring-inner" />
              <div className="admin-donut-core" />
            </div>

            <DonutLegend />
          </div>
        </article>
      </section>
    </div>
  );
}

export default AdminDashboardPage;
