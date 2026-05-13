import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';
import useAdminI18n from '../../hooks/useAdminI18n';
import {
  createAdminForumBannedKeyword,
  deleteAdminForumBannedKeyword,
  fetchAdminForumBannedKeywords
} from '../../services/api/adminForumApi';
import './AdminForumKeywordBanPage.css';

function AdminForumKeywordBanPage() {
  const { tx, formatDateTime } = useAdminI18n();
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingKeywordId, setDeletingKeywordId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadKeywords = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await fetchAdminForumBannedKeywords();
        if (isMounted) {
          setKeywords(Array.isArray(data) ? data : []);
        }
      } catch (apiError) {
        if (isMounted) {
          const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
          setError(message || tx('Unable to load banned keywords.'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadKeywords();

    return () => {
      isMounted = false;
    };
  }, [tx]);

  const handleApplyKeyword = async (event) => {
    event.preventDefault();
    const keyword = String(keywordInput || '').trim();

    if (!keyword) {
      setError(tx('Enter a keyword to ban.'));
      setSuccess('');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const created = await createAdminForumBannedKeyword(keyword);
      setKeywords((current) => {
        const next = current.filter((item) => String(item.id) !== String(created?.id));
        return created ? [created, ...next] : next;
      });
      setKeywordInput('');
      setSuccess(tx('Keyword ban applied successfully.'));
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setError(message || tx('Unable to apply the keyword ban right now.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveKeyword = async (keywordId) => {
    const accepted = window.confirm(tx('Are you sure you want to remove this banned keyword?'));
    if (!accepted) return;

    setDeletingKeywordId(keywordId);
    setError('');
    setSuccess('');

    try {
      await deleteAdminForumBannedKeyword(keywordId);
      setKeywords((current) => current.filter((item) => String(item.id) !== String(keywordId)));
      setSuccess(tx('Banned keyword removed.'));
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setError(message || tx('Unable to remove this banned keyword right now.'));
    } finally {
      setDeletingKeywordId(null);
    }
  };

  return (
    <section className="admin-forum-keyword-page">
      <header className="admin-forum-keyword-header">
        <div>
          <p className="admin-forum-keyword-eyebrow">{tx('Forum moderation workspace')}</p>
          <h2>{tx('Banned Keywords')}</h2>
          <p>{tx('Add blocked words or phrases to prevent posts and comments containing them.')}</p>
        </div>
      </header>

      <nav className="admin-forum-section-switch" aria-label={tx('Forum moderation navigation')}>
        <NavLink to={APP_ROUTES.ADMIN_FORUM_REPORTS} className={({ isActive }) => `admin-forum-switch-link ${isActive ? 'is-active' : ''}`}>
          {tx('Reports')}
        </NavLink>
        <NavLink to={APP_ROUTES.ADMIN_FORUM_VIEW} className={({ isActive }) => `admin-forum-switch-link ${isActive ? 'is-active' : ''}`}>
          {tx('Forum')}
        </NavLink>
        <NavLink to={APP_ROUTES.ADMIN_FORUM_KEYWORDS} className={({ isActive }) => `admin-forum-switch-link ${isActive ? 'is-active' : ''}`}>
          {tx('Banned Keywords')}
        </NavLink>
      </nav>

      <form className="admin-forum-keyword-form" onSubmit={handleApplyKeyword}>
        <input
          type="text"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder={tx('Enter a blocked word or phrase...')}
          maxLength={160}
          disabled={submitting}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? tx('Applying...') : tx('Apply')}
        </button>
      </form>

      {error ? <p className="admin-forum-keyword-error">{error}</p> : null}
      {success ? <p className="admin-forum-keyword-success">{success}</p> : null}
      {loading ? <p className="admin-forum-keyword-loading">{tx('Loading banned keywords...')}</p> : null}

      <section className="admin-forum-keyword-table-wrap">
        <table className="admin-forum-keyword-table">
          <thead>
            <tr>
              <th>{tx('Keyword')}</th>
              <th>{tx('Applied On')}</th>
              <th>{tx('Action')}</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((item) => (
              <tr key={item.id}>
                <td>{item.keyword}</td>
                <td>{formatDateTime(item.created_at)}</td>
                <td>
                  <button
                    type="button"
                    className="admin-forum-keyword-remove-button"
                    onClick={() => handleRemoveKeyword(item.id)}
                    disabled={deletingKeywordId === item.id}
                  >
                    {deletingKeywordId === item.id ? tx('Removing...') : tx('Remove')}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !keywords.length ? (
              <tr>
                <td colSpan={3} className="admin-forum-keyword-empty">{tx('No banned keywords have been applied yet.')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </section>
  );
}

export default AdminForumKeywordBanPage;
