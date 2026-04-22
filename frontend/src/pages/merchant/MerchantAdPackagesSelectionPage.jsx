import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';
import {
  getAdPackageSelectionByVenue,
  getPackageDurationMeta,
  getTierMeta,
  saveAdPackageSelection,
} from '../../services/adPackageStorage';
import {
  assignAdPackageToVenue,
  fetchPublicAdPackages,
  fetchVenueAdPackageAssignment,
} from '../../services/api/adPackagesApi';
import './MerchantAdPackagesSelectionPage.css';

const TIER_COPY = {
  premium: {
    line: 'x5 Impact',
    support: 'for premium visibility campaigns',
    ribbon: '',
  },
  boosted: {
    line: 'x2.5 Impact',
    support: 'for balanced growth campaigns',
    ribbon: 'Popular',
  },
  basic: {
    line: 'Steady Impact',
    support: 'for consistent presence',
    ribbon: '',
  },
};

function buildBenefitRows(features = {}) {
  const items = [];

  if (features.showInTrending) {
    items.push('Displayed in Trending blocks');
  }

  if (features.showOnHomepageBanner) {
    items.push('Displayed on Homepage Banner');
  }

  if (features.priorityReview) {
    items.push('Priority moderation queue');
  }

  if (features.postLimitEnabled) {
    const postLimit = Number(features.postLimit);
    if (Number.isFinite(postLimit) && postLimit > 0) {
      items.push(`Maximum promoted posts: ${postLimit}`);
    }
  }

  if (!items.length) {
    return ['Base distribution settings'];
  }

  return items;
}

function MerchantAdPackagesSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const venueId = Number(params.venueId);
  const venueName = location.state?.venueName || (Number.isFinite(venueId) ? `Venue #${venueId}` : 'Selected venue');

  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [assigningPackageId, setAssigningPackageId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState(() => {
    const existingSelection = getAdPackageSelectionByVenue(venueId);
    return existingSelection?.packageId || '';
  });
  const [notice, setNotice] = useState('');

  const loadPackages = useCallback(async () => {
    setLoadingPackages(true);
    setLoadError('');

    try {
      const packageRows = await fetchPublicAdPackages();
      setPackages(Array.isArray(packageRows) ? packageRows : []);
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Could not load ad packages right now.');
    } finally {
      setLoadingPackages(false);
    }
  }, []);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const loadSelectedAssignment = useCallback(async () => {
    if (!Number.isFinite(venueId) || venueId <= 0) {
      return;
    }

    try {
      const assignment = await fetchVenueAdPackageAssignment(venueId);

      if (assignment?.package?.id) {
        setSelectedPackageId(String(assignment.package.id));
      }
    } catch {
      // Keep local selection fallback when assignment endpoint is unavailable.
    }
  }, [venueId]);

  useEffect(() => {
    loadSelectedAssignment();
  }, [loadSelectedAssignment]);

  useEffect(() => {
    const handleFocusRefresh = () => {
      loadPackages();
    };

    window.addEventListener('focus', handleFocusRefresh);
    return () => {
      window.removeEventListener('focus', handleFocusRefresh);
    };
  }, [loadPackages]);

  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === selectedPackageId) || null,
    [packages, selectedPackageId]
  );

  const handleBackToPosts = () => {
    navigate(APP_ROUTES.MERCHANT_POSTS);
  };

  const handleSelectPackage = async (packageId) => {
    setAssigningPackageId(packageId);
    setLoadError('');

    try {
      await assignAdPackageToVenue(packageId, { venueId });

      saveAdPackageSelection({
        venueId,
        packageId,
      });

      setSelectedPackageId(packageId);
      setNotice('Package assigned successfully. You can continue campaign setup for this post.');
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Could not assign this package right now. Please try again.');
    } finally {
      setAssigningPackageId('');
    }
  };

  return (
    <section className="merchant-ad-packages-page">
      <header className="merchant-ad-packages-header">
        <div>
          <p className="merchant-ad-packages-kicker">Ad Activation</p>
          <h1>Choose an Advertising Package</h1>
          <p>
            Venue: <strong>{venueName}</strong>
          </p>
        </div>

        <button type="button" className="merchant-ad-back-button" onClick={handleBackToPosts}>
          Back to posts
        </button>
      </header>

      {notice ? <p className="merchant-ad-selection-notice">{notice}</p> : null}

      {selectedPackage ? (
        <p className="merchant-ad-current-package">
          Current package for this venue: <strong>{selectedPackage.name}</strong>
        </p>
      ) : null}

      {loadError ? (
        <div className="merchant-ad-empty-state">
          <h2>Could not load packages</h2>
          <p>{loadError}</p>
          <button type="button" className="merchant-ad-back-button" onClick={loadPackages}>
            Retry
          </button>
        </div>
      ) : null}

      {!loadError && loadingPackages ? (
        <div className="merchant-ad-empty-state">
          <h2>Loading packages...</h2>
          <p>Please wait while we fetch available advertising plans.</p>
        </div>
      ) : null}

      {!loadError && !loadingPackages && packages.length === 0 ? (
        <div className="merchant-ad-empty-state">
          <h2>No package is available yet</h2>
          <p>Ask an admin to create ad packages in the Admin Ad Packages workspace.</p>
          <button type="button" className="merchant-ad-back-button" onClick={handleBackToPosts}>
            Return to manage posts
          </button>
        </div>
      ) : null}

      {!loadError && !loadingPackages && packages.length > 0 ? (
        <div className="merchant-ad-packages-grid">
          {packages.map((packageItem) => {
            const tierMeta = getTierMeta(packageItem.tier);
            const tierCopy = TIER_COPY[packageItem.tier] || TIER_COPY.basic;
            const durationMeta = getPackageDurationMeta(packageItem.durationMonths);
            const benefitRows = buildBenefitRows(packageItem.features);
            const isSelected = selectedPackageId === packageItem.id;

            return (
              <article
                key={packageItem.id}
                className={`merchant-ad-package-card ${isSelected ? 'is-selected' : ''}`.trim()}
                style={{
                  '--tier-color': tierMeta.color,
                  '--tier-soft': tierMeta.accent,
                }}
              >
                <div className="merchant-ad-package-head">
                  {tierCopy.ribbon ? <span className="merchant-ad-ribbon">{tierCopy.ribbon}</span> : null}
                  <p className="merchant-ad-tier-label">Package</p>
                  <h2>{packageItem.name}</h2>
                  <span className="merchant-ad-impact-tag">{tierCopy.line}</span>
                  <p className="merchant-ad-impact-copy">{tierCopy.support}</p>
                  <p className="merchant-ad-duration-copy">
                    Active for <strong>{durationMeta.days}</strong> days ({durationMeta.label})
                  </p>
                </div>

                <div className="merchant-ad-package-body">
                  <h3>Package benefits</h3>
                  <ul>
                    {benefitRows.map((benefit) => (
                      <li key={`${packageItem.id}-${benefit}`}>{benefit}</li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className="merchant-ad-select-button"
                    disabled={assigningPackageId === packageItem.id}
                    onClick={() => handleSelectPackage(packageItem.id)}
                  >
                    {assigningPackageId === packageItem.id
                      ? 'Assigning...'
                      : isSelected
                        ? 'Selected for this post'
                        : 'Select package'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default MerchantAdPackagesSelectionPage;
