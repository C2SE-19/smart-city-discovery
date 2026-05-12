import { useEffect, useState } from 'react';
import { getVenueOpenStatus } from '../../utils/openingHours';
import './OpenStatusBadge.css';

export default function OpenStatusBadge({ scheduleSource, showWhenUnknown = false }) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      forceUpdate((prev) => prev + 1);
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const status = getVenueOpenStatus(scheduleSource, { showWhenUnknown });

  if (!status.shouldRender) {
    return null;
  }

  const statusClass =
    status.tone === 'open'
      ? 'is-open'
      : status.tone === 'closing-soon'
        ? 'is-closing-soon'
        : status.tone === 'closed'
          ? 'is-closed'
          : 'is-unknown';

  const dotClass =
    status.pulse === 'fast'
      ? 'is-fast'
      : status.pulse === 'slow'
        ? 'is-slow'
        : 'is-static';

  return (
    <span className={`open-status-badge ${statusClass}`}>
      <span className={`open-status-dot ${dotClass}`} aria-hidden="true" />
      <span className="open-status-copy">
        <span className="open-status-label">{status.primaryLabel}</span>
        {status.secondaryLabel ? <span className="open-status-sublabel">{status.secondaryLabel}</span> : null}
      </span>
    </span>
  );
}
