import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import translations from '../../constants/translations';
import {
  createForumComment,
  createForumPost,
  deleteForumComment,
  deleteForumPost,
  fetchForumPosts,
  reportForumComment,
  reportForumPost,
  toggleForumPostLike
} from '../../services/api/forumApi';
import './ForumPage.css';

const FORUM_ACTOR_KEY = 'forum_actor_key';
const MAX_IMAGES_PER_ITEM = 3;

function createEmptyCommentDraft() {
  return {
    content: '',
    isAnonymous: false,
    anonymousAlias: '',
    images: []
  };
}

const FALLBACK_COPY = {
  title: 'Diễn đàn Smart City',
  description:
    'Nơi cộng đồng chia sẻ trải nghiệm địa điểm, mẹo khám phá thành phố và thảo luận cùng nhau.',
  items: [
    {
      title: 'Chia sẻ trải nghiệm',
      copy: 'Đăng bài về quán ăn, điểm check-in, hoặc lịch trình bạn đã thử.'
    },
    {
      title: 'Hỏi đáp nhanh',
      copy: 'Đặt câu hỏi và nhận gợi ý từ cộng đồng theo từng khu vực.'
    },
    {
      title: 'Cập nhật xu hướng',
      copy: 'Theo dõi các chủ đề đang nổi để không bỏ lỡ điểm đến mới.'
    }
  ],
  postsTitle: 'Bài viết mới từ cộng đồng',
  posts: [],
  ui: {
    searchPlaceholder: 'Tìm theo tiêu đề, nội dung, tác giả hoặc chủ đề...',
    createPost: 'Đăng bài',
    hideComposer: 'Đóng',
    emptyResult: 'Hiện tại chưa có bài viết nào được đăng.',
    formTitle: 'Tạo bài viết mới',
    titleLabel: 'Tiêu đề',
    categoryLabel: 'Chủ đề',
    anonymousPost: 'Đăng bài ẩn danh',
    aliasLabel: 'Biệt danh ẩn danh',
    contentLabel: 'Nội dung dài',
    contentHint: 'Tối đa 499 ký tự',
    addImages: 'Thêm ảnh',
    removeImage: 'Xóa ảnh',
    imageLimitHint: 'Tối đa 3 ảnh',
    cancel: 'Hủy',
    submit: 'Đăng bài',
    justNow: 'Vừa xong',
    commentLabel: 'bình luận',
    byAuthor: 'Tác giả:',
    defaultAuthor: 'Người dùng',
    loadingPosts: 'Đang tải bài viết...',
    submitError: 'Không thể đăng bài. Vui lòng thử lại.',
    emptyAliasError: 'Vui lòng nhập biệt danh khi đăng ẩn danh.',
    postLike: 'Thích',
    commentToggle: 'Bình luận',
    reportPost: 'Báo cáo',
    sharePost: 'Chia sẻ',
    shareSuccess: 'Đã sao chép liên kết bài viết.',
    shareError: 'Không thể sao chép liên kết. Vui lòng thử lại.',
    reportDialogTitle: 'Gửi báo cáo',
    reportDialogMessage: 'Nội dung báo cáo sẽ được gửi tới quản trị viên để xem xét.',
    reportDialogPlaceholder: 'Nhập lý do báo cáo...',
    reportDialogConfirm: 'Gửi báo cáo',
    reportReasonRequired: 'Vui lòng nhập lý do báo cáo.',
    loginRequiredAction: 'Bạn cần đăng nhập để sử dụng chức năng này.',
    loginRequiredComment: 'Bạn cần đăng nhập để bình luận.',
    reportPrompt: 'Nhập lý do báo cáo để gửi quản trị viên:',
    reportSuccess: 'Đã gửi báo cáo tới quản trị viên.',
    reportError: 'Không thể gửi báo cáo. Vui lòng thử lại.',
    deletePost: 'Xóa',
    deletePostConfirm: 'Bạn có chắc muốn xóa bài viết này không?',
    deletePostError: 'Không thể xóa bài viết. Vui lòng thử lại.',
    deletePostOwnerOnly: 'Chỉ tác giả bài viết mới có thể xóa.',
    deleteDialogTitle: 'Xác nhận xóa bài viết',
    deleteDialogMessage: 'Hành động này không thể hoàn tác.',
    deleteDialogConfirm: 'Xóa bài viết',
    commentTitle: 'Bình luận',
    commentPlaceholder: 'Nhập bình luận của bạn...',
    commentSubmit: 'Gửi bình luận',
    commentAnonymous: 'Bình luận ẩn danh',
    commentAliasLabel: 'Biệt danh bình luận',
    commentPlusAria: 'Thêm ảnh vào bình luận',
    noCommentsYet: 'Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ.',
    replyToggle: 'Trả lời',
    replyPlaceholder: 'Viết phản hồi của bạn...',
    replySubmit: 'Gửi phản hồi',
    replyAnonymous: 'Phản hồi ẩn danh',
    replyAliasLabel: 'Biệt danh phản hồi',
    hideReplyComposer: 'Đóng phản hồi',
    commentError: 'Không thể gửi bình luận. Vui lòng thử lại.',
    imagePreviewClose: 'Đóng xem ảnh',
    deleteComment: 'Xóa',
    deleteCommentError: 'Không thể xóa bình luận. Vui lòng thử lại.',
    deleteCommentOwnerOnly: 'Chỉ người bình luận hoặc chủ bài viết mới có thể xóa bình luận này.',
    deleteCommentDialogTitle: 'Xác nhận xóa bình luận',
    deleteCommentConfirm: 'Bạn có chắc muốn xóa bình luận này không?',
    deleteCommentDialogMessage: 'Hành động này không thể hoàn tác.',
    deleteCommentDialogConfirm: 'Xóa bình luận'
  }
};

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Cannot read file'));
    reader.readAsDataURL(file);
  });
}

function autoResizeTextarea(target) {
  if (!target) return;
  target.style.height = 'auto';
  target.style.height = `${target.scrollHeight}px`;
}

function formatRelativeTime(value, fallback = 'Vừa xong') {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return String(value);

  const diffMs = Date.now() - parsed;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return fallback;
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} ngày trước`;

  return new Date(parsed).toLocaleDateString('vi-VN');
}

function resolveUserDisplayName(user, fallback = 'Người dùng') {
  const genericNames = new Set(['user', 'nguoi dung', 'người dùng']);
  const candidates = [
    user?.fullname,
    user?.fullName,
    user?.name,
    user?.username,
    user?.userName,
    user?.nickname,
    user?.email ? String(user.email).split('@')[0] : ''
  ];

  for (const value of candidates) {
    const label = String(value || '').trim();
    if (!label) continue;

    const normalized = label.toLowerCase();
    if (genericNames.has(normalized)) continue;

    return label;
  }

  return fallback;
}

function normalizePost(post, justNowText) {
  const commentsList = Array.isArray(post.commentsList) ? post.commentsList : [];
  const serverComments = Number(post.comments || post.commentsCount || 0);

  return {
    ...post,
    content: post.content || post.excerpt || '',
    images: Array.isArray(post.images) ? post.images : [],
    commentsList,
    likesCount: Number(post.likesCount || 0),
    comments: Math.max(serverComments, commentsList.length),
    time: formatRelativeTime(post.time || post.createdAt, justNowText)
  };
}

function getCommentTimestamp(comment) {
  const raw = comment?.createdAt || comment?.time;
  const parsed = Date.parse(String(raw || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildCommentTree(commentsList) {
  const comments = Array.isArray(commentsList) ? commentsList : [];
  const mapped = comments.map((comment) => ({
    ...comment,
    replies: [],
    parentCommentId:
      comment?.parentCommentId === null || comment?.parentCommentId === undefined
        ? null
        : Number(comment.parentCommentId) || null
  }));

  const byId = new Map(mapped.map((item) => [String(item.id), item]));
  const roots = [];

  mapped.forEach((item) => {
    if (item.parentCommentId !== null) {
      const parent = byId.get(String(item.parentCommentId));
      if (parent) {
        parent.replies.push(item);
        return;
      }
    }
    roots.push(item);
  });

  const sortThread = (list, desc = false) => {
    list.sort((a, b) => {
      const diff = getCommentTimestamp(a) - getCommentTimestamp(b);
      return desc ? -diff : diff;
    });

    list.forEach((item) => sortThread(item.replies, false));
  };

  sortThread(roots, true);
  return roots;
}

function ForumPage() {
  const { user, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const copy = t?.forumPage || FALLBACK_COPY;
  const ui = { ...FALLBACK_COPY.ui, ...(copy.ui || {}) };
  const currentDisplayName = resolveUserDisplayName(user, ui.defaultAuthor);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [posts, setPosts] = useState(copy.posts || []);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [draftImages, setDraftImages] = useState([]);
  const [actorKey, setActorKey] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentSubmitting, setCommentSubmitting] = useState({});
  const [commentErrors, setCommentErrors] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replySubmitting, setReplySubmitting] = useState({});
  const [replyErrors, setReplyErrors] = useState({});
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportFeedback, setReportFeedback] = useState('');
  const [reportingCommentId, setReportingCommentId] = useState(null);
  const [commentReportStatus, setCommentReportStatus] = useState({});
  const [deleteTargetComment, setDeleteTargetComment] = useState(null);
  const [deleteCommentSubmitting, setDeleteCommentSubmitting] = useState(false);
  const [deleteCommentFeedback, setDeleteCommentFeedback] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [activeReplyCommentId, setActiveReplyCommentId] = useState(null);
  const [reportingPostId, setReportingPostId] = useState(null);
  const [reportStatusByPost, setReportStatusByPost] = useState({});
  const [shareStatusByPost, setShareStatusByPost] = useState({});
  const [deleteTargetPostId, setDeleteTargetPostId] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState('');
  const commentTextareaRefs = useRef({});
  const replyTextareaRefs = useRef({});

  const [draft, setDraft] = useState({
    title: '',
    category: '',
    content: '',
    isAnonymous: false,
    anonymousAlias: ''
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FORUM_ACTOR_KEY);
      if (saved) {
        setActorKey(saved);
        return;
      }
      const nextKey = `guest_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(FORUM_ACTOR_KEY, nextKey);
      setActorKey(nextKey);
    } catch {
      setActorKey(`guest_${Math.random().toString(36).slice(2, 10)}`);
    }
  }, []);

  useEffect(() => {
    setPosts([]);
    setSearchTerm('');
    setSearchInput('');
    setShowComposer(false);
    setSubmitError('');
    setDraftImages([]);
    setActiveCommentPostId(null);
    setActiveReplyCommentId(null);
    setReportStatusByPost({});
    setShareStatusByPost({});
    setDraft({ title: '', category: '', content: '', isAnonymous: false, anonymousAlias: '' });
    setCommentDrafts({});
    setCommentSubmitting({});
    setCommentErrors({});
    setReplyDrafts({});
    setReplySubmitting({});
    setReplyErrors({});
    setReportTarget(null);
    setReportReason('');
    setReportFeedback('');
    setReportingPostId(null);
    setReportingCommentId(null);
    setCommentReportStatus({});
    setDeleteTargetComment(null);
    setDeleteCommentSubmitting(false);
    setDeleteCommentFeedback('');
    setPreviewImage('');
    setDeleteTargetPostId(null);
    setDeleteSubmitting(false);
    setDeleteFeedback('');
  }, [copy, ui.justNow]);

  useEffect(() => {
    let isMounted = true;

    const loadPosts = async () => {
      setLoadingPosts(true);
      try {
        const apiPosts = await fetchForumPosts();
        if (isMounted && Array.isArray(apiPosts)) {
          setPosts(apiPosts.map((post) => normalizePost(post, ui.justNow)));
        }
      } catch {
        // Keep fallback posts
      } finally {
        if (isMounted) {
          setLoadingPosts(false);
        }
      }
    };

    loadPosts();

    return () => {
      isMounted = false;
    };
  }, [ui.justNow]);

  useEffect(() => {
    Object.values(commentTextareaRefs.current).forEach((el) => autoResizeTextarea(el));
    Object.values(replyTextareaRefs.current).forEach((el) => autoResizeTextarea(el));
  }, [commentDrafts, replyDrafts, activeCommentPostId, activeReplyCommentId]);

  const filteredPosts = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return posts;

    return posts.filter((post) => {
      const commentText = (post.commentsList || []).map((item) => item.content).join(' ');
      const text = [post.title, post.content, post.author, post.category, commentText].join(' ').toLowerCase();
      return text.includes(keyword);
    });
  }, [posts, searchTerm]);

  const handleSubmitSearch = (event) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  };

  const handleDraftChange = (field) => (event) => {
    setDraft((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSelectPostImages = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const remainSlots = MAX_IMAGES_PER_ITEM - draftImages.length;
    const pickedFiles = files.slice(0, Math.max(0, remainSlots));
    if (!pickedFiles.length) return;

    const converted = await Promise.all(pickedFiles.map((file) => toDataUrl(file)));
    setDraftImages((current) => [...current, ...converted].slice(0, MAX_IMAGES_PER_ITEM));
  };

  const removeDraftImage = (index) => {
    setDraftImages((current) => current.filter((_, idx) => idx !== index));
  };

  const submitPost = async (event) => {
    event.preventDefault();
    setSubmitError('');

    if (!isAuthenticated) {
      setSubmitError(ui.loginRequiredAction || 'Bạn cần đăng nhập để sử dụng chức năng này.');
      return;
    }

    const title = draft.title.trim();
    const category = draft.category.trim();
    const content = draft.content.trim();
    const anonymousAlias = draft.anonymousAlias.trim();
    const authorName = currentDisplayName;

    if (!title || !category || !content) return;
    if (content.length > 499) return;

    if (draft.isAnonymous && anonymousAlias.length < 2) {
      setSubmitError(ui.emptyAliasError);
      return;
    }

    setSubmitting(true);
    try {
      const createdPost = await createForumPost({
        title,
        category,
        content,
        images: draftImages,
        actorKey,
        isAnonymous: draft.isAnonymous,
        anonymousAlias: draft.isAnonymous ? anonymousAlias : '',
        authorName
      });

      if (createdPost) {
        setPosts((current) => [normalizePost(createdPost, ui.justNow), ...current]);
      }

      setDraft({ title: '', category: '', content: '', isAnonymous: false, anonymousAlias: '' });
      setDraftImages([]);
      setShowComposer(false);
    } catch (error) {
      const message = String(error?.response?.data?.message || '').trim();
      setSubmitError(message || ui.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  const getCommentDraft = (postId) => commentDrafts[postId] || createEmptyCommentDraft();

  const updateCommentDraft = (postId, patch) => {
    setCommentDrafts((current) => ({
      ...current,
      [postId]: {
        ...getCommentDraft(postId),
        ...patch
      }
    }));
  };

  const getReplyDraft = (commentId) => replyDrafts[commentId] || createEmptyCommentDraft();

  const updateReplyDraft = (commentId, patch) => {
    setReplyDrafts((current) => ({
      ...current,
      [commentId]: {
        ...getReplyDraft(commentId),
        ...patch
      }
    }));
  };

  const appendImagesToDraft = async (draftItem, files) => {
    const remainSlots = MAX_IMAGES_PER_ITEM - draftItem.images.length;
    const picked = Array.from(files || []).slice(0, Math.max(0, remainSlots));
    if (!picked.length) return null;

    const converted = await Promise.all(picked.map((file) => toDataUrl(file)));
    return [...draftItem.images, ...converted].slice(0, MAX_IMAGES_PER_ITEM);
  };

  const handleSelectCommentImages = async (postId, files) => {
    const draftItem = getCommentDraft(postId);
    const nextImages = await appendImagesToDraft(draftItem, files);
    if (!nextImages) return;
    updateCommentDraft(postId, { images: nextImages });
  };

  const handleSelectReplyImages = async (commentId, files) => {
    const draftItem = getReplyDraft(commentId);
    const nextImages = await appendImagesToDraft(draftItem, files);
    if (!nextImages) return;
    updateReplyDraft(commentId, { images: nextImages });
  };

  const removeCommentImage = (postId, index) => {
    const draftItem = getCommentDraft(postId);
    updateCommentDraft(postId, {
      images: draftItem.images.filter((_, idx) => idx !== index)
    });
  };

  const removeReplyImage = (commentId, index) => {
    const draftItem = getReplyDraft(commentId);
    updateReplyDraft(commentId, {
      images: draftItem.images.filter((_, idx) => idx !== index)
    });
  };

  const handleSubmitComment = async (event, postId, parentCommentId = null) => {
    event.preventDefault();

    if (!isAuthenticated) {
      setCommentErrors((current) => ({
        ...current,
        [postId]: ui.loginRequiredComment || 'Bạn cần đăng nhập để bình luận.'
      }));
      return;
    }

    const isReply = parentCommentId !== null;
    const draftItem = isReply ? getReplyDraft(parentCommentId) : getCommentDraft(postId);
    const content = String(draftItem.content || '').trim();
    const alias = String(draftItem.anonymousAlias || '').trim();

    if (!content) return;
    if (content.length > 499) return;

    if (draftItem.isAnonymous && alias.length < 2) {
      if (isReply) {
        setReplyErrors((current) => ({ ...current, [parentCommentId]: ui.emptyAliasError }));
      } else {
        setCommentErrors((current) => ({ ...current, [postId]: ui.emptyAliasError }));
      }
      return;
    }

    const authorName = currentDisplayName;

    if (isReply) {
      setReplySubmitting((current) => ({ ...current, [parentCommentId]: true }));
      setReplyErrors((current) => ({ ...current, [parentCommentId]: '' }));
    } else {
      setCommentSubmitting((current) => ({ ...current, [postId]: true }));
      setCommentErrors((current) => ({ ...current, [postId]: '' }));
    }

    try {
      const createdComment = await createForumComment(postId, {
        content,
        images: draftItem.images,
        parentCommentId,
        isAnonymous: draftItem.isAnonymous,
        anonymousAlias: draftItem.isAnonymous ? alias : '',
        authorName,
        actorKey
      });

      setPosts((current) =>
        current.map((post) => {
          if (String(post.id) !== String(postId)) return post;
          const nextComment = createdComment
            ? {
                ...createdComment,
                time: formatRelativeTime(createdComment.time || createdComment.createdAt, ui.justNow)
              }
            : {
                id: `${Date.now()}`,
                postId,
                parentCommentId,
                content,
                images: draftItem.images,
                author: draftItem.isAnonymous ? alias : currentDisplayName,
                creatorUserId: String(user?.id || user?.userId || user?.sub || '').trim() || null,
                authorActorKey: actorKey || null,
                time: ui.justNow
              };

          const commentsList = [nextComment, ...(post.commentsList || [])];
          return {
            ...post,
            commentsList,
            comments: Math.max(Number(post.comments || 0) + 1, commentsList.length)
          };
        })
      );

      if (isReply) {
        updateReplyDraft(parentCommentId, createEmptyCommentDraft());
        setActiveReplyCommentId(null);
      } else {
        updateCommentDraft(postId, createEmptyCommentDraft());
      }
    } catch (error) {
      const message = String(error?.response?.data?.message || '').trim();
      if (isReply) {
        setReplyErrors((current) => ({ ...current, [parentCommentId]: message || ui.commentError }));
      } else {
        setCommentErrors((current) => ({ ...current, [postId]: message || ui.commentError }));
      }
    } finally {
      if (isReply) {
        setReplySubmitting((current) => ({ ...current, [parentCommentId]: false }));
      } else {
        setCommentSubmitting((current) => ({ ...current, [postId]: false }));
      }
    }
  };

  const handleToggleLike = async (postId) => {
    if (!isAuthenticated) {
      setReportStatusByPost((current) => ({
        ...current,
        [postId]: ui.loginRequiredAction || 'Bạn cần đăng nhập để sử dụng chức năng này.'
      }));
      return;
    }

    if (!actorKey) return;

    try {
      const result = await toggleForumPostLike(postId, actorKey);
      setPosts((current) =>
        current.map((post) =>
          String(post.id) === String(postId)
            ? {
                ...post,
                likesCount: Number(result?.likesCount || 0)
              }
            : post
        )
      );
    } catch {
      // noop
    }
  };

  const handleReportPost = (postId) => {
    if (!isAuthenticated) {
      setReportStatusByPost((current) => ({
        ...current,
        [postId]: ui.loginRequiredAction || 'Bạn cần đăng nhập để sử dụng chức năng này.'
      }));
      return;
    }

    setReportTarget({ type: 'post', postId, commentId: null });
    setReportReason('');
    setReportFeedback('');
  };

  const handleCancelReport = () => {
    if (reportingPostId || reportingCommentId) return;
    setReportTarget(null);
    setReportReason('');
    setReportFeedback('');
  };

  const handleConfirmReport = async () => {
    if (!reportTarget) return;

    const reasonText = String(reportReason || '').trim();
    if (!reasonText) {
      setReportFeedback(ui.reportReasonRequired || 'Vui lòng nhập lý do báo cáo.');
      return;
    }

    if (!actorKey) {
      setReportFeedback(ui.reportError || 'Không thể gửi báo cáo lúc này.');
      return;
    }

    const isPostReport = reportTarget.type === 'post';
    const postId = Number(reportTarget.postId);
    const commentId = Number(reportTarget.commentId || 0);

    if (isPostReport) {
      setReportingPostId(postId);
      setReportStatusByPost((current) => ({ ...current, [postId]: '' }));
    } else {
      setReportingCommentId(commentId);
      setCommentReportStatus((current) => ({ ...current, [commentId]: '' }));
    }
    setReportFeedback('');

    try {
      if (isPostReport) {
        await reportForumPost(postId, { actorKey, reason: reasonText });
        setReportStatusByPost((current) => ({
          ...current,
          [postId]: ui.reportSuccess || 'Đã gửi báo cáo tới quản trị viên.'
        }));
      } else {
        await reportForumComment(postId, commentId, { actorKey, reason: reasonText });
        setCommentReportStatus((current) => ({
          ...current,
          [commentId]: ui.reportCommentSuccess || 'Đã gửi báo cáo bình luận tới quản trị viên.'
        }));
      }

      setReportTarget(null);
      setReportReason('');
      setReportFeedback('');
    } catch (error) {
      const message = String(error?.response?.data?.message || '').trim();
      setReportFeedback(
        message ||
          (isPostReport
            ? (ui.reportError || 'Không thể gửi báo cáo. Vui lòng thử lại.')
            : (ui.reportCommentError || 'Không thể gửi báo cáo bình luận. Vui lòng thử lại.'))
      );
    } finally {
      if (isPostReport) {
        setReportingPostId(null);
      } else {
        setReportingCommentId(null);
      }
    }
  };

  const copyTextToClipboard = async (text) => {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', 'readonly');
    helper.style.position = 'fixed';
    helper.style.top = '-1000px';
    document.body.appendChild(helper);
    helper.select();
    document.execCommand('copy');
    document.body.removeChild(helper);
  };

  const handleSharePost = async (postId) => {
    if (!isAuthenticated) {
      setShareStatusByPost((current) => ({
        ...current,
        [postId]: ui.loginRequiredAction || 'Bạn cần đăng nhập để sử dụng chức năng này.'
      }));
      return;
    }

    try {
      const shareUrl = new URL(window.location.href);
      shareUrl.searchParams.set('postId', String(postId));
      await copyTextToClipboard(shareUrl.toString());
      setShareStatusByPost((current) => ({
        ...current,
        [postId]: ui.shareSuccess || 'Đã sao chép liên kết bài viết.'
      }));
    } catch {
      setShareStatusByPost((current) => ({
        ...current,
        [postId]: ui.shareError || 'Không thể sao chép liên kết. Vui lòng thử lại.'
      }));
    }
  };

  const handleDeletePost = async (postId) => {
    if (!isAuthenticated) {
      setDeleteFeedback(ui.loginRequiredAction || 'Bạn cần đăng nhập để sử dụng chức năng này.');
      return;
    }

    setDeleteFeedback('');
    setDeleteTargetPostId(postId);
  };

  const handleConfirmDeletePost = async () => {
    if (!deleteTargetPostId) return;

    const authorName = currentDisplayName;

    try {
      setDeleteSubmitting(true);
      await deleteForumPost(deleteTargetPostId, { actorKey, authorName });
      setPosts((current) => current.filter((post) => String(post.id) !== String(deleteTargetPostId)));
      setDeleteTargetPostId(null);
      setDeleteFeedback('');
    } catch (error) {
      const message = String(error?.response?.data?.message || '').trim();
      setDeleteFeedback(message || ui.deletePostError || 'Không thể xóa bài viết. Vui lòng thử lại.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const collectDescendantCommentIds = (comments, rootCommentId) => {
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
  };

  const handleRequestDeleteComment = (postContext, comment) => {
    if (!isAuthenticated) {
      setCommentErrors((current) => ({
        ...current,
        [postContext.postId]: ui.loginRequiredAction || 'Bạn cần đăng nhập để sử dụng chức năng này.'
      }));
      return;
    }

    setDeleteCommentFeedback('');
    setDeleteTargetComment({
      postId: postContext.postId,
      commentId: comment.id
    });
  };

  const handleReportComment = (postId, commentId) => {
    if (!isAuthenticated) {
      setCommentReportStatus((current) => ({
        ...current,
        [commentId]: ui.loginRequiredAction || 'Bạn cần đăng nhập để sử dụng chức năng này.'
      }));
      return;
    }

    setReportTarget({ type: 'comment', postId, commentId });
    setReportReason('');
    setReportFeedback('');
  };

  const handleConfirmDeleteComment = async () => {
    if (!deleteTargetComment) return;

    const { postId, commentId } = deleteTargetComment;
    const authorName = currentDisplayName;

    setDeleteCommentSubmitting(true);
    setDeleteCommentFeedback('');

    try {
      const result = await deleteForumComment(postId, commentId, { actorKey, authorName });
      setPosts((current) =>
        current.map((post) => {
          if (String(post.id) !== String(postId)) return post;

          const commentsList = Array.isArray(post.commentsList) ? post.commentsList : [];
          const toRemove = collectDescendantCommentIds(commentsList, commentId);
          const nextCommentsList = commentsList.filter((item) => !toRemove.has(String(item.id)));
          const removedCount = Number(result?.deletedCount || 0) || toRemove.size;

          return {
            ...post,
            commentsList: nextCommentsList,
            comments: Math.max(0, Math.max(Number(post.comments || 0) - removedCount, nextCommentsList.length))
          };
        })
      );
      setActiveReplyCommentId(null);
      setDeleteTargetComment(null);
      setDeleteCommentFeedback('');
    } catch (error) {
      const message = String(error?.response?.data?.message || '').trim();
      setDeleteCommentFeedback(message || ui.deleteCommentError || 'Không thể xóa bình luận. Vui lòng thử lại.');
    } finally {
      setDeleteCommentSubmitting(false);
    }
  };

  const renderCommentNode = (postContext, comment, depth = 0) => {
    const { postId, canDeletePost, currentUserId, currentAuthorName } = postContext;
    const replyDraft = getReplyDraft(comment.id);
    const isReplyOpen = String(activeReplyCommentId) === String(comment.id);
    const commentCreatorUserId = String(comment.creatorUserId || '').trim();
    const commentActorKey = String(comment.authorActorKey || '').trim();
    const commentAuthorName = String(comment.author || '').trim();
    const canDeleteComment = Boolean(
      canDeletePost ||
      (currentUserId && commentCreatorUserId && currentUserId === commentCreatorUserId) ||
      (actorKey && commentActorKey && actorKey === commentActorKey) ||
      (currentAuthorName && commentAuthorName && currentAuthorName === commentAuthorName)
    );

    return (
      <article key={`${comment.id}-${depth}`} className={`forum-comment-item${depth > 0 ? ' is-reply' : ''}`}>
        <div className="forum-comment-head">
          <strong>{comment.author}</strong>
          <span>{formatRelativeTime(comment.time || comment.createdAt, ui.justNow)}</span>
        </div>
        <p>{comment.content}</p>

        {comment.images?.length ? (
          <div className="forum-comment-image-grid">
            {comment.images.map((src, index) => (
              <button
                key={`${comment.id}-img-${index}`}
                type="button"
                className="forum-comment-image-button"
                onClick={() => setPreviewImage(src)}
                aria-label={`Xem ảnh bình luận ${index + 1}`}
              >
                <img src={src} alt={`comment-${index + 1}`} loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="forum-comment-actions">
          {isAuthenticated ? (
            <button
              type="button"
              className="forum-comment-reply-btn"
              onClick={() => setActiveReplyCommentId((current) => (String(current) === String(comment.id) ? null : comment.id))}
            >
              {isReplyOpen ? ui.hideReplyComposer : ui.replyToggle}
            </button>
          ) : null}
          {isAuthenticated && canDeleteComment ? (
            <button
              type="button"
              className="forum-comment-reply-btn"
              onClick={() => handleRequestDeleteComment(postContext, comment)}
            >
              {ui.deleteComment || 'Xóa'}
            </button>
          ) : null}
          {isAuthenticated ? (
            <button
              type="button"
              className="forum-comment-reply-btn"
              onClick={() => handleReportComment(postId, comment.id)}
              disabled={reportingCommentId === comment.id}
            >
              {ui.reportComment || 'Báo cáo bình luận'}
            </button>
          ) : null}
        </div>
        {commentReportStatus[comment.id] ? <p className="forum-report-status">{commentReportStatus[comment.id]}</p> : null}

        {isAuthenticated && isReplyOpen ? (
          <form className="forum-comment-form is-reply-form" onSubmit={(event) => handleSubmitComment(event, postId, comment.id)}>
            <div className="forum-comment-input-shell">
              <textarea
                ref={(el) => {
                  if (!el) {
                    delete replyTextareaRefs.current[comment.id];
                    return;
                  }
                  replyTextareaRefs.current[comment.id] = el;
                  autoResizeTextarea(el);
                }}
                value={replyDraft.content}
                onChange={(event) => {
                  updateReplyDraft(comment.id, { content: event.target.value });
                  autoResizeTextarea(event.target);
                }}
                onInput={(event) => autoResizeTextarea(event.target)}
                maxLength={499}
                rows={1}
                placeholder={ui.replyPlaceholder}
                required
              />
              <div className="forum-comment-toolbar">
                <label className="forum-comment-plus-button" aria-label={ui.commentPlusAria}>
                  <span>+</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={async (event) => {
                      await handleSelectReplyImages(comment.id, event.target.files);
                      event.target.value = '';
                    }}
                    disabled={(replyDraft.images || []).length >= MAX_IMAGES_PER_ITEM}
                  />
                </label>
                <small className="forum-hint-text">
                  {ui.contentHint} ({replyDraft.content.length}/499)
                </small>
              </div>
            </div>

            {(replyDraft.images || []).length ? (
              <div className="forum-image-preview-grid is-comment-preview">
                {replyDraft.images.map((src, index) => (
                  <figure key={`${comment.id}-reply-draft-${index}`} className="forum-image-preview-item">
                    <img src={src} alt={`reply-draft-${index + 1}`} loading="lazy" />
                    <button type="button" onClick={() => removeReplyImage(comment.id, index)}>
                      {ui.removeImage}
                    </button>
                  </figure>
                ))}
              </div>
            ) : null}

            <div className="forum-anonymous-row">
              <button
                type="button"
                className={`forum-anonymous-toggle${replyDraft.isAnonymous ? ' is-active' : ''}`}
                onClick={() => updateReplyDraft(comment.id, { isAnonymous: !replyDraft.isAnonymous })}
              >
                {ui.replyAnonymous}
              </button>
              {replyDraft.isAnonymous ? (
                <label className="forum-alias-field">
                  <span>{ui.replyAliasLabel}</span>
                  <input
                    type="text"
                    value={replyDraft.anonymousAlias}
                    onChange={(event) => updateReplyDraft(comment.id, { anonymousAlias: event.target.value })}
                    minLength={2}
                    required
                  />
                </label>
              ) : null}
            </div>

            {replyErrors[comment.id] ? <p className="forum-submit-error">{replyErrors[comment.id]}</p> : null}

            <div className="forum-composer-actions">
              <button type="submit" className="forum-submit-button" disabled={Boolean(replySubmitting[comment.id])}>
                {ui.replySubmit}
              </button>
            </div>
          </form>
        ) : null}

        {comment.replies?.length ? (
          <div className="forum-comment-replies">
            {comment.replies.map((child) => renderCommentNode(postContext, child, depth + 1))}
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <main className="forum-page" aria-labelledby="forum-title">
      <section className="forum-hero">
        <p className="forum-kicker">Smart City Community</p>
        <h1 id="forum-title">{copy.title}</h1>
        <p>{copy.description}</p>
      </section>

      <section className="forum-grid" aria-label="Forum features">
        {copy.items.map((item) => (
          <article key={item.title} className="forum-card">
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
          </article>
        ))}
      </section>

      <section className="forum-posts" aria-label="Forum posts">
        <div className="forum-posts-header">
          <h2>{copy.postsTitle}</h2>
          <div className="forum-post-actions">
            <form className="forum-search-form" onSubmit={handleSubmitSearch}>
              <div className="forum-search-shell">
                <span className="forum-search-leading-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M10.5 3a7.5 7.5 0 0 1 6.02 11.98l4.25 4.25-1.42 1.42-4.25-4.25A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" />
                  </svg>
                </span>
                <input
                  type="search"
                  className="forum-search-input"
                  value={searchInput}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setSearchInput(nextValue);
                    if (!nextValue.trim()) {
                      setSearchTerm('');
                    }
                  }}
                  placeholder={ui.searchPlaceholder}
                  aria-label={ui.searchPlaceholder}
                />
                <button
                  type="submit"
                  className="forum-search-submit"
                  aria-label={ui.searchAction || (language === 'en' ? 'Search' : 'Tìm kiếm')}
                >
                  {ui.searchAction || (language === 'en' ? 'Search' : 'Tìm kiếm')}
                </button>
              </div>
            </form>
            <button
              type="button"
              className="forum-create-button forum-create-post-button"
              onClick={() => setShowComposer((current) => !current)}
              disabled={!isAuthenticated}
              title={isAuthenticated ? (ui.createPost || 'Đăng bài') : (ui.loginRequiredAction || 'Bạn cần đăng nhập để sử dụng chức năng này.')}
            >
              <span className="forum-create-button-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" />
                </svg>
              </span>
              {showComposer ? ui.hideComposer : ui.createPost}
            </button>
          </div>
        </div>

        {isAuthenticated && showComposer ? (
          <form className="forum-composer" onSubmit={submitPost}>
            <h3>{ui.formTitle}</h3>
            <div className="forum-composer-grid">
              <label>
                <span>{ui.titleLabel}</span>
                <input type="text" value={draft.title} onChange={handleDraftChange('title')} required />
              </label>
              <label>
                <span>{ui.categoryLabel}</span>
                <input type="text" value={draft.category} onChange={handleDraftChange('category')} required />
              </label>
              <label className="forum-composer-full">
                <span>
                  {ui.contentLabel} ({draft.content.length}/499)
                </span>
                <textarea value={draft.content} onChange={handleDraftChange('content')} rows={6} maxLength={499} required />
                <small className="forum-hint-text">{ui.contentHint}</small>
              </label>
            </div>

            <div className="forum-images-block">
              <label className="forum-image-picker">
                <span>{ui.addImages}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleSelectPostImages}
                  disabled={draftImages.length >= MAX_IMAGES_PER_ITEM}
                />
              </label>
              <small className="forum-hint-text">{ui.imageLimitHint}</small>
              {draftImages.length ? (
                <div className="forum-image-preview-grid">
                  {draftImages.map((src, index) => (
                    <figure key={`${src.slice(0, 20)}-${index}`} className="forum-image-preview-item">
                      <img src={src} alt={`draft-${index + 1}`} loading="lazy" />
                      <button type="button" onClick={() => removeDraftImage(index)}>
                        {ui.removeImage}
                      </button>
                    </figure>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="forum-anonymous-row">
              <button
                type="button"
                className={`forum-anonymous-toggle${draft.isAnonymous ? ' is-active' : ''}`}
                onClick={() => setDraft((current) => ({ ...current, isAnonymous: !current.isAnonymous }))}
              >
                {ui.anonymousPost}
              </button>
              {draft.isAnonymous ? (
                <label className="forum-alias-field">
                  <span>{ui.aliasLabel}</span>
                  <input
                    type="text"
                    value={draft.anonymousAlias}
                    onChange={handleDraftChange('anonymousAlias')}
                    minLength={2}
                    required
                  />
                </label>
              ) : null}
            </div>

            {submitError ? <p className="forum-submit-error">{submitError}</p> : null}

            <div className="forum-composer-actions">
              <button
                type="button"
                className="forum-cancel-button"
                onClick={() => {
                  setShowComposer(false);
                  setSubmitError('');
                  setDraft({ title: '', category: '', content: '', isAnonymous: false, anonymousAlias: '' });
                  setDraftImages([]);
                }}
                disabled={submitting}
              >
                {ui.cancel}
              </button>
              <button type="submit" className="forum-submit-button" disabled={submitting}>
                {ui.submit}
              </button>
            </div>
          </form>
        ) : null}

        {loadingPosts ? <p className="forum-loading-state">{ui.loadingPosts}</p> : null}

        <div className="forum-post-list">
          {filteredPosts.map((post) => {
            const commentDraft = getCommentDraft(post.id);
            const commentTree = buildCommentTree(post.commentsList || []);
            const currentUserId = String(user?.id || user?.userId || user?.sub || '').trim();
            const postCreatorUserId = String(post.creatorUserId || '').trim();
            const postActorKey = String(post.authorActorKey || '').trim();
            const postAuthorName = String(post.author || '').trim();
            const currentAuthorName = resolveUserDisplayName(user, '');
            const canDeletePost = Boolean(
              (currentUserId && postCreatorUserId && currentUserId === postCreatorUserId) ||
              (actorKey && postActorKey && actorKey === postActorKey) ||
              (currentAuthorName && postAuthorName && currentAuthorName === postAuthorName)
            );
            const postContext = {
              postId: post.id,
              canDeletePost,
              currentUserId,
              currentAuthorName
            };
            return (
              <article key={`${post.id || post.title}-${post.time || post.createdAt || ''}`} className="forum-post-item">
                <div className="forum-post-meta">
                  <span className="forum-post-category">{post.category}</span>
                  <span>{post.time}</span>
                </div>
                <h3>{post.title}</h3>
                <p>{post.content || post.excerpt}</p>

                {post.images?.length ? (
                  <div className="forum-post-image-grid">
                    {post.images.map((src, index) => (
                      <button
                        key={`${post.id}-img-${index}`}
                        type="button"
                        className="forum-post-image-button"
                        onClick={() => setPreviewImage(src)}
                        aria-label={`Xem ảnh bài viết ${index + 1}`}
                      >
                        <img src={src} alt={`post-${index + 1}`} loading="lazy" />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="forum-post-footer">
                  <span>
                    {ui.byAuthor} {post.author}
                  </span>
                </div>

                <div className="forum-post-engagement">
                  <button
                    type="button"
                    className="forum-action-button is-like"
                    onClick={() => handleToggleLike(post.id)}
                    disabled={!isAuthenticated}
                    title={isAuthenticated ? (ui.postLike || 'Thích') : (ui.loginRequiredAction || 'Bạn cần đăng nhập để sử dụng chức năng này.')}
                  >
                    <span className="forum-action-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M12 21s-6.7-4.2-9.4-8.1C.8 10.3 1.6 6.9 4.4 5.4c2.1-1.1 4.6-.4 6 1.4 1.4-1.8 3.9-2.5 6-1.4 2.8 1.5 3.6 4.9 1.8 7.5C18.7 16.8 12 21 12 21z" />
                      </svg>
                    </span>
                    <span>{ui.postLike} ({post.likesCount || 0})</span>
                  </button>
                  <button
                    type="button"
                    className="forum-action-button is-comment"
                    onClick={() => {
                      setActiveReplyCommentId(null);
                      setActiveCommentPostId((current) => (String(current) === String(post.id) ? null : post.id));
                    }}
                  >
                    <span className="forum-action-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm2 5h12v2H6V9zm0 4h8v2H6v-2z" />
                      </svg>
                    </span>
                    <span>{ui.commentToggle || 'Bình luận'} ({post.comments || 0})</span>
                  </button>
                  <button
                    type="button"
                    className="forum-action-button is-share"
                    onClick={() => handleSharePost(post.id)}
                    disabled={!isAuthenticated}
                    title={isAuthenticated ? (ui.sharePost || 'Chia sẻ') : (ui.loginRequiredAction || 'Bạn cần đăng nhập để sử dụng chức năng này.')}
                  >
                    <span className="forum-action-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M15 8a3 3 0 1 0-2.8-4H12a3 3 0 0 0 .2 1.1L7.8 8A3 3 0 0 0 6 7.5a3 3 0 1 0 1.8 5.4l4.4 2.9a3 3 0 1 0 .7-1l-4.4-2.9a3 3 0 0 0 0-1l4.4-2.9A3 3 0 0 0 15 8z" />
                      </svg>
                    </span>
                    <span>{ui.sharePost || 'Chia sẻ'}</span>
                  </button>
                  <button
                    type="button"
                    className="forum-action-button is-report"
                    onClick={() => handleReportPost(post.id)}
                    disabled={!isAuthenticated || reportingPostId === post.id}
                    title={isAuthenticated ? (ui.reportPost || 'Báo cáo') : (ui.loginRequiredAction || 'Bạn cần đăng nhập để sử dụng chức năng này.')}
                  >
                    <span className="forum-action-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M6 2h2v20H6V2zm4 2h9l-2 4 2 4h-9V4z" />
                      </svg>
                    </span>
                    <span>{ui.reportPost || 'Báo cáo'}</span>
                  </button>
                  <button
                    type="button"
                    className="forum-action-button is-delete"
                    onClick={() => handleDeletePost(post.id)}
                    disabled={!isAuthenticated || !canDeletePost}
                    title={
                      !isAuthenticated
                        ? (ui.loginRequiredAction || 'Bạn cần đăng nhập để sử dụng chức năng này.')
                        : canDeletePost
                          ? (ui.deletePost || 'Xóa')
                          : (ui.deletePostOwnerOnly || 'Chỉ tác giả bài viết mới có thể xóa.')
                    }
                  >
                    <span className="forum-action-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z" />
                      </svg>
                    </span>
                    <span>{ui.deletePost || 'Xóa'}</span>
                  </button>
                </div>

                {reportStatusByPost[post.id] ? <p className="forum-report-status">{reportStatusByPost[post.id]}</p> : null}
                {shareStatusByPost[post.id] ? <p className="forum-report-status">{shareStatusByPost[post.id]}</p> : null}

                <section
                  className="forum-comments-block"
                  aria-label={ui.commentTitle}
                  hidden={String(activeCommentPostId) !== String(post.id)}
                >
                  <h4>
                    {ui.commentTitle} ({post.comments || 0})
                  </h4>

                  <div className="forum-comment-list">
                    {commentTree.length
                      ? commentTree.map((comment) => renderCommentNode(postContext, comment))
                      : <p className="forum-empty-state is-comments-empty">{ui.noCommentsYet}</p>}
                  </div>

                  {isAuthenticated ? (
                    <form className="forum-comment-form" onSubmit={(event) => handleSubmitComment(event, post.id)}>
                    <div className="forum-comment-input-shell">
                      <textarea
                        ref={(el) => {
                          if (!el) {
                            delete commentTextareaRefs.current[post.id];
                            return;
                          }
                          commentTextareaRefs.current[post.id] = el;
                          autoResizeTextarea(el);
                        }}
                        value={commentDraft.content}
                        onChange={(event) => {
                          updateCommentDraft(post.id, { content: event.target.value });
                          autoResizeTextarea(event.target);
                        }}
                        onInput={(event) => autoResizeTextarea(event.target)}
                        maxLength={499}
                        rows={1}
                        placeholder={ui.commentPlaceholder}
                        required
                      />
                      <div className="forum-comment-toolbar">
                        <label className="forum-comment-plus-button" aria-label={ui.commentPlusAria}>
                          <span>+</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={async (event) => {
                              await handleSelectCommentImages(post.id, event.target.files);
                              event.target.value = '';
                            }}
                            disabled={(commentDraft.images || []).length >= MAX_IMAGES_PER_ITEM}
                          />
                        </label>
                        <small className="forum-hint-text">
                          {ui.contentHint} ({commentDraft.content.length}/499)
                        </small>
                      </div>
                    </div>

                    {(commentDraft.images || []).length ? (
                      <div className="forum-image-preview-grid is-comment-preview">
                        {commentDraft.images.map((src, index) => (
                          <figure key={`${post.id}-draft-comment-${index}`} className="forum-image-preview-item">
                            <img src={src} alt={`comment-draft-${index + 1}`} loading="lazy" />
                            <button type="button" onClick={() => removeCommentImage(post.id, index)}>
                              {ui.removeImage}
                            </button>
                          </figure>
                        ))}
                      </div>
                    ) : null}

                    <div className="forum-anonymous-row">
                      <button
                        type="button"
                        className={`forum-anonymous-toggle${commentDraft.isAnonymous ? ' is-active' : ''}`}
                        onClick={() => updateCommentDraft(post.id, { isAnonymous: !commentDraft.isAnonymous })}
                      >
                        {ui.commentAnonymous}
                      </button>
                      {commentDraft.isAnonymous ? (
                        <label className="forum-alias-field">
                          <span>{ui.commentAliasLabel}</span>
                          <input
                            type="text"
                            value={commentDraft.anonymousAlias}
                            onChange={(event) => updateCommentDraft(post.id, { anonymousAlias: event.target.value })}
                            minLength={2}
                            required
                          />
                        </label>
                      ) : null}
                    </div>

                    {commentErrors[post.id] ? <p className="forum-submit-error">{commentErrors[post.id]}</p> : null}

                    <div className="forum-composer-actions">
                      <button type="submit" className="forum-submit-button" disabled={Boolean(commentSubmitting[post.id])}>
                        {ui.commentSubmit}
                      </button>
                    </div>
                    </form>
                  ) : (
                    <p className="forum-report-status">{ui.loginRequiredComment || 'Bạn cần đăng nhập để bình luận.'}</p>
                  )}
                </section>
              </article>
            );
          })}

          {!filteredPosts.length ? <p className="forum-empty-state">{ui.emptyResult}</p> : null}
        </div>
      </section>

      {reportTarget ? (
        <div
          className="forum-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={ui.reportDialogTitle || 'Gửi báo cáo'}
        >
          <div className="forum-modal-card">
            <h3>{ui.reportDialogTitle || 'Gửi báo cáo'}</h3>
            <p>
              {reportTarget.type === 'comment'
                ? (ui.reportCommentPrompt || 'Nhập lý do báo cáo bình luận này:')
                : (ui.reportPrompt || 'Nhập lý do báo cáo bài viết:')}
            </p>
            <p className="forum-modal-note">
              {ui.reportDialogMessage || 'Nội dung báo cáo sẽ được gửi tới quản trị viên để xem xét.'}
            </p>
            <textarea
              className="forum-modal-textarea"
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              placeholder={ui.reportDialogPlaceholder || 'Nhập lý do báo cáo...'}
              rows={4}
              maxLength={400}
              disabled={Boolean(reportingPostId || reportingCommentId)}
              autoFocus
            />
            {reportFeedback ? <p className="forum-submit-error">{reportFeedback}</p> : null}
            <div className="forum-modal-actions">
              <button
                type="button"
                className="forum-cancel-button"
                onClick={handleCancelReport}
                disabled={Boolean(reportingPostId || reportingCommentId)}
              >
                {ui.cancel}
              </button>
              <button
                type="button"
                className="forum-submit-button"
                onClick={handleConfirmReport}
                disabled={Boolean(reportingPostId || reportingCommentId)}
              >
                {ui.reportDialogConfirm || ui.reportPost || 'Gửi báo cáo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTargetPostId ? (
        <div className="forum-modal-overlay" role="dialog" aria-modal="true" aria-label={ui.deleteDialogTitle || ui.deletePostConfirm}>
          <div className="forum-modal-card">
            <h3>{ui.deleteDialogTitle || 'Xác nhận xóa bài viết'}</h3>
            <p>{ui.deletePostConfirm || 'Bạn có chắc muốn xóa bài viết này không?'}</p>
            <p className="forum-modal-note">{ui.deleteDialogMessage || 'Hành động này không thể hoàn tác.'}</p>
            {deleteFeedback ? <p className="forum-submit-error">{deleteFeedback}</p> : null}
            <div className="forum-modal-actions">
              <button
                type="button"
                className="forum-cancel-button"
                onClick={() => {
                  if (deleteSubmitting) return;
                  setDeleteTargetPostId(null);
                  setDeleteFeedback('');
                }}
                disabled={deleteSubmitting}
              >
                {ui.cancel}
              </button>
              <button
                type="button"
                className="forum-submit-button"
                onClick={handleConfirmDeletePost}
                disabled={deleteSubmitting}
              >
                {ui.deleteDialogConfirm || ui.deletePost || 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTargetComment ? (
        <div
          className="forum-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={ui.deleteCommentDialogTitle || ui.deleteCommentConfirm}
        >
          <div className="forum-modal-card">
            <h3>{ui.deleteCommentDialogTitle || 'Xác nhận xóa bình luận'}</h3>
            <p>{ui.deleteCommentConfirm || 'Bạn có chắc muốn xóa bình luận này không?'}</p>
            <p className="forum-modal-note">{ui.deleteCommentDialogMessage || 'Hành động này không thể hoàn tác.'}</p>
            {deleteCommentFeedback ? <p className="forum-submit-error">{deleteCommentFeedback}</p> : null}
            <div className="forum-modal-actions">
              <button
                type="button"
                className="forum-cancel-button"
                onClick={() => {
                  if (deleteCommentSubmitting) return;
                  setDeleteTargetComment(null);
                  setDeleteCommentFeedback('');
                }}
                disabled={deleteCommentSubmitting}
              >
                {ui.cancel}
              </button>
              <button
                type="button"
                className="forum-submit-button"
                onClick={handleConfirmDeleteComment}
                disabled={deleteCommentSubmitting}
              >
                {ui.deleteCommentDialogConfirm || ui.deleteComment || 'Xóa bình luận'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewImage ? (
        <div
          className="forum-image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh bình luận"
          onClick={() => setPreviewImage('')}
        >
          <div className="forum-image-lightbox-content" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="forum-image-lightbox-close"
              onClick={() => setPreviewImage('')}
              aria-label={ui.imagePreviewClose || 'Đóng xem ảnh'}
            >
              ×
            </button>
            <img src={previewImage} alt="comment-preview" loading="lazy" />
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default ForumPage;
