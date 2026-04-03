function TagPill({ children, muted = false }) {
  return <span className={`tag-pill ${muted ? 'is-muted' : ''}`.trim()}>{children}</span>;
}

export default TagPill;