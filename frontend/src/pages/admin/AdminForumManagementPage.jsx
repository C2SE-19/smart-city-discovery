import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';
import useAdminI18n from '../../hooks/useAdminI18n';
import {
  dismissAdminForumCommentReports,
  dismissAdminForumPostReports,
  deleteAdminForumComment,
  deleteAdminForumPost,
  fetchAdminForumPosts
} from '../../services/api/adminForumApi';
import './AdminForumManagementPage.css';

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
  const { tx, formatDateTime, formatNumber } = useAdminI18n();
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
          setError(message || tx('Unable to load forum management data.'));
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
  }, [searchTerm, tx]);

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
    const accepted = window.confirm(tx('Are you sure you want to delete this post?'));
    if (!accepted) return;

    setActionError('');
    setActionSuccess('');
    setDeletingPostId(postId);

    try {
      await deleteAdminForumPost(postId);
      setPosts((current) => current.filter((post) => String(post.id) !== String(postId)));
      setActionSuccess(tx('Post deleted successfully.'));
        window.dispatchEvent(new Event('admin-badges-refresh'));
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setActionError(message || tx('Unable to delete post at this time. Please try again.'));
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    const accepted = window.confirm(tx('Are you sure you want to delete this comment?'));
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

      setActionSuccess(tx('Comment deleted successfully.'));
        window.dispatchEvent(new Event('admin-badges-refresh'));
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setActionError(message || tx('Unable to delete comment at this time. Please try again.'));
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleDismissPostReports = async (postId) => {
    const accepted = window.confirm(tx('Dismiss all reports for this post?'));
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

      setActionSuccess(tx('Post reports dismissed successfully.'));
        window.dispatchEvent(new Event('admin-badges-refresh'));
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setActionError(message || tx('Unable to dismiss post reports right now. Please try again.'));
    } finally {
      setDismissingPostId(null);
    }
  };

  const handleDismissCommentReports = async (postId, commentId) => {
    const accepted = window.confirm(tx('Dismiss all reports for this comment?'));
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

      setActionSuccess(tx('Comment reports dismissed.'));
        window.dispatchEvent(new Event('admin-badges-refresh'));
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setActionError(message || tx('Unable to dismiss comment reports at this time. Please try again.'));
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
          <p className="admin-forum-eyebrow">{tx('Forum moderation workspace')}</p>
          <h2>{tx('View Reports')}</h2>
          <p>{tx('View and take action on reported posts and comments.')}</p>
        </div>
      </header>

      <nav className="admin-forum-section-switch" aria-label={tx('Forum management navigation')}>
        <NavLink to={APP_ROUTES.ADMIN_FORUM_REPORTS} className={({ isActive }) => `admin-forum-switch-link ${isActive ? 'is-active' : ''}`}>
          {tx('View Reports')}
        </NavLink>
        <NavLink to={APP_ROUTES.ADMIN_FORUM_VIEW} className={({ isActive }) => `admin-forum-switch-link ${isActive ? 'is-active' : ''}`}>
          {tx('Forum Overview')}
        </NavLink>
        <NavLink to={APP_ROUTES.ADMIN_FORUM_KEYWORDS} className={({ isActive }) => `admin-forum-switch-link ${isActive ? 'is-active' : ''}`}>
          {tx('Banned Keywords')}
        </NavLink>
      </nav>

      <section className="admin-forum-stats">
        <article>
          <strong>{formatNumber(summary.totalPosts)}</strong>
          <span>{tx('Total Posts')}</span>
        </article>
        <article className="is-warning">
          <strong>{formatNumber(summary.reportedPosts)}</strong>
          <span>{tx('Reported Posts')}</span>
        </article>
        <article className="is-warning">
          <strong>{formatNumber(summary.reportedComments)}</strong>
          <span>{tx('Reported Comments')}</span>
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
          placeholder={tx('Search by title, content, author, or comments...')}
          aria-label={tx('Search forum posts')}
        />
        <button type="submit">{tx('Search')}</button>
      </form>

      {error ? <p className="admin-forum-error">{error}</p> : null}
      {actionError ? <p className="admin-forum-error">{actionError}</p> : null}
      {actionSuccess ? <p className="admin-forum-loading">{actionSuccess}</p> : null}
      {loading ? <p className="admin-forum-loading">{tx('Loading forum data...')}</p> : null}

      <section className="admin-forum-split">
        <article className="admin-forum-split-column">
          <header className="admin-forum-split-head">
            <h3>{tx('Reported Posts')}</h3>
            <span>{formatNumber(reportedPosts.length)}</span>
          </header>

          <div className="admin-forum-list">
            {reportedPosts.map((post) => (
              <article key={post.id} className="admin-forum-card is-reported">
                <div className="admin-forum-card-head">
                  <div>
                    <h3>{post.title}</h3>
                    <p>
                      {tx('Author:')} <strong>{post.author}</strong> • {tx('Category:')} <strong>{post.category}</strong>
                    </p>
                  </div>
                  <div className="admin-forum-card-meta">
                    <span className="admin-flag-badge">{tx('Reported')}</span>
                    <span>{formatDateTime(post.lastReportedAt || post.createdAt)}</span>
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
                  <span className="admin-chip is-danger">{tx('Report count')}: {formatNumber(post.reportCount || 0)}</span>
                  <span className="admin-chip">{tx('Likes')}: {formatNumber(post.likesCount || 0)}</span>
                  <span className="admin-chip">{tx('Comments')}: {formatNumber(post.comments || 0)}</span>
                </div>

                <div className="admin-forum-report-block">
                  <h4>{tx('Report reasons')}</h4>
                  <ul>
                    {(Array.isArray(post.postReportReasons) ? post.postReportReasons : []).map((item) => (
                      <li key={`post-report-${post.id}-${item.id}`}>
                        <div>
                          <strong>{item.reason}</strong>
                          <span>{formatDateTime(item.created_at)}</span>
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
                    {dismissingPostId === post.id ? tx('Dismissing...') : tx('Dismiss report')}
                  </button>
                  <button
                    type="button"
                    className="admin-danger-button"
                    onClick={() => handleDeletePost(post.id)}
                    disabled={deletingPostId === post.id || dismissingPostId === post.id}
                  >
                    {deletingPostId === post.id ? tx('Deleting...') : tx('Delete Post')}
                  </button>
                </div>
              </article>
            ))}

            {!loading && !reportedPosts.length ? (
              <p className="admin-forum-empty">{tx('There are no reported posts yet.')}</p>
            ) : null}
          </div>
        </article>

        <article className="admin-forum-split-column">
          <header className="admin-forum-split-head">
            <h3>{tx('Reported Comments')}</h3>
            <span>{formatNumber(reportedComments.length)}</span>
          </header>

          <div className="admin-forum-list">
            {reportedComments.map((comment) => (
              <article key={`comment-${comment.id}`} className="admin-forum-card is-reported">
                <div className="admin-forum-card-head">
                  <div>
                    <h3>{comment.author}</h3>
                    <p>
                      {tx('Post:')} <strong>{comment.postTitle}</strong> • {tx('Post author:')} <strong>{comment.postAuthor}</strong>
                    </p>
                  </div>
                  <div className="admin-forum-card-meta">
                    <span className="admin-flag-badge">{tx('Reported')}</span>
                    <span>{formatDateTime(comment.lastReportedAt || comment.createdAt)}</span>
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
                  <span className="admin-chip is-danger">{tx('Report count')}: {formatNumber(comment.reportCount || 0)}</span>
                  <span className="admin-chip">{tx('Post category:')} {comment.postCategory || tx('N/A')}</span>
                </div>

                <div className="admin-forum-report-block">
                  <h4>{tx('Report reasons')}</h4>
                  <ul>
                    {(Array.isArray(comment.reportReasons) ? comment.reportReasons : []).map((item) => (
                      <li key={`comment-report-${comment.id}-${item.id}`}>
                        <div>
                          <strong>{item.reason}</strong>
                          <span>{formatDateTime(item.created_at)}</span>
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
                    {dismissingCommentId === comment.id ? tx('Dismissing...') : tx('Dismiss report')}
                  </button>
                  <button
                    type="button"
                    className="admin-danger-button"
                    onClick={() => handleDeleteComment(comment.postId, comment.id)}
                    disabled={deletingCommentId === comment.id || dismissingCommentId === comment.id}
                  >
                    {deletingCommentId === comment.id ? tx('Deleting...') : tx('Delete Comment')}
                  </button>
                </div>
              </article>
            ))}

            {!loading && !reportedComments.length ? (
              <p className="admin-forum-empty">{tx('There are no reported comments yet.')}</p>
            ) : null}
          </div>
        </article>
      </section>

      {!loading && !posts.length ? (
        <p className="admin-forum-empty">{tx('No forum posts match the current search criteria.')}</p>
      ) : null}
    </section>
  );
}

export default AdminForumManagementPage;
