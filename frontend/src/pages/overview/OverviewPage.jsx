import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import translations from '../../constants/translations';
import axios from 'axios';
import { fetchPlaceCategories } from '../../services/api/placeCategoriesApi';
import { fetchMerchantServices } from '../../services/api/merchantServicesApi';
import { fetchWards } from '../../services/api/wardsApi';
import { fetchVenues } from '../../services/api/venuesApi';
import OverviewCityMapCard from '../../components/map/OverviewCityMapCard';
import './OverviewPage.css';

const FALLBACK_VENUE_IMAGE =
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80';

function renderHighlightedTitle(title) {
  const match = String(title || '').match(/^(.*)<span>(.*)<\/span>(.*)$/);

  if (!match) {
    return <h1>{title}</h1>;
  }

  return (
    <h1>
      {match[1]}
      <span>{match[2]}</span>
      {match[3]}
    </h1>
  );
}

function normalizeVenueMetadata(metadata) {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata;
  }

  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function getVenueImage(venue) {
  return (
    venue.cover_image_url ||
    venue.coverImageUrl ||
    venue.image ||
    FALLBACK_VENUE_IMAGE
  );
}

function getVenueCategoryId(venue) {
  const normalized = Number(venue.category_id ?? venue.categoryId);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function getVenueServices(venue, serviceNameById) {
  const metadata = normalizeVenueMetadata(venue.metadata);
  const byName = Array.isArray(metadata.selectedServiceNames)
    ? metadata.selectedServiceNames
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    : [];

  if (byName.length) {
    return byName;
  }

  if (!Array.isArray(metadata.selectedServices)) {
    return [];
  }

  return [...new Set(
    metadata.selectedServices
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
      .map((serviceId) => serviceNameById.get(serviceId))
      .filter(Boolean)
  )];
}

function toFavoriteVenuePayload(venue) {
  return {
    id: venue.id,
    name: venue.name || venue.title || 'Untitled venue',
    image: getVenueImage(venue),
    price: 'N/A',
    description: venue.description || venue.address || ''
  };
}

function FilterGroup({ title, options, selectedValues, optionValue, optionLabel, onToggle }) {
  return (
    <section className="overview-filter-group">
      <header>
        <h3>{title}</h3>
      </header>

      {!options.length ? (
        <p className="overview-empty-copy">No options available.</p>
      ) : (
        <div className="overview-filter-options">
          {options.map((option) => {
            const value = optionValue(option);
            const checked = selectedValues.includes(value);

            return (
              <label key={`${title}-${String(value)}`} className="overview-filter-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(value)}
                />
                <span>{optionLabel(option)}</span>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}

function VenueCard({ venue, isFavorite, onToggleFavorite, onExplore, services }) {
  const venueName = venue.name || venue.title || 'Untitled venue';
  const venueDescription = venue.description || 'No description provided yet.';
  const venueAddress = venue.address || 'Address not available';
  const wardName = venue.ward_name || venue.wardName;

  return (
    <article className="overview-dynamic-card">
      <div className="overview-dynamic-media">
        <img src={getVenueImage(venue)} alt={venueName} loading="lazy" />

        <button
          type="button"
          className={`overview-favorite ${isFavorite ? 'is-active' : ''}`}
          aria-label={isFavorite ? `Unsave ${venueName}` : `Save ${venueName}`}
          onClick={() => onToggleFavorite(toFavoriteVenuePayload(venue), 'place')}
        />
      </div>

      <div className="overview-dynamic-body">
        <h4>{venueName}</h4>
        <p className="overview-dynamic-address">{venueAddress}</p>
        <p className="overview-dynamic-description">{venueDescription}</p>

        <div className="overview-dynamic-tags">
          {wardName ? <span className="overview-venue-chip">{wardName}</span> : null}

          {services.slice(0, 2).map((serviceName) => (
            <span key={`${venue.id}-${serviceName}`} className="overview-venue-chip overview-venue-chip-muted">
              {serviceName}
            </span>
          ))}
        </div>

        <div className="overview-dynamic-footer">
          <button type="button" className="overview-card-link" onClick={() => onExplore(venue)}>
            View on Discovery
          </button>
        </div>
      </div>
    </article>
  );
}

function OverviewPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { token } = useAuth();
  const t = translations[language] || translations.en;
  const [favoriteKeys, setFavoriteKeys] = useState(new Set());
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [selectedWardIds, setSelectedWardIds] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [appliedCategoryIds, setAppliedCategoryIds] = useState([]);
  const [appliedWardIds, setAppliedWardIds] = useState([]);
  const [appliedServiceIds, setAppliedServiceIds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wards, setWards] = useState([]);
  const [services, setServices] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [filterError, setFilterError] = useState('');
  const [venueError, setVenueError] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const sliderRefs = useRef(new Map());
  const libraryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const closeImageModal = () => {
    setShowImageSearch(false);
    setSelectedImage(null);
    setPreviewUrl('');
    setImageError('');
    if (libraryInputRef.current) libraryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const apiUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
    []
  );

  const serviceNameById = useMemo(
    () =>
      new Map(
        services
          .map((service) => [Number(service.id), service.name])
          .filter(([serviceId, serviceName]) => Number.isInteger(serviceId) && Boolean(serviceName))
      ),
    [services]
  );

  const venueParams = useMemo(() => {
    const params = { status: 'approved' };

    if (appliedCategoryIds.length) {
      params.categoryIds = appliedCategoryIds.join(',');
    }

    if (appliedWardIds.length) {
      params.wardIds = appliedWardIds.join(',');
    }

    if (appliedServiceIds.length) {
      params.serviceIds = appliedServiceIds.join(',');
    }

    if (submittedSearch.trim()) {
      params.q = submittedSearch.trim();
    }

    return params;
  }, [appliedCategoryIds, appliedWardIds, appliedServiceIds, submittedSearch]);

  const categorySections = useMemo(() => {
    const groupedByCategory = new Map();

    venues.forEach((venue) => {
      const categoryId = getVenueCategoryId(venue);

      if (categoryId === null) {
        return;
      }

      if (!groupedByCategory.has(categoryId)) {
        groupedByCategory.set(categoryId, []);
      }

      groupedByCategory.get(categoryId).push(venue);
    });

    const visibleSections = categories
      .map((category) => {
        const categoryId = Number(category.id);

        if (!Number.isInteger(categoryId) || categoryId <= 0) {
          return null;
        }

        if (selectedCategoryIds.length && !selectedCategoryIds.includes(categoryId)) {
          return null;
        }

        return {
          id: categoryId,
          name: category.name,
          description: category.description,
          venues: groupedByCategory.get(categoryId) || []
        };
      })
      .filter(Boolean);

    groupedByCategory.forEach((categoryVenues, categoryId) => {
      if (visibleSections.some((section) => section.id === categoryId)) {
        return;
      }

      if (selectedCategoryIds.length && !selectedCategoryIds.includes(categoryId)) {
        return;
      }

      visibleSections.push({
        id: categoryId,
        name: categoryVenues[0]?.category_name || `Category ${categoryId}`,
        description: '',
        venues: categoryVenues
      });
    });

    return visibleSections;
  }, [categories, venues, selectedCategoryIds]);

  const uncategorizedVenues = useMemo(
    () => venues.filter((venue) => getVenueCategoryId(venue) === null),
    [venues]
  );

  const activeFilterCount =
    selectedCategoryIds.length +
    selectedWardIds.length +
    selectedServiceIds.length +
    (searchInput.trim() ? 1 : 0);
  const appliedFilterCount =
    appliedCategoryIds.length +
    appliedWardIds.length +
    appliedServiceIds.length +
    (submittedSearch.trim() ? 1 : 0);
  const isSearchMode = searchTriggered && appliedFilterCount > 0;

  const searchPageSize = 8;
  const totalSearchPages = Math.max(1, Math.ceil(venues.length / searchPageSize));
  const pagedSearchVenues = useMemo(() => {
    const start = (searchPage - 1) * searchPageSize;
    return venues.slice(start, start + searchPageSize);
  }, [venues, searchPage]);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!token) {
        setFavoriteKeys(new Set());
        return;
      }
      try {
        const response = await axios.get(`${apiUrl}/users/favorites`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const nextKeys = new Set(
          (response.data?.favorites || []).map(
            (item) => `${item.itemType}:${item.itemId}`
          )
        );
        setFavoriteKeys(nextKeys);
      } catch (error) {
        console.error('Failed to fetch favorites:', error);
      }
    };

    fetchFavorites();
  }, [apiUrl, token]);

  useEffect(() => {
    let isMounted = true;

    const loadFilterOptions = async () => {
      setLoadingFilters(true);
      setFilterError('');

      try {
        const [categoryData, wardData, serviceData] = await Promise.all([
          fetchPlaceCategories(),
          fetchWards({ summary: 'true' }),
          fetchMerchantServices()
        ]);

        if (!isMounted) {
          return;
        }

        setCategories(
          Array.isArray(categoryData)
            ? categoryData.filter((category) => category.is_active !== false)
            : []
        );
        setWards(Array.isArray(wardData) ? wardData : []);
        setServices(
          Array.isArray(serviceData)
            ? serviceData.filter((service) => service.is_active !== false)
            : []
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFilterError(error.response?.data?.message || 'Unable to load filter options right now.');
        setCategories([]);
        setWards([]);
        setServices([]);
      } finally {
        if (isMounted) {
          setLoadingFilters(false);
        }
      }
    };

    loadFilterOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadVenues = async () => {
      setLoadingVenues(true);
      setVenueError('');

      try {
        const venueData = await fetchVenues({ ...venueParams, compact: 'true' });

        if (!isMounted) {
          return;
        }

        setVenues(Array.isArray(venueData) ? venueData : []);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setVenueError(error.response?.data?.message || 'Unable to load venues right now.');
        setVenues([]);
      } finally {
        if (isMounted) {
          setLoadingVenues(false);
        }
      }
    };

    loadVenues();

    return () => {
      isMounted = false;
    };
  }, [venueParams]);

  useEffect(() => {
    let pollingInFlight = false;

    const intervalId = window.setInterval(async () => {
      if (pollingInFlight) {
        return;
      }

      pollingInFlight = true;

      try {
        const liveVenueData = await fetchVenues({ ...venueParams, compact: 'true', live: 'true' });
        setVenues(Array.isArray(liveVenueData) ? liveVenueData : []);
      } catch {
        // Keep currently rendered venue list on transient polling errors.
      } finally {
        pollingInFlight = false;
      }
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [venueParams]);

  useEffect(() => {
    setSearchPage(1);
  }, [submittedSearch]);

  useEffect(() => {
    if (activeFilterCount === 0) {
      setSearchTriggered(false);
    }
  }, [activeFilterCount]);

  const isFavorite = (itemType, itemId) => favoriteKeys.has(`${itemType}:${itemId}`);

  const handleToggleFavorite = async (item, itemType) => {
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const response = await axios.post(
        `${apiUrl}/users/favorites/toggle`,
        {
          itemId: item.id,
          itemType,
          name: item.name,
          image: item.image,
          price: item.price,
          description: item.description
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const key = `${itemType}:${item.id}`;
      setFavoriteKeys((prev) => {
        const next = new Set(prev);
        if (response.data?.favorited) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const toggleCategorySelection = (categoryId) => {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((item) => item !== categoryId)
        : [...current, categoryId]
    );
  };

  const toggleWardSelection = (wardId) => {
    setSelectedWardIds((current) =>
      current.includes(wardId)
        ? current.filter((item) => item !== wardId)
        : [...current, wardId]
    );
  };

  const toggleServiceSelection = (serviceId) => {
    setSelectedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((item) => item !== serviceId)
        : [...current, serviceId]
    );
  };

  const applySearch = () => {
    setSubmittedSearch(searchInput.trim());
    setAppliedCategoryIds(selectedCategoryIds);
    setAppliedWardIds(selectedWardIds);
    setAppliedServiceIds(selectedServiceIds);
    setSearchTriggered(true);
    setShowFilterPanel(false);
  };

  const clearAllFilters = () => {
    setSelectedCategoryIds([]);
    setSelectedWardIds([]);
    setSelectedServiceIds([]);
    setAppliedCategoryIds([]);
    setAppliedWardIds([]);
    setAppliedServiceIds([]);
    setSearchInput('');
    setSubmittedSearch('');
    setSearchTriggered(false);
  };

  // retrieve user's location and (dummy) weather
  useEffect(() => {
    if (!navigator.geolocation) return;
    const weatherLabel = translations[language]?.weather?.sunny || 'Sunny';
    navigator.geolocation.getCurrentPosition(() => {
      setCurrentLocation('Da Nang, Sơn Trà');
      setCurrentWeather(`29°C, ${weatherLabel}`);
    });
  }, [language]);

  const handlePickImage = (source) => {
    setImageError('');
    if (source === 'library') {
      libraryInputRef.current?.click();
    } else {
      cameraInputRef.current?.click();
    }
  };

  const handleImageSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError(language === 'en' ? 'Please choose an image file.' : 'Vui lòng chọn tệp hình ảnh.');
      event.target.value = '';
      return;
    }
    setSelectedImage(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setShowImageSearch(true);
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setPreviewUrl('');
    setImageError('');
    if (libraryInputRef.current) libraryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleExploreVenue = (venue) => {
    navigate('/discovery', {
      state: {
        focusVenueId: venue.id
      }
    });
  };

  const registerSliderRef = (sectionId) => (node) => {
    if (!node) {
      sliderRefs.current.delete(sectionId);
      return;
    }
    sliderRefs.current.set(sectionId, node);
  };

  const scrollCategorySlider = (sectionId, direction) => {
    const node = sliderRefs.current.get(sectionId);
    if (!node) return;
    const distance = Math.max(260, node.clientWidth * 0.85) * direction;
    const targetLeft = node.scrollLeft + distance;
    const startLeft = node.scrollLeft;
    const delta = targetLeft - startLeft;
    const duration = 520;
    let startTime = null;

    const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const step = (timestamp) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      node.scrollLeft = startLeft + delta * easeInOut(progress);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  };

  return (
    <div className={`overview-page ${isSearchMode ? 'is-search' : ''}`.trim()}>
      {!isSearchMode && (
        <section className="overview-hero">
          <div className="overview-hero-visual">
            <div className="overview-hero-plate">
              <img
                src="https://media.discordapp.net/attachments/1480399002565349536/1481206693173137470/anh_myquang.png?ex=69b3ca3b&is=69b278bb&hm=106ee06cafe406d8b99a675fea25f705d570ea648443a19d7c29fba2b87ec3f6&=&format=webp&quality=lossless&width=988&height=859"
                alt="Asian food bowl"
                className="overview-hero-image"
              />
            </div>

            <div className="overview-hero-float overview-hero-float-top">
              <img
                src="https://images.unsplash.com/photo-1523906630133-f6934a1ab2b9?auto=format&fit=crop&w=400&q=80"
                alt="Dragon Bridge"
              />
            </div>

            <div className="overview-hero-float overview-hero-float-bottom-left">
              <img
                src="https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80"
                alt="Food side dish"
              />
            </div>

            <div className="overview-hero-float overview-hero-float-bottom-right">
              <img
                src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=80"
                alt="Ba Na Hills"
              />
            </div>
          </div>

          <button type="button" className="overview-hero-arrow" aria-label="Explore more" />

          <div className="overview-hero-copy">
            <p className="overview-hero-kicker">{t.hero.kicker}</p>
            {renderHighlightedTitle(t.hero.title)}
            <p>
              {t.hero.description}
            </p>

            <div className="overview-hero-actions">
              <button 
                type="button" 
                className="overview-hero-button overview-hero-button-primary"
                onClick={() => setShowImageSearch(true)}
              >
                {t.hero.findByPictures}
              </button>
              <button 
                type="button" 
                className="overview-hero-button overview-hero-button-secondary"
                onClick={() => navigate('/merchant')}
              >
                {t.hero.merchant}
              </button>
            </div>
          </div>
        </section>
      )}

      {showImageSearch && (
        <div className="overview-image-overlay" onClick={closeImageModal}>
          <div className="overview-image-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="overview-image-close"
              aria-label="Close image search"
              onClick={closeImageModal}
            >
              ×
            </button>
            <div className="overview-image-search-panel">
              <div className="overview-image-search-actions">
                <button
                  type="button"
                  className="overview-image-button library"
                  onClick={() => handlePickImage('library')}
                >
                  {t.hero.chooseFromLibrary}
                </button>
                <button
                  type="button"
                  className="overview-image-button camera"
                  onClick={() => handlePickImage('camera')}
                >
                  {t.hero.takeNewPhoto}
                </button>
              </div>

              <input
                ref={libraryInputRef}
                type="file"
                accept="image/*"
                className="overview-image-input"
                onChange={handleImageSelected}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="overview-image-input"
                onChange={handleImageSelected}
              />

              {previewUrl && (
                <div className="overview-image-preview">
                  <div className="overview-image-thumb">
                    <img src={previewUrl} alt={t.hero.selectedImage} />
                    <button type="button" className="overview-image-remove" onClick={clearSelectedImage} aria-label={t.hero.removeImage}>
                      −
                    </button>
                  </div>
                  <button
                    type="button"
                    className="overview-image-find"
                    disabled={!selectedImage}
                    onClick={() => {/* hook up real search later */}}
                  >
                    {t.hero.findAction}
                  </button>
                </div>
              )}

              {imageError && <div className="overview-image-error">{imageError}</div>}
            </div>
          </div>
        </div>
      )}

      <section className={`overview-search ${isSearchMode ? 'is-searching' : ''}`.trim()}>
        <div className="overview-search-top">
          <div className="overview-search-headline">
            <h2>Explore with live filters</h2>
            <p>Search by place categories, ward naming, and merchant services.</p>
          </div>

          {currentLocation && currentWeather && (
            <div className="overview-location-info overview-location-inline">
              <span className="overview-location-text">{currentLocation}</span>
              <span className="overview-weather">
                {(currentWeather.includes(t.weather.sunny) || currentWeather.includes(t.weather.clear)) && '☀️'}
                {currentWeather.includes(t.weather.rainy) && '🌧️'}
                {currentWeather.includes(t.weather.cloudy) && '☁️'}
                {!(currentWeather.includes(t.weather.sunny) || currentWeather.includes(t.weather.clear) || currentWeather.includes(t.weather.rainy) || currentWeather.includes(t.weather.cloudy)) && '🌡️'}
                {currentWeather}
              </span>
            </div>
          )}
        </div>

        <div className="overview-search-row">
          <label className="overview-address-field">
            <span className="overview-address-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search venue name, address, ward, or service"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applySearch();
                }
              }}
            />
          </label>

          <button type="button" className="overview-search-submit" onClick={applySearch}>
            Search
          </button>

          <button
            type="button"
            className={`overview-search-filter ${showFilterPanel ? 'is-active' : ''}`}
            onClick={() => setShowFilterPanel((current) => !current)}
          >
            Filter
          </button>

          {/* AI suggestion button */}
          <button
            type="button"
            className="overview-search-ai"
            aria-label={t.search.aiSuggest}
            onClick={() => alert('AI suggestion not implemented yet')}
          >
            {t.search.aiSuggest}
          </button>
        </div>

        {activeFilterCount > 0 ? (
          <div className="overview-active-filters">
            <span>{activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active</span>
            <button type="button" onClick={clearAllFilters}>
              Clear all
            </button>
          </div>
        ) : null}

        {showFilterPanel ? (
          <div className="overview-filter-panel" role="region" aria-label="Filter options">
            <FilterGroup
              title="Place Categories"
              options={categories}
              selectedValues={selectedCategoryIds}
              optionValue={(category) => Number(category.id)}
              optionLabel={(category) => category.name}
              onToggle={toggleCategorySelection}
            />

            <FilterGroup
              title="Ward Naming"
              options={wards}
              selectedValues={selectedWardIds}
              optionValue={(ward) => String(ward.ward_id)}
              optionLabel={(ward) => ward.name}
              onToggle={toggleWardSelection}
            />

            <FilterGroup
              title="Services Offered - Merchant"
              options={services}
              selectedValues={selectedServiceIds}
              optionValue={(service) => Number(service.id)}
              optionLabel={(service) => service.name}
              onToggle={toggleServiceSelection}
            />

            {loadingFilters ? <p className="overview-empty-copy">Loading filter options...</p> : null}
            {filterError ? <p className="overview-inline-error">{filterError}</p> : null}
          </div>
        ) : null}
      </section>

      {isSearchMode ? (
        <section className="overview-section overview-search-result-section">
          <div className="overview-section-heading">
            <h2>Search Results</h2>
            <span />
            <p className="overview-section-subcopy">
              Results for "{submittedSearch.trim()}" ({venues.length})
            </p>
          </div>

          {venueError ? <p className="overview-inline-error">{venueError}</p> : null}

          <div className="overview-search-results">
            <div className="overview-dynamic-grid overview-search-grid">
              {pagedSearchVenues.map((venue) => (
                <VenueCard
                  key={`search-${venue.id}`}
                  venue={venue}
                  isFavorite={isFavorite('place', venue.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onExplore={handleExploreVenue}
                  services={getVenueServices(venue, serviceNameById)}
                />
              ))}
            </div>

            <div className="overview-pagination">
              <button
                type="button"
                className="overview-pagination-btn"
                disabled={searchPage === 1}
                onClick={() => setSearchPage((prev) => Math.max(1, prev - 1))}
              >
                Prev
              </button>
              {Array.from({ length: totalSearchPages }).map((_, index) => {
                const page = index + 1;
                return (
                  <button
                    key={`search-page-${page}`}
                    type="button"
                    className={`overview-pagination-btn ${page === searchPage ? 'is-active' : ''}`.trim()}
                    onClick={() => setSearchPage(page)}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                type="button"
                className="overview-pagination-btn"
                disabled={searchPage === totalSearchPages}
                onClick={() => setSearchPage((prev) => Math.min(totalSearchPages, prev + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="overview-section">
          <div className="overview-section-heading">
            <h2>Dynamic Category Showcase</h2>
            <span />
            <p className="overview-section-subcopy">
              {loadingVenues
                ? 'Loading approved venues...'
                : `${venues.length} approved venue${venues.length === 1 ? '' : 's'} matched your filters.`}
            </p>
          </div>

          {venueError ? <p className="overview-inline-error">{venueError}</p> : null}

          {!loadingVenues && !venueError && !categorySections.length && !uncategorizedVenues.length ? (
            <p className="overview-empty-copy">No approved venues match your current filters.</p>
          ) : null}

          <div className="overview-category-sections">
            {categorySections.map((section) => (
              <article key={`category-section-${section.id}`} className="overview-category-block">
                <header className="overview-category-block-header">
                  <div>
                    <h3>{section.name}</h3>
                    <p>
                      {section.description ||
                        `${section.venues.length} approved venue${section.venues.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  <span>{section.venues.length}</span>
                </header>

                {section.venues.length ? (
                  <div className="overview-category-board">
                    <button
                      type="button"
                      className="overview-slider-btn prev"
                      aria-label={`Scroll ${section.name} left`}
                      onClick={() => scrollCategorySlider(section.id, -1)}
                    />
                    <div
                      className="overview-dynamic-grid overview-dynamic-grid-slider"
                      ref={registerSliderRef(section.id)}
                    >
                      {section.venues.slice(0, 12).map((venue) => (
                        <VenueCard
                          key={`venue-${section.id}-${venue.id}`}
                          venue={venue}
                          isFavorite={isFavorite('place', venue.id)}
                          onToggleFavorite={handleToggleFavorite}
                          onExplore={handleExploreVenue}
                          services={getVenueServices(venue, serviceNameById)}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="overview-slider-btn next"
                      aria-label={`Scroll ${section.name} right`}
                      onClick={() => scrollCategorySlider(section.id, 1)}
                    />
                  </div>
                ) : (
                  <p className="overview-empty-copy">No approved places in this category yet.</p>
                )}
              </article>
            ))}

            {!selectedCategoryIds.length && uncategorizedVenues.length ? (
              <article className="overview-category-block">
                <header className="overview-category-block-header">
                  <div>
                    <h3>Other Places</h3>
                    <p>Approved venues that are not linked to a place category yet.</p>
                  </div>
                  <span>{uncategorizedVenues.length}</span>
                </header>

                <div className="overview-category-board">
                  <button
                    type="button"
                    className="overview-slider-btn prev"
                    aria-label="Scroll other places left"
                    onClick={() => scrollCategorySlider('uncategorized', -1)}
                  />
                  <div
                    className="overview-dynamic-grid overview-dynamic-grid-slider"
                    ref={registerSliderRef('uncategorized')}
                  >
                    {uncategorizedVenues.slice(0, 12).map((venue) => (
                      <VenueCard
                        key={`uncategorized-${venue.id}`}
                        venue={venue}
                        isFavorite={isFavorite('place', venue.id)}
                        onToggleFavorite={handleToggleFavorite}
                        onExplore={handleExploreVenue}
                        services={getVenueServices(venue, serviceNameById)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="overview-slider-btn next"
                    aria-label="Scroll other places right"
                    onClick={() => scrollCategorySlider('uncategorized', 1)}
                  />
                </div>
              </article>
            ) : null}
          </div>
        </section>
      )}

      {!isSearchMode && (
        <section className="overview-section overview-map-section">
          <div className="overview-section-heading">
            <h2>City map</h2>
            <span />
          </div>

          <OverviewCityMapCard />
        </section>
      )}
    </div>
  );
}

export default OverviewPage;
