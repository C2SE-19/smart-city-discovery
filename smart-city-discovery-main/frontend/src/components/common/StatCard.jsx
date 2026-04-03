function StatCard({ label, value, trend }) {
  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>
      <strong className="stat-value">{value}</strong>
      <p className="stat-trend">{trend}</p>
    </article>
  );
}

export default StatCard;