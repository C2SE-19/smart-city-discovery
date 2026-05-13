import OpenStatusBadge from './OpenStatusBadge';
import './VenueCard.css';

export default function VenueCard({
	venue = {},
	onClick,
	onCompareToggle = null,
	isCompared = false,
	isCompareDisabled = false,
	compareTooltip = '',
}) {
	const venueName = String(venue?.name || venue?.title || '').trim() || 'Venue';
	const venueAddress = String(venue?.address || '').trim();
	const venueCategory = String(venue?.category_name || venue?.category || '').trim();
	const coverImage = venue?.cover_image_url || venue?.coverImageUrl || venue?.venue_primary_image_url || '';

	return (
		<article
			className="venue-card"
			onClick={onClick}
			role={onClick ? 'button' : undefined}
			tabIndex={onClick ? 0 : undefined}
			onKeyDown={(event) => {
				if (!onClick) return;
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					onClick(event);
				}
			}}
		>
			<div className="venue-card-media">
				{coverImage ? (
					<img src={coverImage} alt={venueName} loading="lazy" />
				) : (
					<div className="venue-card-placeholder">No image</div>
				)}
				<button
					type="button"
					className={`venue-card-compare ${isCompared ? 'is-active' : ''}`}
					title={compareTooltip || (isCompared ? `Remove ${venueName} from compare` : `Add ${venueName} to compare`)}
					aria-label={isCompared ? `Remove ${venueName} from compare` : `Add ${venueName} to compare`}
					aria-pressed={isCompared}
					disabled={isCompareDisabled}
					onClick={(event) => {
						event.stopPropagation();
						onCompareToggle?.(venue);
					}}
				>
					⚖️
				</button>
				<div className="venue-card-badge">
					<OpenStatusBadge scheduleSource={venue} />
				</div>
			</div>
			<div className="venue-card-body">
				<h3>{venueName}</h3>
				{venueAddress ? <p className="venue-card-meta">{venueAddress}</p> : null}
				{venueCategory ? <span className="venue-card-category">{venueCategory}</span> : null}
			</div>
		</article>
	);
}
