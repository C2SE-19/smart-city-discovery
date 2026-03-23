function LandingInfoPage({ title, description, cards }) {
  return (
    <section className="landing-info-section">
      <div className="landing-info-heading">
        <h2>{title}</h2>
        <span />
      </div>

      <p className="landing-info-copy">{description}</p>

      <div className="landing-info-grid">
        {cards.map((card) => (
          <article key={card.title} className="landing-info-card">
            <h3>{card.title}</h3>
            <p>{card.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default LandingInfoPage;
