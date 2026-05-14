import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';
import useUserI18n from '../../hooks/useUserI18n';
import { formatCurrencyVnd } from '../../services/adPackageStorage';
import { fetchMerchantAdPackageCheckoutStatus } from '../../services/api/adPackagesApi';
import './MerchantAdCheckoutResultPage.css';

function formatDateTime(value, locale, tx) {
  if (!value) {
    return tx('N/A');
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return tx('N/A');
  }

  return parsed.toLocaleString(locale, {
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
  const { locale, tx } = useUserI18n();
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
      setError(tx('Missing checkout transaction information.'));
      setPurchase(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await fetchMerchantAdPackageCheckoutStatus(transactionId);
      setPurchase(result?.purchase || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || tx('Could not verify the payment result right now.'));
      setPurchase(null);
    } finally {
      setLoading(false);
    }
  }, [transactionId, tx]);

  useEffect(() => {
    loadCheckoutStatus();
  }, [loadCheckoutStatus]);

  const tone = useMemo(
    () => resolveResultTone(payosStatus, purchase),
    [payosStatus, purchase]
  );

  const toneCopy = {
    success: {
      eyebrow: tx('Payment confirmed'),
      title: tx('Your advertising package is now active'),
      body: tx('PayOS confirmed the payment successfully. This package is already covering your merchant account.'),
    },
    pending: {
      eyebrow: tx('Waiting for confirmation'),
      title: tx('The payment is still being processed'),
      body: tx('Please complete the transfer on PayOS, then refresh this page. The package will activate only after confirmation.'),
    },
    cancelled: {
      eyebrow: tx('Checkout cancelled'),
      title: tx('The payment was not completed'),
      body: tx('The checkout was cancelled before payment confirmation. You can return to the package list and start again.'),
    },
    failed: {
      eyebrow: tx('Payment failed'),
      title: tx('This package has not been activated'),
      body: tx('We could not confirm the payment for this checkout. Please start a new purchase if you still want to use this package.'),
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
            <strong>{tx('Verification error')}</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="merchant-checkout-result-alert">
            <strong>{tx('Verifying payment')}</strong>
            <span>{tx('Please wait while we sync the latest status from PayOS.')}</span>
          </div>
        ) : null}

        {!loading && purchase ? (
          <div className="merchant-checkout-result-grid">
            <article>
              <span>{tx('Package')}</span>
              <strong>{purchase?.package?.name || tx('Advertising package')}</strong>
            </article>
            <article>
              <span>{tx('Amount')}</span>
              <strong>{formatCurrencyVnd(purchase?.paymentAmount || purchase?.package?.price || 0)}</strong>
            </article>
            <article>
              <span>{tx('Payment status')}</span>
              <strong>{tx(String(purchase?.paymentStatus || 'pending payment').replace('_', ' '))}</strong>
            </article>
            <article>
              <span>{tx('Confirmed at')}</span>
              <strong>{formatDateTime(purchase?.paidAt || purchase?.paymentConfirmedAt, locale, tx)}</strong>
            </article>
            <article>
              <span>{tx('Package expires')}</span>
              <strong>{formatDateTime(purchase?.expiresAt, locale, tx)}</strong>
            </article>
            <article>
              <span>{tx('Order code')}</span>
              <strong>{purchase?.payosOrderCode || payosOrderCode || payosLinkId || tx('N/A')}</strong>
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
              {tx('Continue payment')}
            </button>
          ) : null}

          <button
            type="button"
            className="merchant-checkout-result-secondary"
            onClick={loadCheckoutStatus}
            disabled={loading || !transactionId}
          >
            {loading ? tx('Refreshing...') : tx('Refresh status')}
          </button>

          <Link to={APP_ROUTES.MERCHANT_TRANSACTIONS} className="merchant-checkout-result-link">
            {tx('Go to Transaction History')}
          </Link>

          <Link to={APP_ROUTES.MERCHANT_POST_ADVERTISE} className="merchant-checkout-result-link">
            {tx('Browse packages')}
          </Link>
        </div>
      </div>
    </section>
  );
}

export default MerchantAdCheckoutResultPage;
