import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';
import { formatCurrencyVnd } from '../../services/adPackageStorage';
import { fetchMerchantAdPackageCheckoutStatus } from '../../services/api/adPackagesApi';
import './MerchantAdCheckoutResultPage.css';

function formatDateTime(value) {
  if (!value) {
    return 'N/A';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A';
  }

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveResultTone(queryStatus, purchase) {
  if (purchase?.paymentStatus === 'paid') {
    return 'success';
  }

  if (purchase?.paymentStatus === 'cancelled' || queryStatus === 'CANCELLED') {
    return 'cancelled';
  }

  if (purchase?.paymentStatus === 'failed') {
    return 'failed';
  }

  return 'pending';
}

function MerchantAdCheckoutResultPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchase, setPurchase] = useState(null);

  const transactionId = searchParams.get('transactionId');
  const payosStatus = searchParams.get('status');
  const payosOrderCode = searchParams.get('orderCode');
  const payosLinkId = searchParams.get('id');

  const loadCheckoutStatus = useCallback(async () => {
    if (!transactionId) {
      setLoading(false);
      setError('Missing checkout transaction information.');
      setPurchase(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await fetchMerchantAdPackageCheckoutStatus(transactionId);
      setPurchase(result?.purchase || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not verify the payment result right now.');
      setPurchase(null);
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    loadCheckoutStatus();
  }, [loadCheckoutStatus]);

  const tone = useMemo(
    () => resolveResultTone(payosStatus, purchase),
    [payosStatus, purchase]
  );

  const toneCopy = {
    success: {
      eyebrow: 'Payment confirmed',
      title: 'Your advertising package is now active',
      body: 'PayOS confirmed the payment successfully. This package is already covering your merchant account.',
    },
    pending: {
      eyebrow: 'Waiting for confirmation',
      title: 'The payment is still being processed',
      body: 'Please complete the transfer on PayOS, then refresh this page. The package will activate only after confirmation.',
    },
    cancelled: {
      eyebrow: 'Checkout cancelled',
      title: 'The payment was not completed',
      body: 'The checkout was cancelled before payment confirmation. You can return to the package list and start again.',
    },
    failed: {
      eyebrow: 'Payment failed',
      title: 'This package has not been activated',
      body: 'We could not confirm the payment for this checkout. Please start a new purchase if you still want to use this package.',
    },
  };

  const activeCopy = toneCopy[tone] || toneCopy.pending;

  return (
    <section className={`merchant-checkout-result merchant-checkout-result--${tone}`}>
      <div className="merchant-checkout-result-card">
        <p className="merchant-checkout-result-kicker">{activeCopy.eyebrow}</p>
        <h1>{activeCopy.title}</h1>
        <p className="merchant-checkout-result-copy">{activeCopy.body}</p>

        {error ? (
          <div className="merchant-checkout-result-alert is-error">
            <strong>Verification error</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="merchant-checkout-result-alert">
            <strong>Verifying payment</strong>
            <span>Please wait while we sync the latest status from PayOS.</span>
          </div>
        ) : null}

        {!loading && purchase ? (
          <div className="merchant-checkout-result-grid">
            <article>
              <span>Package</span>
              <strong>{purchase?.package?.name || 'Advertising package'}</strong>
            </article>
            <article>
              <span>Amount</span>
              <strong>{formatCurrencyVnd(purchase?.paymentAmount || purchase?.package?.price || 0)}</strong>
            </article>
            <article>
              <span>Payment status</span>
              <strong>{String(purchase?.paymentStatus || 'pending_payment').replace('_', ' ')}</strong>
            </article>
            <article>
              <span>Confirmed at</span>
              <strong>{formatDateTime(purchase?.paidAt || purchase?.paymentConfirmedAt)}</strong>
            </article>
            <article>
              <span>Package expires</span>
              <strong>{formatDateTime(purchase?.expiresAt)}</strong>
            </article>
            <article>
              <span>Order code</span>
              <strong>{purchase?.payosOrderCode || payosOrderCode || payosLinkId || 'N/A'}</strong>
            </article>
          </div>
        ) : null}

        <div className="merchant-checkout-result-actions">
          {purchase?.paymentStatus === 'pending_payment' && purchase?.payosCheckoutUrl ? (
            <button
              type="button"
              className="merchant-checkout-result-primary"
              onClick={() => {
                window.location.href = purchase.payosCheckoutUrl;
              }}
            >
              Continue payment
            </button>
          ) : null}

          <button
            type="button"
            className="merchant-checkout-result-secondary"
            onClick={loadCheckoutStatus}
            disabled={loading || !transactionId}
          >
            {loading ? 'Refreshing...' : 'Refresh status'}
          </button>

          <Link to={APP_ROUTES.MERCHANT_TRANSACTIONS} className="merchant-checkout-result-link">
            Go to Transaction History
          </Link>

          <Link to={APP_ROUTES.MERCHANT_POST_ADVERTISE} className="merchant-checkout-result-link">
            Browse packages
          </Link>
        </div>
      </div>
    </section>
  );
}

export default MerchantAdCheckoutResultPage;
