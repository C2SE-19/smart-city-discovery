import React, { useState, useEffect } from 'react';
import './HeroVenueSection.css';

export default function HeroVenueSection({
  venue = {},
  images = [],
  rating = 0,
  reviews = 0,
  category = 'Dining',
  openingHours = '',
  isSaved = false,
  isOpen = false,
  onBackClick = () => {},
  onWriteReview = () => {},
  onAddPhotos = () => {},
  onShare = () => {},
  onSave = () => {},
  onPreviewImage = () => {}
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAllPhotosModal, setShowAllPhotosModal] = useState(false);

  // Auto-rotate images every 10 seconds
  useEffect(() => {
    if (images.length > 0) {
      const timer = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
      }, 10000); // 10 seconds
      return () => clearInterval(timer);
    }
  }, [images.length]);

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '';
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars += '⭐';
      } else if (i === fullStars && hasHalfStar) {
        stars += '⭐'; // Simplified: just show full star for half
      } else {
        stars += '☆';
      }
    }
    return stars;
  };

  const currentImage = images.length > 0 ? images[currentImageIndex] : '';

  const handlePreviewImage = (imageUrl) => {
    if (!imageUrl) {
      return;
    }

    onPreviewImage(imageUrl);
  };

  return (
    <div className="hero-venue-section">
      {/* Main Image Container */}
      <div className="hero-image-container">
        <div
          className="hero-main-image"
          style={{
            backgroundImage: `url('${currentImage}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
          onClick={() => handlePreviewImage(currentImage)}
        >
          {/* Back button - overlay on image */}
          <button className="hero-back-btn" onClick={(event) => {
            event.stopPropagation();
            onBackClick();
          }} title="Go back">
            ←
          </button>
          {/* See all photos button */}
          <button
            className="hero-see-all-photos-btn"
            onClick={(event) => {
              event.stopPropagation();
              setShowAllPhotosModal(true);
            }}
            title="See all photos"
          >
            📸 See all {images.length} photos
          </button>

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <button
                className="hero-nav-btn hero-nav-prev"
                onClick={(event) => {
                  event.stopPropagation();
                  handlePrevImage();
                }}
                aria-label="Previous image"
              >
                ❮
              </button>
              <button
                className="hero-nav-btn hero-nav-next"
                onClick={(event) => {
                  event.stopPropagation();
                  handleNextImage();
                }}
                aria-label="Next image"
              >
                ❯
              </button>
            </>
          )}

          {/* Venue Info Overlay (top-right) */}
          <div className="hero-info-overlay">
            <h1 className="hero-venue-name">{venue.name || 'Venue Name'}</h1>
            
            <div className="hero-rating-row">
              <span className="hero-stars">{renderStars(rating)}</span>
              <span className="hero-rating-number">{rating.toFixed(1)}</span>
              <span className="hero-reviews-count">({reviews} reviews)</span>
            </div>

            <div className="hero-meta-row">
              <span className="hero-category-badge">{category}</span>
              <span className={`hero-status-badge ${isOpen ? 'open' : 'closed'}`}>
                {isOpen ? '🟢 Open' : '🔴 Closed'}
              </span>
            </div>

            <div className="hero-hours">
              <span className="hero-hours-icon">🕐</span>
              <span className="hero-hours-text">{openingHours || 'Hours info'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="hero-action-buttons">
        <button className="hero-action-btn hero-action-write-review" onClick={onWriteReview}>
          <span className="hero-action-icon">⭐</span>
          <span className="hero-action-text">Write a review</span>
        </button>
        <button className="hero-action-btn hero-action-write-review" onClick={onAddPhotos}>
          <span className="hero-action-icon">📷</span>
          <span className="hero-action-text">Add photos</span>
        </button>
        <button className="hero-action-btn hero-action-write-review" onClick={onShare}>
          <span className="hero-action-icon">🔗</span>
          <span className="hero-action-text">Share</span>
        </button>
        <button
          className={`hero-action-btn hero-action-write-review ${isSaved ? 'hero-action-saved' : ''}`}
          onClick={onSave}
        >
          <span className="hero-action-icon">{isSaved ? '❤️' : '🤍'}</span>
          <span className="hero-action-text">{isSaved ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      {/* All Photos Modal */}
      {showAllPhotosModal && (
        <div className="hero-modal-overlay" onClick={() => setShowAllPhotosModal(false)}>
          <div className="hero-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="hero-modal-close"
              onClick={() => setShowAllPhotosModal(false)}
            >
              ✕
            </button>
            <h2>All Photos ({images.length})</h2>
            <div className="hero-modal-gallery">
              {images.map((img, idx) => (
                <div key={idx} className="hero-modal-photo">
                  <img
                    src={img}
                    alt={`Photo ${idx + 1}`}
                    onClick={() => handlePreviewImage(img)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
