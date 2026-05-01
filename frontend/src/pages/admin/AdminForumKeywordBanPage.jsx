import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';
import {
  createAdminForumBannedKeyword,
  deleteAdminForumBannedKeyword,
  fetchAdminForumBannedKeywords
} from '../../services/api/adminForumApi';
import './AdminForumKeywordBanPage.css';

function formatTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-US');
}

function AdminForumKeywordBanPage() {
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
          setError(message || 'Unable to load banned keywords.');
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
  }, []);

  const handleApplyKeyword = async (event) => {
    event.preventDefault();
    const keyword = String(keywordInput || '').trim();

    if (!keyword) {
      setError('Enter a keyword to ban.');
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
      setSuccess('Keyword ban applied successfully.');
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setError(message || 'Unable to apply the keyword ban right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveKeyword = async (keywordId) => {
    const accepted = window.confirm('Are you sure you want to remove this banned keyword?');
    if (!accepted) return;

    setDeletingKeywordId(keywordId);
    setError('');
    setSuccess('');

    try {
      await deleteAdminForumBannedKeyword(keywordId);
      setKeywords((current) => current.filter((item) => String(item.id) !== String(keywordId)));
      setSuccess('Banned keyword removed.');
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setError(message || 'Unable to remove this banned keyword right now.');
    } finally {
      setDeletingKeywordId(null);
    }
  };

  return (
    <section className="admin-forum-keyword-page">
      <header className="admin-forum-keyword-header">
        <div>
          <p className="admin-forum-keyword-eyebrow">Forum moderation workspace</p>
          <h2>Banned Keywords</h2>
          <p>Add blocked words or phrases to prevent posts and comments containing them.</p>
        </div>
      </header>

      <nav className="admin-forum-section-switch" aria-label="Forum moderation navigation">
        <NavLink to={APP_ROUTES.ADMIN_FORUM_REPORTS} className={({ isActive }) => `admin-forum-switch-link ${isActive ? 'is-active' : ''}`}>
          Reports
        </NavLink>
        <NavLink to={APP_ROUTES.ADMIN_FORUM_VIEW} className={({ isActive }) => `admin-forum-switch-link ${isActive ? 'is-active' : ''}`}>
          Forum
        </NavLink>
        <NavLink to={APP_ROUTES.ADMIN_FORUM_KEYWORDS} className={({ isActive }) => `admin-forum-switch-link ${isActive ? 'is-active' : ''}`}>
          Banned Keywords
        </NavLink>
      </nav>

      <form className="admin-forum-keyword-form" onSubmit={handleApplyKeyword}>
        <input
          type="text"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder="Enter a blocked word or phrase..."
          maxLength={160}
          disabled={submitting}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Applying...' : 'Apply'}
        </button>
      </form>

      {error ? <p className="admin-forum-keyword-error">{error}</p> : null}
      {success ? <p className="admin-forum-keyword-success">{success}</p> : null}
      {loading ? <p className="admin-forum-keyword-loading">Loading banned keywords...</p> : null}

      <section className="admin-forum-keyword-table-wrap">
        <table className="admin-forum-keyword-table">
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Applied On</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((item) => (
              <tr key={item.id}>
                <td>{item.keyword}</td>
                <td>{formatTime(item.created_at)}</td>
                <td>
                  <button
                    type="button"
                    className="admin-forum-keyword-remove-button"
                    onClick={() => handleRemoveKeyword(item.id)}
                    disabled={deletingKeywordId === item.id}
                  >
                    {deletingKeywordId === item.id ? 'Removing...' : 'Remove'}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !keywords.length ? (
              <tr>
                <td colSpan={3} className="admin-forum-keyword-empty">No banned keywords have been applied yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </section>
  );
}

export default AdminForumKeywordBanPage;
