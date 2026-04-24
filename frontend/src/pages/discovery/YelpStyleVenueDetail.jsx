import React, { useState, useEffect } from 'react';
import './YelpStyleVenueDetail.css';

/**
 * Component Yelp-style cho chi tiết quán ăn/địa điểm
 * - Slider ảnh chính với nút điều hướng prev/next
 * - Gallery ảnh thumbnail bên dưới
 * - Rating stars + số reviews
 * - Badge "Claimed" + category
 * - Trạng thái Open/Closed + giờ mở cửa
 * - Khoảng giá tiền
 * - Mô tả
 * - Link xem tất cả ảnh
 * - Nút hành động: Write review, Add photos, Share, Save
 */

function YelpStyleVenueDetail({
  venue = {},
  images = [],
  onBackClick = () => {},
  onWriteReview = () => {},
  onAddPhotos = () => {},
  onShare = () => {},
  onSave = () => {},
  isSaved = false,
  isOpen = false,
  rating = 0,
  reviews = 0,
  category = 'Dining',
  priceRange = '$$',
  description = '',
  openingHours = '',
  isClaimed = false,
  totalPhotos = 0
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showGalleryModal, setShowGalleryModal] = useState(false);

  // Nếu không có ảnh, dùng ảnh default
  const venueImages = images && images.length > 0 ? images : [
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80'
  ];

  const mainImage = venueImages[currentImageIndex] || venueImages[0];

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? venueImages.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === venueImages.length - 1 ? 0 : prev + 1));
  };

  const renderStars = (count) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`star ${i < Math.floor(count) ? 'filled' : 'empty'}`}>
        ★
      </span>
    ));
  };

  const venueName = venue.name || venue.title || 'Venue';
  const venueAddress = venue.address || venue.street_address || 'Address updating';

  return (
    <div className="yelp-style-venue-detail">
      {/* Header với nút Back */}
      <div className="yelp-header">
        <button className="yelp-back-btn" onClick={onBackClick}>
          ← Back
        </button>
      </div>

      {/* Hero Section: Slider ảnh chính + Info sidebar */}
      <div className="yelp-hero-section">
        {/* Image Slider */}
        <div className="yelp-image-slider-container">
          <div className="yelp-image-slider">
            <img
              src={mainImage}
              alt={venueName}
              className="yelp-main-image"
            />

            {/* Navigation Buttons */}
            {venueImages.length > 1 && (
              <>
                <button
                  className="yelp-slider-btn yelp-slider-prev"
                  onClick={handlePrevImage}
                  aria-label="Previous image"
                >
                  ❮
                </button>
                <button
                  className="yelp-slider-btn yelp-slider-next"
                  onClick={handleNextImage}
                  aria-label="Next image"
                >
                  ❯
                </button>
              </>
            )}

            {/* Image Counter */}
            <div className="yelp-image-counter">
              {currentImageIndex + 1} / {venueImages.length}
            </div>

            {/* See All Photos Button */}
            {totalPhotos > 0 && (
              <button
                className="yelp-see-all-photos-btn"
                onClick={() => setShowGalleryModal(true)}
              >
                📷 See all {totalPhotos} photos
              </button>
            )}
          </div>

          {/* Thumbnail Gallery */}
          {venueImages.length > 1 && (
            <div className="yelp-thumbnail-gallery">
              {venueImages.slice(0, 6).map((image, idx) => (
                <button
                  key={idx}
                  className={`yelp-thumbnail ${idx === currentImageIndex ? 'active' : ''}`}
                  onClick={() => setCurrentImageIndex(idx)}
                  aria-label={`View image ${idx + 1}`}
                >
                  <img src={image} alt={`Thumbnail ${idx + 1}`} />
                </button>
              ))}
              {venueImages.length > 6 && (
                <button className="yelp-thumbnail-more">
                  +{venueImages.length - 6}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="yelp-info-section">
          {/* Title */}
          <h1 className="yelp-venue-title">{venueName}</h1>

          {/* Address */}
          <p className="yelp-venue-address">
            📍 {venueAddress}
          </p>

          {/* Rating & Reviews */}
          <div className="yelp-rating-section">
            <div className="yelp-stars">
              {renderStars(rating)}
            </div>
            <span className="yelp-rating-text">
              {rating.toFixed(1)}/5 · {reviews} {reviews === 1 ? 'review' : 'reviews'}
            </span>
          </div>

          {/* Badges: Claimed + Category */}
          <div className="yelp-badges">
            {isClaimed && (
              <span className="yelp-badge yelp-badge-claimed">✓ Claimed</span>
            )}
            <span className="yelp-badge yelp-badge-category">
              🏷️ {category}
            </span>
          </div>

          {/* Status & Hours */}
          <div className="yelp-status-section">
            <div className={`yelp-status-badge ${isOpen ? 'open' : 'closed'}`}>
              {isOpen ? '🟢 Open now' : '🔴 Closed'}
            </div>
            <span className="yelp-hours-text">
              {openingHours || 'Hours: TBD'}
            </span>
          </div>

          {/* Price Range */}
          <div className="yelp-price-range">
            <span className="yelp-price-label">💵 {priceRange}</span>
          </div>

          {/* Action Buttons */}
          <div className="yelp-action-buttons">
            <button
              className="yelp-btn yelp-btn-primary"
              onClick={onWriteReview}
            >
              ⭐ Write a review
            </button>
            <button
              className="yelp-btn yelp-btn-secondary"
              onClick={onAddPhotos}
            >
              📷 Add photos
            </button>
            <button
              className="yelp-btn yelp-btn-secondary"
              onClick={onShare}
            >
              🔗 Share
            </button>
            <button
              className={`yelp-btn yelp-btn-secondary ${isSaved ? 'saved' : ''}`}
              onClick={onSave}
            >
              {isSaved ? '❤️ Saved' : '🤍 Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Description Section */}
      {description && (
        <div className="yelp-description-section">
          <h3>About</h3>
          <p className="yelp-description-text">
            {description}
          </p>
        </div>
      )}

      {/* Quick Info Cards */}
      <div className="yelp-quick-info-section">
        <div className="yelp-quick-info-card">
          <h4>🕐 Hours</h4>
          <p>{openingHours || 'Hours updating...'}</p>
        </div>
        <div className="yelp-quick-info-card">
          <h4>💵 Price Range</h4>
          <p>{priceRange}</p>
        </div>
        <div className="yelp-quick-info-card">
          <h4>⭐ Rating</h4>
          <p>{rating.toFixed(1)}/5 · {reviews} reviews</p>
        </div>
      </div>

      {/* Gallery Modal */}
      {showGalleryModal && (
        <div className="yelp-gallery-modal" onClick={() => setShowGalleryModal(false)}>
          <div className="yelp-gallery-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="yelp-gallery-modal-close"
              onClick={() => setShowGalleryModal(false)}
            >
              ✕
            </button>
            <div className="yelp-gallery-grid">
              {venueImages.map((image, idx) => (
                <img
                  key={idx}
                  src={image}
                  alt={`Gallery ${idx + 1}`}
                  className="yelp-gallery-image"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default YelpStyleVenueDetail;
