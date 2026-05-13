import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';
import useAdminI18n from '../../hooks/useAdminI18n';
import { deleteAdminForumComment, deleteAdminForumPost, fetchAdminForumPosts } from '../../services/api/adminForumApi';
import './AdminForumOverviewPage.css';

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

function resolveRootSelectedComments(comments, selectedCommentIds) {
  const selectedSet = new Set((selectedCommentIds || []).map((id) => String(id)));
  const parentById = new Map();

  comments.forEach((item) => {
    parentById.set(String(item.id), item?.parentCommentId === null || item?.parentCommentId === undefined ? null : String(item.parentCommentId));
  });

  return [...selectedSet].filter((id) => {
    let parentId = parentById.get(id);
    while (parentId) {
      if (selectedSet.has(parentId)) {
        return false;
      }
      parentId = parentById.get(parentId) || null;
    }

    return true;
  });
}

function AdminForumOverviewPage() {
  const { language, tx, formatDateTime, formatNumber } = useAdminI18n();
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [deletingCommentsPostId, setDeletingCommentsPostId] = useState(null);
  const [selectedCommentsByPost, setSelectedCommentsByPost] = useState({});

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
          setError(message || tx('Unable to load forum data.'));
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

  const handleSubmitSearch = (event) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  };

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
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setActionError(message || tx('Unable to delete this post right now. Please try again.'));
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleToggleCommentSelection = (postId, commentId) => {
    setSelectedCommentsByPost((current) => {
      const key = String(postId);
      const nextSet = new Set((current[key] || []).map((id) => String(id)));
      const commentKey = String(commentId);

      if (nextSet.has(commentKey)) {
        nextSet.delete(commentKey);
      } else {
        nextSet.add(commentKey);
      }

      return {
        ...current,
        [key]: [...nextSet]
      };
    });
  };

  const handleDeleteSelectedComments = async (postId) => {
    const post = posts.find((item) => String(item.id) === String(postId));
    const comments = Array.isArray(post?.commentsList) ? post.commentsList : [];
    const selectedIds = selectedCommentsByPost[String(postId)] || [];

    if (!selectedIds.length) {
      setActionError(tx('Select at least one comment to delete.'));
      setActionSuccess('');
      return;
    }

    const accepted = window.confirm(tx('Are you sure you want to delete the selected comments? If a root comment is selected, its entire reply thread will be removed.'));
    if (!accepted) return;

    setActionError('');
    setActionSuccess('');
    setDeletingCommentsPostId(postId);

    try {
      const rootIds = resolveRootSelectedComments(comments, selectedIds);
      for (const commentId of rootIds) {
        await deleteAdminForumComment(postId, commentId);
      }

      const toRemove = new Set();
      rootIds.forEach((rootId) => {
        const descendants = collectDescendantCommentIds(comments, rootId);
        descendants.forEach((id) => toRemove.add(id));
      });

      setPosts((current) =>
        current.map((item) => {
          if (String(item.id) !== String(postId)) return item;

          const itemComments = Array.isArray(item.commentsList) ? item.commentsList : [];
          const nextComments = itemComments.filter((comment) => !toRemove.has(String(comment.id)));

          return {
            ...item,
            commentsList: nextComments,
            comments: Math.max(0, Number(item.comments || 0) - toRemove.size),
            commentReportCount: nextComments.filter((comment) => Number(comment.reportCount || 0) > 0).length
          };
        })
      );

      setSelectedCommentsByPost((current) => ({ ...current, [String(postId)]: [] }));
      setActionSuccess(language === 'vi' ? `Đã xóa ${formatNumber(toRemove.size)} bình luận.` : `Deleted ${toRemove.size} comment(s).`);
    } catch (apiError) {
      const message = String(apiError?.response?.data?.message || apiError?.message || '').trim();
      setActionError(message || tx('Unable to delete the selected comments. Please try again.'));
    } finally {
      setDeletingCommentsPostId(null);
    }
  };

  return (
    <section className="admin-forum-overview-page">
      <header className="admin-forum-overview-header">
        <div>
          <p className="admin-forum-overview-eyebrow">{tx('Forum moderation workspace')}</p>
          <h2>{tx('Forum Overview')}</h2>
          <p>{tx('Review all posts and comments. Reported content is prioritized and highlighted for faster moderation.')}</p>
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

      <section className="admin-forum-overview-stats">
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
          placeholder={tx('Search by title, content, author, or comment...')}
          aria-label={tx('Search forum content')}
        />
        <button type="submit">{tx('Search')}</button>
      </form>

      {error ? <p className="admin-forum-overview-error">{error}</p> : null}
      {actionError ? <p className="admin-forum-overview-error">{actionError}</p> : null}
      {actionSuccess ? <p className="admin-forum-overview-loading">{actionSuccess}</p> : null}
      {loading ? <p className="admin-forum-overview-loading">{tx('Loading forum data...')}</p> : null}

      <div className="admin-forum-overview-list">
        {posts.map((post) => {
          const comments = Array.isArray(post.commentsList) ? post.commentsList : [];
          const selectedCommentIds = selectedCommentsByPost[String(post.id)] || [];
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
                    {tx('Author:')} <strong>{post.author}</strong> • {tx('Topic:')} <strong>{post.category}</strong>
                  </p>
                </div>
                <div className="admin-forum-overview-meta">
                  {postIsReported ? <span className="admin-forum-overview-badge is-post">{tx('Reported Post')}</span> : null}
                  {!postIsReported && reportedCommentsCount > 0 ? (
                    <span className="admin-forum-overview-badge is-comment">{tx('Reported Comments')}</span>
                  ) : null}
                  <span>{formatDateTime(post.lastReportedAt || post.createdAt)}</span>
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
                <span>{tx('Likes')}: {formatNumber(post.likesCount || 0)}</span>
                <span>{tx('Comments')}: {formatNumber(comments.length)}</span>
                <span className={postIsReported ? 'is-highlight' : ''}>{tx('Post reports:')} {formatNumber(post.reportCount || 0)}</span>
                <span className={reportedCommentsCount > 0 ? 'is-highlight' : ''}>{tx('Comment reports:')} {formatNumber(reportedCommentsCount)}</span>
              </div>

              <div className="admin-forum-overview-actions">
                <button
                  type="button"
                  className="admin-forum-overview-delete-comment-button"
                  onClick={() => handleDeleteSelectedComments(post.id)}
                  disabled={deletingCommentsPostId === post.id || deletingPostId === post.id}
                >
                  {deletingCommentsPostId === post.id
                    ? tx('Deleting comments...')
                    : `${tx('Delete selected comments')}${selectedCommentIds.length ? ` (${formatNumber(selectedCommentIds.length)})` : ''}`}
                </button>
                <button
                  type="button"
                  className="admin-forum-overview-delete-button"
                  onClick={() => handleDeletePost(post.id)}
                  disabled={deletingPostId === post.id || deletingCommentsPostId === post.id}
                >
                  {deletingPostId === post.id ? tx('Deleting...') : tx('Delete post')}
                </button>
              </div>

              <section className="admin-forum-overview-comments">
                <h4>{tx('Comments ({count})', { count: formatNumber(comments.length) })}</h4>
                <ul>
                  {comments.map((comment) => {
                    const commentIsReported = Number(comment.reportCount || 0) > 0;

                    return (
                      <li key={`comment-${comment.id}`} className={commentIsReported ? 'is-reported' : ''}>
                        <label className="admin-forum-overview-comment-select">
                          <input
                            type="checkbox"
                            checked={selectedCommentIds.includes(String(comment.id))}
                            onChange={() => handleToggleCommentSelection(post.id, comment.id)}
                            disabled={deletingCommentsPostId === post.id || deletingPostId === post.id}
                          />
                          <span>{tx('Select')}</span>
                        </label>
                        <div className="admin-forum-overview-comment-head">
                          <strong>{comment.author}</strong>
                          <span>{formatDateTime(comment.lastReportedAt || comment.createdAt)}</span>
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
                          <small className="admin-forum-overview-comment-flag">{tx('Reported comments:')} {formatNumber(comment.reportCount || 0)}</small>
                        ) : null}
                      </li>
                    );
                  })}

                  {!comments.length ? <li className="is-empty">{tx('No comments yet.')}</li> : null}
                </ul>
              </section>
            </article>
          );
        })}

        {!loading && !posts.length ? <p className="admin-forum-overview-empty">{tx('No forum posts match the current search.')}</p> : null}
      </div>
    </section>
  );
}

export default AdminForumOverviewPage;
