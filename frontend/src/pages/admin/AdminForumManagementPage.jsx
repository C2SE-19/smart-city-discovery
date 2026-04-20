import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';
import {
  dismissAdminForumCommentReports,
  dismissAdminForumPostReports,
  deleteAdminForumComment,
  deleteAdminForumPost,
  fetchAdminForumPosts
} from '../../services/api/adminForumApi';
import './AdminForumManagementPage.css';

function formatTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('vi-VN');
}

function collectDescendantCommentIds(comments, rootCommentId) {
  const rootKey = String(rootCommentId);
  const childrenByParent = new Map();

  comments.forEach((item) => {
    const parentId = item?.parentCommentId;
    if (parentId === null || parentId === undefined || parentId === '') return;
    const parentKey = String(parentId);
    if (!childrenByParent.has(parentKey)) {
      childrenByParent.set(parentKey, []);
    }
    childrenByParent.get(parentKey).push(String(item.id));
  });

  const collected = new Set();
  const stack = [rootKey];

  while (stack.length) {
    const current = stack.pop();
    if (!current || collected.has(current)) continue;
    collected.add(current);
    const children = childrenByParent.get(current) || [];
    children.forEach((childId) => stack.push(childId));
  }

  return collected;
}

function AdminForumManagementPage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [dismissingPostId, setDismissingPostId] = useState(null);
  const [dismissingCommentId, setDismissingCommentId] = useState(null);

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
          setError(message || 'Không thể tải dữ liệu quản lý diễn đàn.');
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

  const reportedPosts = useMemo(
    () =>
      posts
        .filter((post) => Number(post.reportCount || 0) > 0)
        .sort((a, b) => new Date(b.lastReportedAt || 0).getTime() - new Date(a.lastReportedAt || 0).getTime()),
    [posts]
  );

  const reportedComments = useMemo(() => {
    const items = [];

    posts.forEach((post) => {
      const comments = Array.isArray(post.commentsList) ? post.commentsList : [];

      comments.forEach((comment) => {
        const reportCount = Number(comment.reportCount || 0);
        if (reportCount <= 0) return;

        items.push({
          ...comment,
          postId: post.id,
          postTitle: post.title,
          postAuthor: post.author,
          postCategory: post.category
        });
      });
    });

    return items.sort((a, b) => new Date(b.lastReportedAt || 0).getTime() - new Date(a.lastReportedAt || 0).getTime());
  }, [posts]);

  const handleDeletePost = async (postId) => {
    const accepted = window.confirm('Bạn có chắc muốn xóa bài viết này không?');
    if (!accepted) return;

    setActionError('');
    setActionSuccess('');
    setDeletingPostId(postId);

    try {
      await deleteAdminForumPost(postId);
      setPosts((current) => current.filter((post) => String(post.id) !== String(postId)));
      setActionSuccess('Đã xóa bài viết thành công.');
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setActionError(message || 'Không thể xóa bài viết lúc này. Vui lòng thử lại.');
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    const accepted = window.confirm('Bạn có chắc muốn xóa bình luận này không?');
    if (!accepted) return;

    setActionError('');
    setActionSuccess('');
    setDeletingCommentId(commentId);

    try {
      const result = await deleteAdminForumComment(postId, commentId);

      setPosts((current) =>
        current.map((post) => {
          if (String(post.id) !== String(postId)) return post;

          const comments = Array.isArray(post.commentsList) ? post.commentsList : [];
          const toRemove = collectDescendantCommentIds(comments, commentId);
          const nextComments = comments.filter((item) => !toRemove.has(String(item.id)));
          const deletedCount = Number(result?.deletedCount || 0) || toRemove.size;

          return {
            ...post,
            commentsList: nextComments,
            comments: Math.max(0, Number(post.comments || 0) - deletedCount)
          };
        })
      );

      setActionSuccess('Đã xóa bình luận thành công.');
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setActionError(message || 'Không thể xóa bình luận lúc này. Vui lòng thử lại.');
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleDismissPostReports = async (postId) => {
    const accepted = window.confirm('Hủy toàn bộ báo cáo của bài viết này?');
    if (!accepted) return;

    setActionError('');
    setActionSuccess('');
    setDismissingPostId(postId);

    try {
      await dismissAdminForumPostReports(postId);

      setPosts((current) =>
        current.map((post) => {
          if (String(post.id) !== String(postId)) return post;

          const comments = Array.isArray(post.commentsList) ? post.commentsList : [];
          const nextCommentReportCount = comments.filter((item) => Number(item.reportCount || 0) > 0).length;

          return {
            ...post,
            reportCount: 0,
            postReportReasons: [],
            hasReportedContent: nextCommentReportCount > 0,
            lastReportedAt: nextCommentReportCount > 0 ? post.lastReportedAt : null
          };
        })
      );

      setActionSuccess('Đã hủy báo cáo bài viết.');
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setActionError(message || 'Không thể hủy báo cáo bài viết lúc này. Vui lòng thử lại.');
    } finally {
      setDismissingPostId(null);
    }
  };

  const handleDismissCommentReports = async (postId, commentId) => {
    const accepted = window.confirm('Hủy toàn bộ báo cáo của bình luận này?');
    if (!accepted) return;

    setActionError('');
    setActionSuccess('');
    setDismissingCommentId(commentId);

    try {
      await dismissAdminForumCommentReports(postId, commentId);

      setPosts((current) =>
        current.map((post) => {
          if (String(post.id) !== String(postId)) return post;

          const comments = Array.isArray(post.commentsList) ? post.commentsList : [];
          const nextComments = comments.map((item) =>
            String(item.id) === String(commentId)
              ? {
                  ...item,
                  reportCount: 0,
                  reportReasons: [],
                  commentReportReasons: [],
                  isReported: false,
                  lastReportedAt: null
                }
              : item
          );

          const nextCommentReportCount = nextComments.filter((item) => Number(item.reportCount || 0) > 0).length;

          return {
            ...post,
            commentsList: nextComments,
            commentReportCount: nextCommentReportCount,
            hasReportedContent: Number(post.reportCount || 0) > 0 || nextCommentReportCount > 0
          };
        })
      );

      setActionSuccess('Đã hủy báo cáo bình luận.');
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setActionError(message || 'Không thể hủy báo cáo bình luận lúc này. Vui lòng thử lại.');
    } finally {
      setDismissingCommentId(null);
    }
  };

  const handleSubmitSearch = (event) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  };

  return (
    <section className="admin-forum-page">
      <header className="admin-forum-header">
        <div>
          <p className="admin-forum-eyebrow">Forum moderation workspace</p>
          <h2>Xem báo cáo</h2>
          <p>Xem và hành động với các bài viết, bình luận bị báo cáo.</p>
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

      <section className="admin-forum-stats">
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

      <form className="admin-forum-toolbar" onSubmit={handleSubmitSearch}>
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
          aria-label="Tìm kiếm bài viết diễn đàn"
        />
        <button type="submit">Tìm kiếm</button>
      </form>

      {error ? <p className="admin-forum-error">{error}</p> : null}
      {actionError ? <p className="admin-forum-error">{actionError}</p> : null}
      {actionSuccess ? <p className="admin-forum-loading">{actionSuccess}</p> : null}
      {loading ? <p className="admin-forum-loading">Đang tải dữ liệu diễn đàn...</p> : null}

      <section className="admin-forum-split">
        <article className="admin-forum-split-column">
          <header className="admin-forum-split-head">
            <h3>Bài viết bị báo cáo</h3>
            <span>{reportedPosts.length}</span>
          </header>

          <div className="admin-forum-list">
            {reportedPosts.map((post) => (
              <article key={post.id} className="admin-forum-card is-reported">
                <div className="admin-forum-card-head">
                  <div>
                    <h3>{post.title}</h3>
                    <p>
                      Tác giả: <strong>{post.author}</strong> · Chủ đề: <strong>{post.category}</strong>
                    </p>
                  </div>
                  <div className="admin-forum-card-meta">
                    <span className="admin-flag-badge">Đã báo cáo</span>
                    <span>{formatTime(post.lastReportedAt || post.createdAt)}</span>
                  </div>
                </div>

                <p className="admin-forum-post-content">{post.content}</p>

                {Array.isArray(post.images) && post.images.length ? (
                  <div className="admin-forum-media-grid">
                    {post.images.map((src, index) => (
                      <img key={`post-${post.id}-img-${index}`} src={src} alt={`post-${post.id}-${index + 1}`} loading="lazy" />
                    ))}
                  </div>
                ) : null}

                <div className="admin-forum-badges-row">
                  <span className="admin-chip is-danger">Số lượt báo cáo: {Number(post.reportCount || 0)}</span>
                  <span className="admin-chip">Lượt thích: {Number(post.likesCount || 0)}</span>
                  <span className="admin-chip">Bình luận: {Number(post.comments || 0)}</span>
                </div>

                <div className="admin-forum-report-block">
                  <h4>Lý do bị báo cáo</h4>
                  <ul>
                    {(Array.isArray(post.postReportReasons) ? post.postReportReasons : []).map((item) => (
                      <li key={`post-report-${post.id}-${item.id}`}>
                        <div>
                          <strong>{item.reason}</strong>
                          <span>{formatTime(item.created_at)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="admin-forum-actions">
                  <button
                    type="button"
                    className="admin-warning-button"
                    onClick={() => handleDismissPostReports(post.id)}
                    disabled={dismissingPostId === post.id}
                  >
                    {dismissingPostId === post.id ? 'Đang hủy...' : 'Hủy báo cáo'}
                  </button>
                  <button
                    type="button"
                    className="admin-danger-button"
                    onClick={() => handleDeletePost(post.id)}
                    disabled={deletingPostId === post.id || dismissingPostId === post.id}
                  >
                    {deletingPostId === post.id ? 'Đang xóa...' : 'Xóa bài viết'}
                  </button>
                </div>
              </article>
            ))}

            {!loading && !reportedPosts.length ? (
              <p className="admin-forum-empty">Hiện chưa có bài viết bị báo cáo.</p>
            ) : null}
          </div>
        </article>

        <article className="admin-forum-split-column">
          <header className="admin-forum-split-head">
            <h3>Bình luận bị báo cáo</h3>
            <span>{reportedComments.length}</span>
          </header>

          <div className="admin-forum-list">
            {reportedComments.map((comment) => (
              <article key={`comment-${comment.id}`} className="admin-forum-card is-reported">
                <div className="admin-forum-card-head">
                  <div>
                    <h3>{comment.author}</h3>
                    <p>
                      Thuộc bài: <strong>{comment.postTitle}</strong> · Tác giả bài viết: <strong>{comment.postAuthor}</strong>
                    </p>
                  </div>
                  <div className="admin-forum-card-meta">
                    <span className="admin-flag-badge">Đã báo cáo</span>
                    <span>{formatTime(comment.lastReportedAt || comment.createdAt)}</span>
                  </div>
                </div>

                <p className="admin-forum-post-content">{comment.content}</p>

                {Array.isArray(comment.images) && comment.images.length ? (
                  <div className="admin-forum-media-grid is-comment-media">
                    {comment.images.map((src, index) => (
                      <img key={`comment-${comment.id}-img-${index}`} src={src} alt={`comment-${comment.id}-${index + 1}`} loading="lazy" />
                    ))}
                  </div>
                ) : null}

                <div className="admin-forum-badges-row">
                  <span className="admin-chip is-danger">Số lượt báo cáo: {Number(comment.reportCount || 0)}</span>
                  <span className="admin-chip">Chủ đề bài viết: {comment.postCategory || 'N/A'}</span>
                </div>

                <div className="admin-forum-report-block">
                  <h4>Lý do bị báo cáo</h4>
                  <ul>
                    {(Array.isArray(comment.reportReasons) ? comment.reportReasons : []).map((item) => (
                      <li key={`comment-report-${comment.id}-${item.id}`}>
                        <div>
                          <strong>{item.reason}</strong>
                          <span>{formatTime(item.created_at)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="admin-forum-actions">
                  <button
                    type="button"
                    className="admin-warning-button"
                    onClick={() => handleDismissCommentReports(comment.postId, comment.id)}
                    disabled={dismissingCommentId === comment.id}
                  >
                    {dismissingCommentId === comment.id ? 'Đang hủy...' : 'Hủy báo cáo'}
                  </button>
                  <button
                    type="button"
                    className="admin-danger-button"
                    onClick={() => handleDeleteComment(comment.postId, comment.id)}
                    disabled={deletingCommentId === comment.id || dismissingCommentId === comment.id}
                  >
                    {deletingCommentId === comment.id ? 'Đang xóa...' : 'Xóa bình luận'}
                  </button>
                </div>
              </article>
            ))}

            {!loading && !reportedComments.length ? (
              <p className="admin-forum-empty">Hiện chưa có bình luận bị báo cáo.</p>
            ) : null}
          </div>
        </article>
      </section>

      {!loading && !posts.length ? (
        <p className="admin-forum-empty">Không có bài viết diễn đàn phù hợp với điều kiện tìm kiếm.</p>
      ) : null}
    </section>
  );
}

export default AdminForumManagementPage;
