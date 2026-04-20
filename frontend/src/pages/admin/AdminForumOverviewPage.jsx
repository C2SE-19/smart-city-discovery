import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';
import { fetchAdminForumPosts } from '../../services/api/adminForumApi';
import './AdminForumOverviewPage.css';

function formatTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('vi-VN');
}

function AdminForumOverviewPage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadPosts = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchAdminForumPosts({ search: searchTerm });
        if (isMounted) {
          setPosts(Array.isArray(data) ? data : []);
        }
      } catch (apiError) {
        if (isMounted) {
          const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
          setError(message || 'Không thể tải dữ liệu diễn đàn.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPosts();

    return () => {
      isMounted = false;
    };
  }, [searchTerm]);

  const summary = useMemo(() => {
    const totalPosts = posts.length;
    const reportedPosts = posts.filter((post) => Number(post.reportCount || 0) > 0).length;
    const reportedComments = posts.reduce(
      (acc, post) => acc + (Array.isArray(post.commentsList) ? post.commentsList.filter((item) => Number(item.reportCount || 0) > 0).length : 0),
      0
    );

    return {
      totalPosts,
      reportedPosts,
      reportedComments
    };
  }, [posts]);

  const handleSubmitSearch = (event) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  };

  return (
    <section className="admin-forum-overview-page">
      <header className="admin-forum-overview-header">
        <div>
          <p className="admin-forum-overview-eyebrow">Forum moderation workspace</p>
          <h2>Xem diễn đàn</h2>
          <p>
            Xem toàn bộ bài viết và bình luận. Nội dung bị báo cáo sẽ được ưu tiên hiển thị phía trên và đánh dấu vàng.
          </p>
        </div>
      </header>

      <nav className="admin-forum-section-switch" aria-label="Điều hướng quản lý diễn đàn">
        <NavLink to={APP_ROUTES.ADMIN_FORUM_REPORTS} className={({ isActive }) => `admin-forum-switch-link ${isActive ? 'is-active' : ''}`}>
          Xem báo cáo
        </NavLink>
        <NavLink to={APP_ROUTES.ADMIN_FORUM_VIEW} className={({ isActive }) => `admin-forum-switch-link ${isActive ? 'is-active' : ''}`}>
          Xem diễn đàn
        </NavLink>
      </nav>

      <section className="admin-forum-overview-stats">
        <article>
          <strong>{summary.totalPosts}</strong>
          <span>Tổng bài viết</span>
        </article>
        <article className="is-warning">
          <strong>{summary.reportedPosts}</strong>
          <span>Bài viết bị báo cáo</span>
        </article>
        <article className="is-warning">
          <strong>{summary.reportedComments}</strong>
          <span>Bình luận bị báo cáo</span>
        </article>
      </section>

      <form className="admin-forum-overview-toolbar" onSubmit={handleSubmitSearch}>
        <input
          type="search"
          value={searchInput}
          onChange={(event) => {
            const nextValue = event.target.value;
            setSearchInput(nextValue);
            if (!nextValue.trim()) {
              setSearchTerm('');
            }
          }}
          placeholder="Tìm theo tiêu đề, nội dung, tác giả hoặc bình luận..."
          aria-label="Tìm kiếm diễn đàn"
        />
        <button type="submit">Tìm kiếm</button>
      </form>

      {error ? <p className="admin-forum-overview-error">{error}</p> : null}
      {loading ? <p className="admin-forum-overview-loading">Đang tải dữ liệu diễn đàn...</p> : null}

      <div className="admin-forum-overview-list">
        {posts.map((post) => {
          const comments = Array.isArray(post.commentsList) ? post.commentsList : [];
          const postIsReported = Number(post.reportCount || 0) > 0;
          const reportedCommentsCount = comments.filter((item) => Number(item.reportCount || 0) > 0).length;

          return (
            <article
              key={post.id}
              className={`admin-forum-overview-card${post.hasReportedContent ? ' is-priority' : ''}${postIsReported ? ' is-post-reported' : ''}`}
            >
              <div className="admin-forum-overview-card-head">
                <div>
                  <h3>{post.title}</h3>
                  <p>
                    Tác giả: <strong>{post.author}</strong> · Chủ đề: <strong>{post.category}</strong>
                  </p>
                </div>
                <div className="admin-forum-overview-meta">
                  {postIsReported ? <span className="admin-forum-overview-badge is-post">Bài viết bị báo cáo</span> : null}
                  {!postIsReported && reportedCommentsCount > 0 ? (
                    <span className="admin-forum-overview-badge is-comment">Có bình luận bị báo cáo</span>
                  ) : null}
                  <span>{formatTime(post.lastReportedAt || post.createdAt)}</span>
                </div>
              </div>

              <p className="admin-forum-overview-content">{post.content}</p>

              {Array.isArray(post.images) && post.images.length ? (
                <div className="admin-forum-overview-media-grid">
                  {post.images.map((src, index) => (
                    <img key={`post-${post.id}-img-${index}`} src={src} alt={`post-${post.id}-${index + 1}`} loading="lazy" />
                  ))}
                </div>
              ) : null}

              <div className="admin-forum-overview-chips">
                <span>Lượt thích: {Number(post.likesCount || 0)}</span>
                <span>Bình luận: {comments.length}</span>
                <span className={postIsReported ? 'is-highlight' : ''}>Báo cáo bài viết: {Number(post.reportCount || 0)}</span>
                <span className={reportedCommentsCount > 0 ? 'is-highlight' : ''}>Bình luận bị báo cáo: {reportedCommentsCount}</span>
              </div>

              <section className="admin-forum-overview-comments">
                <h4>Bình luận ({comments.length})</h4>
                <ul>
                  {comments.map((comment) => {
                    const commentIsReported = Number(comment.reportCount || 0) > 0;

                    return (
                      <li key={`comment-${comment.id}`} className={commentIsReported ? 'is-reported' : ''}>
                        <div className="admin-forum-overview-comment-head">
                          <strong>{comment.author}</strong>
                          <span>{formatTime(comment.lastReportedAt || comment.createdAt)}</span>
                        </div>
                        <p>{comment.content}</p>

                        {Array.isArray(comment.images) && comment.images.length ? (
                          <div className="admin-forum-overview-media-grid is-comment-media">
                            {comment.images.map((src, index) => (
                              <img key={`comment-${comment.id}-img-${index}`} src={src} alt={`comment-${comment.id}-${index + 1}`} loading="lazy" />
                            ))}
                          </div>
                        ) : null}

                        {commentIsReported ? (
                          <small className="admin-forum-overview-comment-flag">Bình luận bị báo cáo: {Number(comment.reportCount || 0)}</small>
                        ) : null}
                      </li>
                    );
                  })}

                  {!comments.length ? <li className="is-empty">Chưa có bình luận.</li> : null}
                </ul>
              </section>
            </article>
          );
        })}

        {!loading && !posts.length ? <p className="admin-forum-overview-empty">Không có bài viết diễn đàn phù hợp điều kiện tìm kiếm.</p> : null}
      </div>
    </section>
  );
}

export default AdminForumOverviewPage;
