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
  return date.toLocaleString('vi-VN');
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
          setError(message || 'Không thể tải danh sách từ khóa cấm.');
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
      setError('Vui lòng nhập từ khóa cần cấm.');
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
      setSuccess('Đã áp dụng từ khóa cấm thành công.');
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setError(message || 'Không thể áp dụng từ khóa cấm lúc này.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveKeyword = async (keywordId) => {
    const accepted = window.confirm('Bạn có chắc muốn gỡ từ khóa cấm này không?');
    if (!accepted) return;

    setDeletingKeywordId(keywordId);
    setError('');
    setSuccess('');

    try {
      await deleteAdminForumBannedKeyword(keywordId);
      setKeywords((current) => current.filter((item) => String(item.id) !== String(keywordId)));
      setSuccess('Đã gỡ từ khóa cấm.');
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setError(message || 'Không thể gỡ từ khóa cấm lúc này.');
    } finally {
      setDeletingKeywordId(null);
    }
  };

  return (
    <section className="admin-forum-keyword-page">
      <header className="admin-forum-keyword-header">
        <div>
          <p className="admin-forum-keyword-eyebrow">Forum moderation workspace</p>
          <h2>Cấm từ khóa</h2>
          <p>Thêm từ cấm để chặn người dùng đăng bài hoặc bình luận chứa từ khóa đó.</p>
        </div>
      </header>

      <nav className="admin-forum-section-switch" aria-label="Điều hướng quản lý diễn đàn">
        <NavLink to={APP_ROUTES.ADMIN_FORUM_REPORTS} className={({ isActive }) => `admin-forum-switch-link ${isActive ? 'is-active' : ''}`}>
          Xem báo cáo
        </NavLink>
        <NavLink to={APP_ROUTES.ADMIN_FORUM_VIEW} className={({ isActive }) => `admin-forum-switch-link ${isActive ? 'is-active' : ''}`}>
          Xem diễn đàn
        </NavLink>
        <NavLink to={APP_ROUTES.ADMIN_FORUM_KEYWORDS} className={({ isActive }) => `admin-forum-switch-link ${isActive ? 'is-active' : ''}`}>
          Cấm từ khóa
        </NavLink>
      </nav>

      <form className="admin-forum-keyword-form" onSubmit={handleApplyKeyword}>
        <input
          type="text"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder="Nhập từ hoặc cụm từ cần cấm..."
          maxLength={160}
          disabled={submitting}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Đang áp dụng...' : 'Áp dụng'}
        </button>
      </form>

      {error ? <p className="admin-forum-keyword-error">{error}</p> : null}
      {success ? <p className="admin-forum-keyword-success">{success}</p> : null}
      {loading ? <p className="admin-forum-keyword-loading">Đang tải danh sách từ khóa cấm...</p> : null}

      <section className="admin-forum-keyword-table-wrap">
        <table className="admin-forum-keyword-table">
          <thead>
            <tr>
              <th>Từ khóa</th>
              <th>Ngày áp dụng</th>
              <th>Hành động</th>
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
                    {deletingKeywordId === item.id ? 'Đang gỡ...' : 'Gỡ'}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !keywords.length ? (
              <tr>
                <td colSpan={3} className="admin-forum-keyword-empty">Chưa có từ khóa cấm nào được áp dụng.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </section>
  );
}

export default AdminForumKeywordBanPage;
