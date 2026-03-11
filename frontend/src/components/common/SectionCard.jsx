function SectionCard({ eyebrow, title, description, children, footer, className = '' }) {
  return (
    <section className={`section-card ${className}`.trim()}>
      <div className="section-card-header">
        {eyebrow ? <p className="section-card-eyebrow">{eyebrow}</p> : null}
        <h2 className="section-card-title">{title}</h2>
        {description ? <p className="section-card-description">{description}</p> : null}
      </div>

      <div className="section-card-body">{children}</div>

      {footer ? <div className="section-card-footer">{footer}</div> : null}
    </section>
  );
}

export default SectionCard;