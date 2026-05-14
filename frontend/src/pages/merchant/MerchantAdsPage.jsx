import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import translations from '../../constants/translations';
import { APP_ROUTES } from '../../constants/routes';
import useUserI18n from '../../hooks/useUserI18n';
import { formatCurrencyVnd } from '../../services/adPackageStorage';
import {
  activateMerchantAdPackageTransaction,
  deactivateMerchantAdPackageTransaction,
  deleteMerchantAdPackageTransaction,
  fetchMerchantAdPackageCheckoutStatus,
  fetchMerchantAdPackageTransactions,
} from '../../services/api/adPackagesApi';
import './MerchantDashboard.css';
import './MerchantAdsPage.css';

const MenuItems = [
  { id: 'overview', icon: '🏠', translationKey: 'overview' },
  { id: 'posts', icon: '🏪', translationKey: 'posts' },
  { id: 'transactions', icon: '📊', translationKey: 'transactions' },
  { id: 'support', icon: '💬', translationKey: 'support' },
];

function formatDateTime(value, locale = 'en-US', tx = (text) => text) {
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

function buildFeatureRows(features = {}, tx) {
  const rows = [];

  if (features.showInTrending) {
    rows.push(tx('Trending placement enabled'));
  }

  if (features.showOnHomepageBanner) {
    rows.push(tx('Featured HOT badge across listings'));
  }

  if (features.priorityReview) {
    rows.push(tx('Priority Approval for pending submissions'));
  }

  if (features.postLimitEnabled && Number(features.postLimit) > 0) {
    rows.push(tx('Post quantity limit: {{count}}', { count: Number(features.postLimit) }));
  }

  return rows.length ? rows : [tx('Standard package benefits')];
}

function formatPaymentStatus(status, tx) {
  switch (String(status || '').trim().toLowerCase()) {
    case 'paid':
      return tx('Paid');
    case 'pending_payment':
      return tx('Pending payment');
    case 'cancelled':
      return tx('Cancelled');
    case 'failed':
      return tx('Failed');
    default:
      return tx('Pending');
  }
}

function MerchantAdsPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { locale, tx } = useUserI18n();
  const { user, logout } = useAuth();
  const t = translations[language] || translations.en;
  const [payload, setPayload] = useState({ summary: {}, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [activatingTransactionId, setActivatingTransactionId] = useState('');
  const [checkingPaymentTransactionId, setCheckingPaymentTransactionId] = useState('');
  const [deletingTransactionId, setDeletingTransactionId] = useState('');
  const [stoppingTransactionId, setStoppingTransactionId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const nextPayload = await fetchMerchantAdPackageTransactions();
      setPayload({
        summary: nextPayload.summary || {},
        transactions: Array.isArray(nextPayload.transactions) ? nextPayload.transactions : [],
      });
    } catch (error) {
      setLoadError(error?.response?.data?.message || tx('Could not load transaction history right now.'));
      setPayload({ summary: {}, transactions: [] });
    } finally {
      setLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const summary = useMemo(() => payload.summary || {}, [payload.summary]);
  const transactions = useMemo(
    () => (Array.isArray(payload.transactions) ? payload.transactions : []),
    [payload.transactions]
  );

  const activePackageName = summary.activePackage?.name || tx('No active package');
  const activePackageEndsAt = summary.activeExpiresAt || null;
  const activePackagePrice = summary.activePackage?.discountedPrice || summary.activePackage?.price || 0;
  const summaryCards = useMemo(
    () => [
      {
        label: tx('Purchases'),
        value: Number(summary.totalTransactions || 0),
      },
      {
        label: tx('Paid'),
        value: Number(summary.totalPaidTransactions || 0),
      },
      {
        label: tx('Pending checkout'),
        value: Number(summary.totalPendingTransactions || 0),
      },
      {
        label: tx('Covered venues'),
        value: Number(summary.coveredVenueCount || 0),
      },
    ],
    [summary, tx]
  );

  const getUserInitial = () => {
    if (user?.fullname) {
      return user.fullname.charAt(0).toUpperCase();
    }

    return 'M';
  };

  const handleLogout = () => {
    logout();
    navigate(APP_ROUTES.LOGIN);
  };

  const handleMenuClick = (menuId) => {
    if (menuId === 'overview') {
      navigate(APP_ROUTES.MERCHANT_DASHBOARD);
    } else if (menuId === 'posts') {
      navigate(APP_ROUTES.MERCHANT_POSTS);
    } else if (menuId === 'transactions') {
      navigate(APP_ROUTES.MERCHANT_TRANSACTIONS);
    } else if (menuId === 'support') {
      navigate(APP_ROUTES.FEEDBACK);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deleteTarget?.id) {
      setDeleteTarget(null);
      return;
    }

    setDeletingTransactionId(String(deleteTarget.id));
    setActionMessage('');

    try {
      await deleteMerchantAdPackageTransaction(deleteTarget.id);
      setActionMessage(deleteTarget?.isPending ? tx('Pending checkout removed successfully.') : tx('Package removed from transaction history.'));
      setDeleteTarget(null);
      await loadTransactions();
    } catch (error) {
      setActionMessage(error?.response?.data?.message || tx('Could not delete this transaction right now.'));
    } finally {
      setDeletingTransactionId('');
    }
  };

  const handleStopTransaction = async (transaction) => {
    if (!transaction?.id) {
      return;
    }

    setStoppingTransactionId(String(transaction.id));
    setActionMessage('');

    try {
      await deactivateMerchantAdPackageTransaction(transaction.id);
      setActionMessage(tx('The active package has been stopped. Your account is not using any package now.'));
      await loadTransactions();
    } catch (error) {
      setActionMessage(error?.response?.data?.message || tx('Could not stop this package right now.'));
    } finally {
      setStoppingTransactionId('');
    }
  };

  const handleCheckPaymentStatus = async (transaction) => {
    if (!transaction?.id) {
      return;
    }

    setCheckingPaymentTransactionId(String(transaction.id));
    setActionMessage('');

    try {
      const result = await fetchMerchantAdPackageCheckoutStatus(transaction.id);
      if (result?.isPaid) {
        setActionMessage(tx('Payment confirmed successfully. The package is now active for your merchant account.'));
      } else {
        setActionMessage(tx('The checkout is still pending. Please complete payment on the PayOS page and refresh again.'));
      }
      await loadTransactions();
    } catch (error) {
      setActionMessage(error?.response?.data?.message || tx('Could not verify this payment right now.'));
    } finally {
      setCheckingPaymentTransactionId('');
    }
  };

  const handleContinueCheckout = (transaction) => {
    if (!transaction?.payosCheckoutUrl) {
      setActionMessage(tx('The checkout link is unavailable. Please create a new purchase.'));
      return;
    }

    window.location.href = transaction.payosCheckoutUrl;
  };

  const handleActivateTransaction = async (transaction) => {
    if (!transaction?.id) {
      return;
    }

    setActivatingTransactionId(String(transaction.id));
    setActionMessage('');

    try {
      await activateMerchantAdPackageTransaction(transaction.id);
      setActionMessage(tx('Active package updated successfully. The selected package now powers your merchant account.'));
      await loadTransactions();
    } catch (error) {
      setActionMessage(error?.response?.data?.message || tx('Could not activate this package right now.'));
    } finally {
      setActivatingTransactionId('');
    }
  };

  return (
    <div className="merchant-dashboard-container merchant-transactions-shell">
      <div className="merchant-shell">
        <aside className="merchant-sidebar">
          <div className="merchant-sidebar-header">
            <div className="merchant-user-info">
              <div className="merchant-user-avatar">{getUserInitial()}</div>
              <div className="merchant-user-details">
                <h3>{user?.fullname || tx('Merchant account')}</h3>
                <p>{tx('Merchant')}</p>
              </div>
            </div>
          </div>

          <div className="merchant-primary-actions">
            <button
              type="button"
              className="merchant-publish-btn merchant-primary-action-btn"
              onClick={() => navigate(APP_ROUTES.MERCHANT_WORKBENCH)}
            >
              {t.merchant.publish}
            </button>

            <button
              type="button"
              className="merchant-advertise-btn merchant-primary-action-btn"
              onClick={() => navigate(APP_ROUTES.MERCHANT_POST_ADVERTISE)}
            >
              {tx('Advertise')}
            </button>
          </div>

          <nav className="merchant-menu">
            {MenuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`merchant-menu-item ${item.id === 'transactions' ? 'active' : ''}`}
                onClick={() => handleMenuClick(item.id)}
              >
                <span className="merchant-menu-icon">{item.icon}</span>
                <span className="merchant-menu-label">{t.merchant[item.translationKey]}</span>
              </button>
            ))}
          </nav>

          <div className="merchant-sidebar-footer">
            <button type="button" className="merchant-logout-btn" onClick={handleLogout}>
              {t.merchant.logout}
            </button>
          </div>
        </aside>

        <main className="merchant-main-content">
          <section className="merchant-transactions-hero">
            <div>
              <p className="merchant-transactions-kicker">{tx('Payment History')}</p>
              <h1>{tx('Shared Advertising Packages')}</h1>
              <p className="merchant-transactions-subtitle">
                {tx('One purchase now powers every venue in this merchant account. Review purchases, active coverage, and package history here.')}
              </p>
            </div>

            <div className="merchant-transactions-hero-card">
              <span className="merchant-transactions-hero-label">{tx('Current package')}</span>
              <strong>{activePackageName}</strong>
              <p>
                {tx('Applies to')} <strong>{Number(summary.coveredVenueCount || 0)}</strong> {tx('venue(s)')}
              </p>
              <p>
                {tx('Price')} <strong>{activePackagePrice ? formatCurrencyVnd(activePackagePrice) : tx('N/A')}</strong>
              </p>
              <p>
                {tx('Ends at')} <strong>{formatDateTime(activePackageEndsAt, locale, tx)}</strong>
              </p>
            </div>
          </section>

          {actionMessage ? <p className="merchant-transactions-feedback">{actionMessage}</p> : null}

          {loadError ? (
            <section className="merchant-transactions-empty">
              <h2>{tx('Unable to load history')}</h2>
              <p>{loadError}</p>
              <button type="button" className="merchant-transactions-primary" onClick={loadTransactions}>
                {tx('Retry')}
              </button>
            </section>
          ) : null}

          {!loadError && loading ? (
            <section className="merchant-transactions-empty">
              <h2>{tx('Loading payment history...')}</h2>
              <p>{tx('Please wait while we prepare your package records.')}</p>
            </section>
          ) : null}

          {!loadError && !loading ? (
            <>
              <section className="merchant-transactions-summary-grid">
                {summaryCards.map((card) => (
                  <article key={card.label} className="merchant-transactions-summary-card">
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                  </article>
                ))}
              </section>

              {transactions.length ? (
                <section className="merchant-transactions-list">
                  {transactions.map((transaction) => {
                    const featureRows = buildFeatureRows(transaction.package?.features, tx);
                    return (
                      <article key={transaction.id} className="merchant-transaction-card">
                        <div className="merchant-transaction-card-head">
                          <div>
                            <div className="merchant-transaction-topline">
                              <h2>{transaction.package?.name || tx('Archived package')}</h2>
                              {transaction.isActive ? (
                                <span className="merchant-transaction-badge is-active">{tx('Active')}</span>
                              ) : null}
                              {transaction.isPending ? (
                                <span className="merchant-transaction-badge is-pending">{tx('Pending payment')}</span>
                              ) : null}
                              {transaction.isCancelled ? (
                                <span className="merchant-transaction-badge is-cancelled">{tx('Cancelled')}</span>
                              ) : null}
                              {transaction.isFailed ? (
                                <span className="merchant-transaction-badge is-failed">{tx('Failed')}</span>
                              ) : null}
                              {transaction.isExpired ? (
                                <span className="merchant-transaction-badge is-expired">{tx('Expired')}</span>
                              ) : null}
                            </div>
                            <p>
                              {tx('Purchased on')} <strong>{formatDateTime(transaction.purchasedAt, locale, tx)}</strong>
                            </p>
                          </div>

                          <div className="merchant-transaction-actions">
                            {transaction.canStop ? (
                              <button
                                type="button"
                                className="merchant-transaction-stop"
                                disabled={stoppingTransactionId === String(transaction.id)}
                                onClick={() => handleStopTransaction(transaction)}
                              >
                                {stoppingTransactionId === String(transaction.id) ? tx('Stopping...') : tx('Stop package')}
                              </button>
                            ) : null}

                            {transaction.isPending ? (
                              <>
                                <button
                                  type="button"
                                  className="merchant-transaction-activate"
                                  disabled={!transaction.canContinueCheckout}
                                  onClick={() => handleContinueCheckout(transaction)}
                                >
                                  {transaction.isCheckoutExpired ? tx('Checkout expired') : tx('Continue payment')}
                                </button>
                                <button
                                  type="button"
                                  className="merchant-transaction-check"
                                  disabled={checkingPaymentTransactionId === String(transaction.id)}
                                  onClick={() => handleCheckPaymentStatus(transaction)}
                                >
                                  {checkingPaymentTransactionId === String(transaction.id) ? tx('Checking...') : tx('Check payment')}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="merchant-transaction-activate"
                                disabled={!transaction.canActivate || activatingTransactionId === String(transaction.id)}
                                onClick={() => handleActivateTransaction(transaction)}
                              >
                                {transaction.isActive
                                  ? tx('Current active package')
                                  : activatingTransactionId === String(transaction.id)
                                    ? tx('Activating...')
                                    : transaction.isExpired
                                      ? tx('Expired package')
                                      : transaction.isCancelled
                                        ? tx('Cancelled purchase')
                                        : transaction.isFailed
                                          ? tx('Failed purchase')
                                          : tx('Set as active package')}
                              </button>
                            )}

                            {transaction.canDelete ? (
                              <button
                                type="button"
                                className="merchant-transaction-delete"
                                disabled={Boolean(deletingTransactionId)}
                                onClick={() => setDeleteTarget(transaction)}
                              >
                                {transaction.isPending ? tx('Cancel checkout') : tx('Delete')}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="merchant-transaction-meta">
                          <div>
                            <span>{tx('Price')}</span>
                            <strong>{formatCurrencyVnd(transaction.paymentAmount || transaction.package?.price || 0)}</strong>
                          </div>
                          <div>
                            <span>{tx('Payment status')}</span>
                            <strong>{formatPaymentStatus(transaction.paymentStatus, tx)}</strong>
                          </div>
                          <div>
                            <span>{tx('Tier')}</span>
                            <strong>{transaction.package?.tier || 'basic'}</strong>
                          </div>
                          <div>
                            <span>{tx('Duration')}</span>
                            <strong>{Number(transaction.package?.durationDays || 0)} {language === 'vi' ? 'ngày' : 'days'}</strong>
                          </div>
                          <div>
                            <span>{tx('Coverage')}</span>
                            <strong>{tx('All merchant venues')}</strong>
                          </div>
                          <div>
                            <span>{transaction.isPending ? tx('Checkout expires') : tx('Ends at')}</span>
                            <strong>{formatDateTime(transaction.isPending ? transaction.paymentExpiresAt : transaction.expiresAt, locale, tx)}</strong>
                          </div>
                        </div>

                        <ul className="merchant-transaction-features">
                          {featureRows.map((row) => (
                            <li key={`${transaction.id}-${row}`}>{row}</li>
                          ))}
                        </ul>

                        {transaction.isPending ? (
                          <p className="merchant-transaction-note">
                            {tx('This package will only cover your merchant account after PayOS confirms the payment.')}
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </section>
              ) : (
                <section className="merchant-transactions-empty">
                  <h2>{tx('No package purchases yet')}</h2>
                  <p>{tx('Select a package once, and it will cover all venues in your merchant account.')}</p>
                  <button
                    type="button"
                    className="merchant-transactions-primary"
                    onClick={() => navigate(APP_ROUTES.MERCHANT_POSTS)}
                  >
                    {tx('Go to Manage Posts')}
                  </button>
                </section>
              )}
            </>
          ) : null}
        </main>
      </div>

      {deleteTarget ? (
        <div className="merchant-transactions-modal-backdrop" role="presentation">
          <div className="merchant-transactions-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h2 id="delete-title">{tx('Delete this transaction?')}</h2>
            <p>
              {deleteTarget?.isPending
                ? tx('This will cancel the selected unpaid checkout and remove it from your payment history.')
                : tx('This will remove the selected package from your transaction history for this merchant account.')}
            </p>
            <div className="merchant-transactions-modal-actions">
              <button
                type="button"
                className="merchant-transactions-secondary"
                disabled={Boolean(deletingTransactionId)}
                onClick={() => setDeleteTarget(null)}
              >
                {tx('Cancel')}
              </button>
              <button
                type="button"
                className="merchant-transactions-danger"
                disabled={Boolean(deletingTransactionId)}
                onClick={handleDeleteTransaction}
              >
                {deletingTransactionId
                  ? deleteTarget?.isPending
                    ? tx('Cancelling...')
                    : tx('Deleting...')
                  : deleteTarget?.isPending
                    ? tx('Cancel checkout')
                    : tx('Delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MerchantAdsPage;
