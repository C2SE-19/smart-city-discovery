import React, { useEffect, useState } from 'react';
import { fetchVenues } from '../../services/api/venuesApi';
import './SimilarVenuesSection.css';

export default function SimilarVenuesSection({
  currentVenueId = null,
  currentCategoryId = 0,
  currentWardId = '',
  currentCategoryLabel = '',
  currentWardLabel = '',
  maxItems = 3,
  labels = {},
  onVenueClick = () => {}
}) {
  const [similarVenues, setSimilarVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const parsedCategoryId = Number(currentCategoryId || 0);
    const normalizedWardId = String(currentWardId || '').trim();

    if (!Number.isFinite(parsedCategoryId) || parsedCategoryId <= 0 || !normalizedWardId) {
      setSimilarVenues([]);
      return;
    }

    let isMounted = true;

    async function fetchSimilarVenues() {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchVenues({
          categoryId: parsedCategoryId,
          wardId: normalizedWardId,
          exclude: currentVenueId,
          limit: 8,
          compact: true,
          live: true
        });

        const sourceList = Array.isArray(data) ? data : Array.isArray(data?.venues) ? data.venues : [];
        const currentIdText = String(currentVenueId || '').trim();
        let filtered = sourceList
          .filter((venue) => String(venue?.id || '').trim() && String(venue.id).trim() !== currentIdText)
          .slice(0, Math.max(maxItems, 6));

        if (filtered.length < 3) {
          const fallbackData = await fetchVenues({
            categoryId: parsedCategoryId,
            exclude: [currentVenueId, ...filtered.map((item) => item?.id)].filter(Boolean).join(','),
            limit: 12,
            compact: true,
            live: true
          });

          const fallbackList = Array.isArray(fallbackData)
            ? fallbackData
            : Array.isArray(fallbackData?.venues)
              ? fallbackData.venues
              : [];

          const existingIds = new Set(filtered.map((item) => String(item?.id || '').trim()));
          const fallbackCandidates = fallbackList.filter((venue) => {
            const idText = String(venue?.id || '').trim();
            return idText && idText !== currentIdText && !existingIds.has(idText);
          });

          filtered = [...filtered, ...fallbackCandidates].slice(0, 8);
        }

        if (isMounted) {
          setSimilarVenues(filtered.slice(0, Math.max(2, maxItems)));
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'Không thể tải quán tương tự.');
          setSimilarVenues([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchSimilarVenues();

    return () => {
      isMounted = false;
    };
  }, [currentCategoryId, currentVenueId, currentWardId, maxItems]);

  const resolvedCategoryLabel = String(currentCategoryLabel || '').trim() || labels.defaultCategoryLabel || 'địa điểm';
  const resolvedWardLabel = String(currentWardLabel || '').trim() || labels.defaultWardLabel || 'khu vực này';
  const sectionTitle = labels.title || 'Quán tương tự';
  const descriptionPrefix = labels.descriptionPrefix || 'Các địa điểm cùng nhóm';
  const descriptionMiddle = labels.descriptionMiddle || 'tại';
  const loadingText = labels.loading || 'Đang tải gợi ý...';
  const emptyText = labels.empty || 'Hiện chưa có quán tương tự phù hợp trong khu vực này.';
  const errorPrefix = labels.errorPrefix || 'Lỗi:';
  const viewLabel = labels.viewLabel || 'Xem →';
  const reviewsLabel = labels.reviews || 'đánh giá';

  return (
    <div className="similar-venues-section">
      <div className="similar-venues-header">
        <h2>{sectionTitle}</h2>
        <p>
          {descriptionPrefix} <strong>{resolvedCategoryLabel}</strong> {descriptionMiddle} <strong>{resolvedWardLabel}</strong>
        </p>
      </div>

      {loading && <p className="similar-venues-loading">{loadingText}</p>}
      {error && <p className="similar-venues-error">{errorPrefix} {error}</p>}

      {!loading && !error && similarVenues.length === 0 ? (
        <p className="similar-venues-empty">{emptyText}</p>
      ) : null}

      {similarVenues.length > 0 && (
        <div className="similar-venues-grid">
          {similarVenues.map((venue) => {
            const normalizedRating = Number(venue?.average_rating ?? venue?.rating ?? 0);
            const hasRating = Number.isFinite(normalizedRating) && normalizedRating > 0;
            const normalizedReviewCount = Number(venue?.total_reviews ?? venue?.reviews ?? 0);
            const hasReviewCount = Number.isFinite(normalizedReviewCount) && normalizedReviewCount > 0;
            const normalizedAddress = String(venue?.address || '').trim();
            const featuredPromotionLabel = venue?.featuredPromotion?.isHot
              ? String(venue?.featuredPromotion?.label || 'HOT').trim() || 'HOT'
              : '';

            return (
              <div
                key={venue.id}
                className="similar-venue-card"
                onClick={() => onVenueClick(venue.id)}
              >
                <div
                  className="similar-venue-image"
                  style={{
                    backgroundImage: `url('${venue.venue_primary_image_url || venue?.venue_images?.[0] || venue.cover_image_url || venue.coverImageUrl || 'https://via.placeholder.com/250x250?text=No+Image'}')`
                  }}
                >
                  {featuredPromotionLabel ? (
                    <span className="similar-venue-hot-badge">{featuredPromotionLabel}</span>
                  ) : null}
                  <div className="similar-venue-overlay">
                    <span className="similar-venue-link">{viewLabel}</span>
                  </div>
                </div>

                <div className="similar-venue-content">
                  <h3 className="similar-venue-name">{venue.name}</h3>

                  {venue.category_name && (
                    <p className="similar-venue-category">
                      {venue.category_name}
                    </p>
                  )}

                  {hasRating && (
                    <div className="similar-venue-rating">
                      <span className="similar-venue-stars">
                        {'⭐'.repeat(Math.max(1, Math.round(normalizedRating)))}
                      </span>
                      <span className="similar-venue-rating-number">
                        {normalizedRating.toFixed(1)}
                      </span>
                      {hasReviewCount && (
                        <span className="similar-venue-reviews">
                          ({normalizedReviewCount} {reviewsLabel})
                        </span>
                      )}
                    </div>
                  )}

                  {normalizedAddress && (
                    <p className="similar-venue-address">
                      📍 {normalizedAddress.length > 50 ? `${normalizedAddress.substring(0, 50)}...` : normalizedAddress}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
