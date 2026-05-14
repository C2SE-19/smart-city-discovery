import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';
import useUserI18n from '../../hooks/useUserI18n';
import {
  formatCurrencyVnd,
  getPackageDurationMeta,
  getTierMeta,
} from '../../services/adPackageStorage';
import {
  assignAdPackageToVenue,
  fetchMerchantAdPackageTransactions,
  fetchPublicAdPackages,
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

function buildBenefitRows(features = {}, tx) {
  const items = [];

  if (features.showInTrending) {
    const details = [];

    const displayHours = Number(features.trendDisplayHours);
    if (Number.isFinite(displayHours) && displayHours > 0) {
      details.push(tx('Visible for {{hours}} hour(s) per push', { hours: displayHours }));
    }

    const pushLimit = Number(features.trendPushLimit);
    if (Number.isFinite(pushLimit) && pushLimit > 0) {
      details.push(
        tx(pushLimit === 1 ? '{{count}} push included' : '{{count}} pushes included', {
          count: pushLimit,
        })
      );
    }

    items.push({
      label: tx('Displayed in Trending blocks'),
      details,
    });
  }

  if (features.showOnHomepageBanner) {
    items.push({
      label: tx('Show a HOT badge on promoted posts'),
      details: [],
    });
  }

  if (features.priorityReview) {
    items.push({
      label: tx('Priority moderation queue'),
      details: [],
    });
  }

  if (features.postLimitEnabled) {
    const postLimit = Number(features.postLimit);
    if (Number.isFinite(postLimit) && postLimit > 0) {
      items.push({
        label: tx('Maximum promoted posts: {{count}}', { count: postLimit }),
        details: [],
      });
    }
  }

  if (!items.length) {
    return [{
      label: tx('Base distribution settings'),
      details: [],
    }];
  }

  return items;
}

function MerchantAdPackagesSelectionPage() {
  const { language, tx } = useUserI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const venueId = Number(params.venueId);
  const openedFromVenueName = String(location.state?.venueName || '').trim();

  const [packages, setPackages] = useState([]);
  const [accountSummary, setAccountSummary] = useState({});
  const [packageTransactions, setPackageTransactions] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [assigningPackageId, setAssigningPackageId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [notice, setNotice] = useState('');

  const loadPageData = useCallback(async () => {
    setLoadingPackages(true);
    setLoadError('');

    try {
      const [packageResult, transactionResult] = await Promise.allSettled([
        fetchPublicAdPackages(),
        fetchMerchantAdPackageTransactions(),
      ]);

      if (packageResult.status !== 'fulfilled') {
        throw packageResult.reason;
      }

      const packageRows = Array.isArray(packageResult.value) ? packageResult.value : [];
      const nextSummary = transactionResult.status === 'fulfilled'
        ? (transactionResult.value?.summary || {})
        : {};
      const nextTransactions = transactionResult.status === 'fulfilled'
        ? (Array.isArray(transactionResult.value?.transactions) ? transactionResult.value.transactions : [])
        : [];

      setPackages(packageRows);
      setAccountSummary(nextSummary);
      setPackageTransactions(nextTransactions);
      setSelectedPackageId(nextSummary?.activePackage?.id ? String(nextSummary.activePackage.id) : '');
      setNotice('');

      if (transactionResult.status !== 'fulfilled') {
        setNotice(tx('Packages are available. Account summary is temporarily unavailable, but you can still purchase a package.'));
      }
    } catch (error) {
      setNotice('');
      setLoadError(error.response?.data?.message || tx('Could not load ad packages right now.'));
      setPackages([]);
      setAccountSummary({});
      setPackageTransactions([]);
      setSelectedPackageId('');
    } finally {
      setLoadingPackages(false);
    }
  }, [tx]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    const handleFocusRefresh = () => {
      loadPageData();
    };

    window.addEventListener('focus', handleFocusRefresh);
    return () => {
      window.removeEventListener('focus', handleFocusRefresh);
    };
  }, [loadPageData]);

  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === selectedPackageId) || null,
    [packages, selectedPackageId]
  );
  const activeTransactionByPackageId = useMemo(() => {
    const nextMap = new Map();

    packageTransactions.forEach((transaction) => {
      const packageId = String(transaction?.package?.id || '').trim();
      if (!packageId || transaction?.isCancelled || transaction?.isFailed) {
        return;
      }

      if (transaction?.isPaid && transaction?.isExpired) {
        return;
      }

      if (transaction?.isPending && transaction?.isCheckoutExpired) {
        return;
      }

      if (!nextMap.has(packageId)) {
        nextMap.set(packageId, transaction);
      }
    });

    return nextMap;
  }, [packageTransactions]);

  const coveredVenueCount = Number(accountSummary?.coveredVenueCount || 0);
  const hasEntryVenueId = Number.isFinite(venueId) && venueId > 0;

  const handleBackToPosts = () => {
    navigate(APP_ROUTES.MERCHANT_POSTS);
  };

  const handleSelectPackage = async (packageId) => {
    setAssigningPackageId(packageId);
    setLoadError('');
    setNotice('');

    try {
      const result = await assignAdPackageToVenue(
        packageId,
        hasEntryVenueId ? { venueId } : {}
      );

      if (result?.checkoutUrl) {
        setNotice(
          result?.existingPending
            ? tx('A pending checkout already exists for this package. Redirecting you back to the payment page...')
            : tx('Redirecting to the secure payment page...')
        );
        window.location.href = result.checkoutUrl;
        return;
      }

      await loadPageData();
      setNotice(tx('We created the package order, but the checkout link is unavailable right now.'));
    } catch (error) {
      setLoadError(error.response?.data?.message || tx('Could not start payment for this package right now. Please try again.'));
    } finally {
      setAssigningPackageId('');
    }
  };

  return (
    <section className="merchant-ad-packages-page">
      <header className="merchant-ad-packages-header">
        <div>
          <p className="merchant-ad-packages-kicker">{tx('Account Advertising')}</p>
          <h1>{tx('Choose an Advertising Package')}</h1>
          <p>{tx('Select one package for your whole merchant account.')}</p>
          <p className="merchant-ad-account-copy">
            {tx('The package becomes active for all current and future venues in this merchant account only after successful payment.')}
          </p>
          {openedFromVenueName ? (
            <p className="merchant-ad-account-copy">
              {tx('Opened from {{venueName}}. The selected package still applies account-wide.', {
                venueName: openedFromVenueName,
              })}
            </p>
          ) : null}
        </div>

        <button type="button" className="merchant-ad-back-button" onClick={handleBackToPosts}>
          {tx('Back to posts')}
        </button>
      </header>

      {notice ? <p className="merchant-ad-selection-notice">{notice}</p> : null}

      {selectedPackage ? (
        <section className="merchant-ad-current-package">
          <div>
            <span className="merchant-ad-current-kicker">{tx('Current account package')}</span>
            <strong>{selectedPackage.name}</strong>
            <p>{tx('This package currently covers {{count}} venue(s) in your account.', { count: coveredVenueCount })}</p>
            <p className="merchant-ad-current-price">
              {formatCurrencyVnd(selectedPackage.discountedPrice || selectedPackage.price)}
            </p>
          </div>
          <span className="merchant-ad-scope-pill">
            {accountSummary?.appliesToAllVenues ? tx('Account-wide') : tx('Package active')}
          </span>
        </section>
      ) : null}

      {loadError ? (
        <div className="merchant-ad-empty-state">
          <h2>{tx('Could not load packages')}</h2>
          <p>{loadError}</p>
          <button type="button" className="merchant-ad-back-button" onClick={loadPageData}>
            {tx('Retry')}
          </button>
        </div>
      ) : null}

      {!loadError && loadingPackages ? (
        <div className="merchant-ad-empty-state">
          <h2>{tx('Loading packages...')}</h2>
          <p>{tx('Please wait while we fetch available advertising plans.')}</p>
        </div>
      ) : null}

      {!loadError && !loadingPackages && packages.length === 0 ? (
        <div className="merchant-ad-empty-state">
          <h2>{tx('No package is available yet')}</h2>
          <p>{tx('Ask an admin to create ad packages in the Admin Ad Packages workspace.')}</p>
          <button type="button" className="merchant-ad-back-button" onClick={handleBackToPosts}>
            {tx('Return to manage posts')}
          </button>
        </div>
      ) : null}

      {!loadError && !loadingPackages && packages.length > 0 ? (
        <div className="merchant-ad-packages-grid">
          {packages.map((packageItem) => {
            const tierMeta = getTierMeta(packageItem.tier);
            const tierCopy = TIER_COPY[packageItem.tier] || TIER_COPY.basic;
            const durationMeta = getPackageDurationMeta(packageItem.durationMonths);
            const benefitRows = buildBenefitRows(packageItem.features, tx);
            const isSelected = selectedPackageId === packageItem.id;
            const relatedTransaction = activeTransactionByPackageId.get(String(packageItem.id)) || null;
            const hasOpenPaidPurchase = Boolean(relatedTransaction?.isPaid && !relatedTransaction?.isExpired);
            const canContinueCheckout = Boolean(relatedTransaction?.isPending && !relatedTransaction?.isCheckoutExpired);
            const discountedPrice = Number(packageItem.discountedPrice || packageItem.price || 0);
            const hasDiscount = Number(packageItem.discountPercent || 0) > 0 && discountedPrice < Number(packageItem.price || 0);

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
                  {tierCopy.ribbon ? <span className="merchant-ad-ribbon">{tx(tierCopy.ribbon)}</span> : null}
                  <p className="merchant-ad-tier-label">{tx('Package')}</p>
                  <h2>{packageItem.name}</h2>
                  <p className="merchant-ad-price">{formatCurrencyVnd(discountedPrice)}</p>
                  {hasDiscount ? (
                    <p className="merchant-ad-card-note">
                      {tx('Original price {{price}} with {{discount}}% discount.', {
                        price: formatCurrencyVnd(packageItem.price),
                        discount: packageItem.discountPercent,
                      })}
                    </p>
                  ) : null}
                  <span className="merchant-ad-impact-tag">{tx(tierCopy.line)}</span>
                  <p className="merchant-ad-impact-copy">{tx(tierCopy.support)}</p>
                  <p className="merchant-ad-duration-copy">
                    {tx('Active for')} <strong>{durationMeta.days}</strong> {tx('days')} ({durationMeta.label})
                  </p>
                </div>

                <div className="merchant-ad-package-body">
                  <h3>{tx('Package benefits')}</h3>
                  <ul>
                    {benefitRows.map((benefit) => (
                      <li key={`${packageItem.id}-${benefit.label}`} className="merchant-ad-benefit-item">
                        <span className="merchant-ad-benefit-label">{benefit.label}</span>
                        {benefit.details?.length ? (
                          <div className="merchant-ad-benefit-details">
                            {benefit.details.map((detail) => (
                              <span key={`${packageItem.id}-${benefit.label}-${detail}`} className="merchant-ad-benefit-detail">
                                {detail}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className="merchant-ad-select-button"
                    disabled={assigningPackageId === packageItem.id || isSelected || hasOpenPaidPurchase}
                    onClick={() => handleSelectPackage(packageItem.id)}
                  >
                    {assigningPackageId === packageItem.id
                      ? tx('Preparing checkout...')
                      : isSelected
                        ? tx('Current account package')
                        : canContinueCheckout
                          ? tx('Continue payment')
                          : hasOpenPaidPurchase
                          ? tx('Already purchased')
                          : tx('Buy for this account')}
                  </button>

                  {canContinueCheckout ? (
                    <p className="merchant-ad-card-note">
                      {tx('A payment session is still open for this package. You can continue from the latest checkout page.')}
                    </p>
                  ) : null}

                  {hasOpenPaidPurchase && !isSelected ? (
                    <p className="merchant-ad-card-note">
                      {tx('This package is already paid in your account. You can switch to it later from Transaction History.')}
                    </p>
                  ) : null}
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
