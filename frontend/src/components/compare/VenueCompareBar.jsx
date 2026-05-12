import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompareVenues } from '../../contexts/CompareContext';
import { fetchVenueCompareBundle } from '../../services/api/venuesApi';
import OpenStatusBadge from '../discovery/OpenStatusBadge';
import './VenueCompareBar.css';

const IMAGE_FALLBACK =
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80';

function buildVenueImage(source) {
  return String(
    source?.cover_image_url
    || source?.coverImageUrl
    || source?.venue_primary_image_url
    || source?.image
    || source?.venue_images?.[0]
    || IMAGE_FALLBACK
  ).trim() || IMAGE_FALLBACK;
}

function buildVenueCategory(source) {
  return String(source?.category_name || source?.category || source?.categoryName || '').trim() || 'Not available';
}

function buildVenueAddress(source) {
  return String(source?.address || '').trim() || 'Address not available';
}

function buildVenueDescription(source) {
  const description = String(source?.description || source?.metadata?.description || '').trim();
  if (!description) {
    return 'No description available.';
  }

  return description.length > 180 ? `${description.slice(0, 177).trim()}...` : description;
}

function buildVenueRating(source) {
  const candidates = [
    source?.averageRating,
    source?.average_rating,
    source?.totalReviews > 0 ? source?.averageRating : null,
  ].map((value) => Number(value));

  const rating = candidates.find((value) => Number.isFinite(value) && value > 0);
  return Number.isFinite(rating) ? Number(rating.toFixed(1)) : null;
}

function buildCompareVenue(baseVenue, comparePayload) {
  const resolvedSource = comparePayload || baseVenue;

  return {
    id: String(baseVenue?.id || '').trim(),
    name: String(resolvedSource?.name || resolvedSource?.title || baseVenue?.name || 'Venue').trim() || 'Venue',
    image: buildVenueImage({
      ...baseVenue,
      ...comparePayload,
    }),
    category: buildVenueCategory({
      ...baseVenue,
      ...comparePayload,
    }),
    address: buildVenueAddress({
      ...baseVenue,
      ...comparePayload,
    }),
    description: buildVenueDescription({
      ...baseVenue,
      ...comparePayload,
    }),
    rating: buildVenueRating(comparePayload),
    openingPayload: comparePayload?.openingRealtime || comparePayload || baseVenue,
  };
}

function CompareVenueCard({ venue, isRatingWinner, onOpenDetail }) {
  return (
    <article className="compare-modal__venue">
      <div className="compare-modal__image-shell">
        <img src={venue.image} alt={venue.name} loading="lazy" />
      </div>

      <div className="compare-modal__body">
        <h3>{venue.name}</h3>

        <div className={`compare-modal__stat ${isRatingWinner ? 'is-winning' : ''}`}>
          <span className="compare-modal__stat-label">Rating</span>
          <strong>{venue.rating === null ? 'Not available' : `${venue.rating}/5`}</strong>
        </div>

        <div className="compare-modal__meta-block">
          <span className="compare-modal__meta-label">Category</span>
          <p>{venue.category}</p>
        </div>

        <div className="compare-modal__meta-block">
          <span className="compare-modal__meta-label">Address</span>
          <p>{venue.address}</p>
        </div>

        <div className="compare-modal__meta-block">
          <span className="compare-modal__meta-label">Open status</span>
          <OpenStatusBadge scheduleSource={venue.openingPayload} showWhenUnknown />
        </div>

        <div className="compare-modal__meta-block">
          <span className="compare-modal__meta-label">Description</span>
          <p>{venue.description}</p>
        </div>

        <button type="button" className="compare-modal__detail-btn" onClick={() => onOpenDetail(venue.id)}>
          View details
        </button>
      </div>
    </article>
  );
}

export default function VenueCompareBar() {
  const navigate = useNavigate();
  const { compareVenues, removeVenue, clearAll } = useCompareVenues();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [compareData, setCompareData] = useState([]);
  const canCompareNow = compareVenues.length === 2;

  useEffect(() => {
    if (!isModalOpen || !canCompareNow) {
      return undefined;
    }

    let active = true;

    fetchVenueCompareBundle(compareVenues.map((venue) => venue.id))
      .then((payload) => {
        if (!active) {
          return;
        }

        const venueMap = new Map(
          (Array.isArray(payload?.venues) ? payload.venues : []).map((venue) => [String(venue?.id || '').trim(), venue])
        );

        setCompareData(
          compareVenues.map((venue) => buildCompareVenue(venue, venueMap.get(String(venue.id || '').trim()) || null))
        );
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setCompareData(compareVenues.map((venue) => buildCompareVenue(venue, null)));
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canCompareNow, compareVenues, isModalOpen]);

  const ratingLeaderId = useMemo(() => {
    if (compareData.length !== 2) {
      return '';
    }

    const [firstVenue, secondVenue] = compareData;
    if (firstVenue.rating === null || secondVenue.rating === null || firstVenue.rating === secondVenue.rating) {
      return '';
    }

    return firstVenue.rating > secondVenue.rating ? firstVenue.id : secondVenue.id;
  }, [compareData]);

  if (!compareVenues.length) {
    return null;
  }

  return (
    <>
      <div className="compare-bar">
        <div className="compare-bar__copy">
          <span className="compare-bar__eyebrow">Venue compare</span>
          <div className="compare-bar__chips">
            {compareVenues.map((venue) => (
              <span key={`compare-chip-${venue.id}`} className="compare-bar__chip">
                <span>{venue.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${venue.name} from compare`}
                  onClick={() => removeVenue(venue.id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="compare-bar__actions">
          <button type="button" className="compare-bar__clear" onClick={clearAll}>
            Clear
          </button>
          <button
            type="button"
            className="compare-bar__submit"
            onClick={() => {
              setCompareData([]);
              setIsLoading(true);
              setIsModalOpen(true);
            }}
            disabled={!canCompareNow}
          >
            Compare now
          </button>
        </div>
      </div>

      {isModalOpen && canCompareNow ? (
        <div className="compare-modal__overlay" onClick={() => setIsModalOpen(false)}>
          <div className="compare-modal" onClick={(event) => event.stopPropagation()}>
            <div className="compare-modal__header">
              <div>
                <h2>Compare venues</h2>
                <p>Quick side-by-side view for your selected places.</p>
              </div>
              <button type="button" className="compare-modal__close" onClick={() => setIsModalOpen(false)}>
                ×
              </button>
            </div>

            {isLoading ? (
              <div className="compare-modal__loading">Loading compare data...</div>
            ) : (
              <div className="compare-modal__grid">
                {compareData.map((venue) => (
                  <CompareVenueCard
                    key={`compare-modal-${venue.id}`}
                    venue={venue}
                    isRatingWinner={ratingLeaderId === venue.id}
                    onOpenDetail={(venueId) => {
                      setIsModalOpen(false);
                      navigate(`/venues/${venueId}`);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
