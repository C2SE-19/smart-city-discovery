import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
	createVenueReviewReply,
	createVenueReview,
	deleteVenueReview,
	fetchVenueCommunityBundle,
	fetchVenueDetails,
	fetchVenueOpeningHoursRealtime,
	toggleVenueReviewLike
} from '../../services/api/venuesApi';
import { APP_ROUTES } from '../../constants/routes';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { normalizeVenueMetadata } from '../../components/map/cityMapUtils';
import './VenueDetailPage.css';

const FALLBACK_VENUE_IMAGE =
	'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80';

const WEEK_DAYS = [
	{ key: 'monday', label: 'Thứ hai' },
	{ key: 'tuesday', label: 'Thứ ba' },
	{ key: 'wednesday', label: 'Thứ tư' },
	{ key: 'thursday', label: 'Thứ năm' },
	{ key: 'friday', label: 'Thứ sáu' },
	{ key: 'saturday', label: 'Thứ bảy' },
	{ key: 'sunday', label: 'Chủ nhật' }
];

const REVIEW_BLOCKED_TERMS = [
	'địt',
	'cc',
    'cl',
	'đụ',
	'dm',
	'dcm',
	'đéo',
	'cặc',
	'lồn',
	'đĩ',
	'vcl'
];

const PAGE_I18N = {
	vi: {
		replyRequired: 'Nội dung thảo luận không được để trống.',
		replyBlocked: 'Nội dung thảo luận chứa từ ngữ không phù hợp.',
		replySubmitFail: 'Không thể gửi thảo luận.',
		repliesEmpty: 'Chưa có thảo luận nào.',
		repliesLoginHint: 'Đăng nhập để thảo luận.',
		discuss: 'Thảo luận',
		replyTitle: 'Thảo luận bình luận',
		rating: 'Đánh giá sao',
		notSelected: 'Chưa chọn',
		title: 'Tiêu đề',
		detailComment: 'Mô tả chi tiết bình luận',
		uploadMedia: 'Ảnh & Video',
		maxSixImages: 'Tối đa 6 ảnh',
		submitComment: 'Bình luận',
		submitting: 'Đang gửi...',
		replyPlaceholder: 'Mô tả chi tiết bình luận ...',
		reviewCommentPlaceholder: 'Mô tả chi tiết bình luận ...',
		replyTitlePlaceholder: 'Tiêu đề'
	},
	en: {
		replyRequired: 'Discussion content is required.',
		replyBlocked: 'Discussion contains inappropriate words.',
		replySubmitFail: 'Unable to send discussion.',
		repliesEmpty: 'No discussions yet.',
		repliesLoginHint: 'Please sign in to discuss.',
		discuss: 'Discuss',
		replyTitle: 'Discuss review',
		rating: 'Rating',
		notSelected: 'Not selected',
		title: 'Title',
		detailComment: 'Detailed comment',
		uploadMedia: 'Photo & Video',
		maxSixImages: 'Up to 6 images',
		submitComment: 'Comment',
		submitting: 'Submitting...',
		replyPlaceholder: 'Write detailed discussion...',
		reviewCommentPlaceholder: 'Write detailed comment...',
		replyTitlePlaceholder: 'Title'
	}
};

function normalizeModerationText(value) {
	return String(value || '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function findBlockedTerm(text) {
	const normalized = normalizeModerationText(text);

	if (!normalized) {
		return null;
	}

	for (const term of REVIEW_BLOCKED_TERMS) {
		const normalizedTerm = normalizeModerationText(term);
		if (!normalizedTerm) {
			continue;
		}

		if (normalized.includes(normalizedTerm)) {
			return term;
		}
	}

	return null;
}

function resolveAssetUrl(url, apiBase) {
	const normalized = String(url || '').trim();

	if (!normalized) {
		return '';
	}

	if (/^https?:\/\//i.test(normalized)) {
		return normalized;
	}

	if (normalized.startsWith('/')) {
		return `${apiBase}${normalized}`;
	}

	return `${apiBase}/${normalized}`;
}

function toStars(rating) {
	const rounded = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
	return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`;
}

function resolveVenueName(venue) {
	return venue?.name || venue?.title || 'Địa điểm chưa đặt tên';
}

function resolveCoverImage(venue) {
	return venue?.cover_image_url || venue?.coverImageUrl || FALLBACK_VENUE_IMAGE;
}

function resolveWeeklySchedule(venue) {
	const metadata = normalizeVenueMetadata(venue?.metadata);
	const canonicalSource =
		metadata.weeklySchedule && typeof metadata.weeklySchedule === 'object' && !Array.isArray(metadata.weeklySchedule)
			? metadata.weeklySchedule
			: null;

	const legacySource =
		metadata.weeklyOpenHours && typeof metadata.weeklyOpenHours === 'object' && !Array.isArray(metadata.weeklyOpenHours)
			? WEEK_DAYS.reduce((accumulator, day) => {
				const legacyDay = metadata.weeklyOpenHours?.[day.key] || {};
				const openTime = String(legacyDay.openTime || '').trim();
				const closeTime = String(legacyDay.closeTime || '').trim();
				const isOff = Boolean(legacyDay.isClosed) || openTime.toUpperCase() === 'OFF' || closeTime.toUpperCase() === 'OFF';

				accumulator[day.key] = {
					start: isOff ? 'OFF' : openTime,
					end: isOff ? 'OFF' : closeTime,
					off: isOff
				};

				return accumulator;
			}, {})
			: null;

	const source = canonicalSource || legacySource;
	const fallbackStart = String(metadata.startTime || '').trim();
	const fallbackEnd = String(metadata.endTime || '').trim();
	const hasFallbackRange =
		/^\d{2}:\d{2}$/.test(fallbackStart) && /^\d{2}:\d{2}$/.test(fallbackEnd) && fallbackStart < fallbackEnd;

	if (source || hasFallbackRange) {
		return WEEK_DAYS.map((day) => {
			const item = source[day.key] || {};
			const start = String(item.start || '').trim() || (hasFallbackRange ? fallbackStart : '');
			const end = String(item.end || '').trim() || (hasFallbackRange ? fallbackEnd : '');
			const off = Boolean(item.off) || start === 'OFF' || end === 'OFF';

			return {
				key: day.key,
				label: day.label,
				open: off ? 'OFF' : start || 'N/A',
				close: off ? 'OFF' : end || 'N/A',
				off
			};
		});
	}

	return [];
}

function formatDisplayTime(value) {
	if (!value || value === 'OFF') {
		return 'Đóng cửa';
	}

	return value;
}

function resolveTodaySchedule(weeklySchedule) {
	if (!Array.isArray(weeklySchedule) || !weeklySchedule.length) {
		return null;
	}

	const dayKeyByIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
	const todayKey = dayKeyByIndex[new Date().getDay()] || 'monday';
	return weeklySchedule.find((item) => item.key === todayKey) || null;
}

function resolveVenuePriceRange(venue) {
	const metadata = normalizeVenueMetadata(venue?.metadata);
	const minPrice = Number(metadata.minPrice ?? metadata.min_price);
	const maxPrice = Number(metadata.maxPrice ?? metadata.max_price);

	if (Number.isFinite(minPrice) && Number.isFinite(maxPrice) && minPrice > 0 && maxPrice >= minPrice) {
		return `${minPrice.toLocaleString('vi-VN')}đ - ${maxPrice.toLocaleString('vi-VN')}đ`;
	}

	const directCandidates = [venue?.price, venue?.price_range, metadata.price, metadata.priceRange]
		.map((item) => String(item || '').trim())
		.filter(Boolean);

	return directCandidates[0] || 'Đang cập nhật';
}

function normalizeScheduleLabel(item) {
	const key = String(item?.key || '').toLowerCase();
	return WEEK_DAYS.find((day) => day.key === key)?.label || item?.label || '';
}

function buildVenueReportQuery(venue) {
	const params = new URLSearchParams();
	params.set('source', 'venue-detail');
	params.set('venueId', String(venue?.id || ''));
	params.set('venueName', resolveVenueName(venue));
	params.set('venueAddress', String(venue?.address || ''));
	return params.toString();
}

function buildReviewReportQuery(venue, review) {
	const params = new URLSearchParams();
	params.set('source', 'venue-review');
	params.set('venueId', String(venue?.id || ''));
	params.set('venueName', resolveVenueName(venue));
	params.set('reviewId', String(review?.id || ''));
	params.set('reviewAuthor', String(review?.authorName || 'Ẩn danh'));
	return params.toString();
}

function VenueDetailPage() {
	const { venueId } = useParams();
	const navigate = useNavigate();
	const { token } = useAuth();
	const { language } = useLanguage();
	const { theme } = useTheme();
	const apiUrl = useMemo(() => import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api', []);
	const apiBase = useMemo(() => apiUrl.replace(/\/api\/v1$|\/api$/i, ''), [apiUrl]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [venue, setVenue] = useState(null);
	const [reviews, setReviews] = useState([]);
	const [communityStats, setCommunityStats] = useState({ averageRating: 0, totalReviews: 0 });
	const [allReviewImages, setAllReviewImages] = useState([]);
	const [showOpeningHoursModal, setShowOpeningHoursModal] = useState(false);
	const [showCommentModal, setShowCommentModal] = useState(false);
	const [showImagesModal, setShowImagesModal] = useState(false);
	const [showFavoritesModal, setShowFavoritesModal] = useState(false);
	const [showShareModal, setShowShareModal] = useState(false);
	const [shareCopied, setShareCopied] = useState(false);
	const [openingRealtime, setOpeningRealtime] = useState(null);
	const [openingLoading, setOpeningLoading] = useState(false);
	const [openingError, setOpeningError] = useState('');
	const [submittingReview, setSubmittingReview] = useState(false);
	const [reviewError, setReviewError] = useState('');
	const [reviewActionError, setReviewActionError] = useState('');
	const [showReplyModal, setShowReplyModal] = useState(false);
	const [activeReplyReview, setActiveReplyReview] = useState(null);
	const [replySubmitting, setReplySubmitting] = useState(false);
	const [replyForm, setReplyForm] = useState({
		rating: null,
		title: '',
		content: '',
		images: []
	});
	const i18n = PAGE_I18N[language] || PAGE_I18N.vi;
	const [favoriteLoading, setFavoriteLoading] = useState(false);
	const [isFavorite, setIsFavorite] = useState(false);
	const [favoriteError, setFavoriteError] = useState('');
	const [favoriteCollection, setFavoriteCollection] = useState([]);
	const [favoriteCollectionLoading, setFavoriteCollectionLoading] = useState(false);
	const [favoriteCollectionError, setFavoriteCollectionError] = useState('');
	const [reviewForm, setReviewForm] = useState({
		rating: null,
		title: '',
		comment: '',
		images: []
	});
	const shareUrl = useMemo(() => {
		if (typeof window !== 'undefined' && window.location?.origin) {
			return `${window.location.origin}/venues/${venueId}`;
		}

		return `${apiBase}/venues/${venueId}`;
	}, [apiBase, venueId]);

	const weeklySchedule = useMemo(() => resolveWeeklySchedule(venue), [venue]);
	const todaySchedule = useMemo(() => resolveTodaySchedule(weeklySchedule), [weeklySchedule]);
	const venuePriceRange = useMemo(() => resolveVenuePriceRange(venue), [venue]);
	const favoriteVenueId = useMemo(() => String(venue?.id ?? venue?.venue_id ?? venueId ?? '').trim(), [venue?.id, venue?.venue_id, venueId]);
	const authToken = useMemo(() => String(token || '').replace(/^Bearer\s+/i, '').trim(), [token]);
	const reviewImagePreviews = useMemo(
		() => reviewForm.images.map((file) => ({ id: `${file.name}-${file.lastModified}-${file.size}`, url: URL.createObjectURL(file) })),
		[reviewForm.images]
	);
	const replyImagePreviews = useMemo(
		() => replyForm.images.map((file) => ({ id: `${file.name}-${file.lastModified}-${file.size}`, url: URL.createObjectURL(file) })),
		[replyForm.images]
	);

	const applyCommunityData = (communityData, fallbackVenue = null) => {
		if (fallbackVenue) {
			setVenue(fallbackVenue);
		} else if (communityData?.venue) {
			setVenue(communityData.venue);
		}

		setReviews(Array.isArray(communityData?.reviews) ? communityData.reviews : []);
		setCommunityStats({
			averageRating: Number(communityData?.stats?.averageRating || 0),
			totalReviews: Number(communityData?.stats?.totalReviews || 0)
		});
		setAllReviewImages(Array.isArray(communityData?.reviewImages) ? communityData.reviewImages : []);
	};

	const reloadCommunityData = async () => {
		const nextCommunityData = await fetchVenueCommunityBundle(venueId);
		applyCommunityData(nextCommunityData);
		return nextCommunityData;
	};

	useEffect(() => {
		return () => {
			reviewImagePreviews.forEach((item) => URL.revokeObjectURL(item.url));
		};
	}, [reviewImagePreviews]);

	useEffect(() => {
		return () => {
			replyImagePreviews.forEach((item) => URL.revokeObjectURL(item.url));
		};
	}, [replyImagePreviews]);

	useEffect(() => {
		let mounted = true;

		async function loadVenueDetail() {
			setLoading(true);
			setError('');

			try {
				const [venueData, communityData] = await Promise.all([
					fetchVenueDetails(venueId),
					fetchVenueCommunityBundle(venueId)
				]);

				if (!mounted) {
					return;
				}

				const resolvedVenue = communityData?.venue || venueData;
				applyCommunityData(communityData, resolvedVenue);
			} catch (requestError) {
				if (!mounted) {
					return;
				}

				setError(requestError?.response?.data?.message || 'Không thể tải chi tiết địa điểm.');
			} finally {
				if (mounted) {
					setLoading(false);
				}
			}
		}

		loadVenueDetail();

		return () => {
			mounted = false;
		};
	}, [venueId]);

	useEffect(() => {
		let active = true;
		const intervalId = window.setInterval(async () => {
			try {
				const nextCommunityData = await fetchVenueCommunityBundle(venueId);
				if (!active) {
					return;
				}

				applyCommunityData(nextCommunityData);
			} catch {
				// Keep current UI on transient sync errors.
			}
		}, 12000);

		return () => {
			active = false;
			window.clearInterval(intervalId);
		};
	}, [venueId]);

	useEffect(() => {
		let active = true;

		const loadFavoriteState = async () => {
			if (!authToken || !favoriteVenueId) {
				setIsFavorite(false);
				return;
			}

			try {
				const response = await axios.get(`${apiUrl}/users/favorites`, {
					headers: { Authorization: `Bearer ${authToken}` }
				});

				if (!active) {
					return;
				}

				const favoriteSet = new Set(
					Array.isArray(response.data?.favorites)
						? response.data.favorites.map((item) => `${item.itemType}:${item.itemId}`)
						: []
				);

				setIsFavorite(favoriteSet.has(`place:${favoriteVenueId}`));
			} catch {
				if (active) {
					setIsFavorite(false);
				}
			}
		};

		loadFavoriteState();

		return () => {
			active = false;
		};
	}, [apiUrl, authToken, favoriteVenueId]);

	useEffect(() => {
		let active = true;
		let intervalId = null;

		const loadOpeningRealtime = async (showLoader = false) => {
			if (showLoader) {
				setOpeningLoading(true);
			}
			setOpeningError('');

			try {
				const data = await fetchVenueOpeningHoursRealtime(venueId);
				if (!active) {
					return;
				}

				setOpeningRealtime(data);
			} catch (requestError) {
				if (!active) {
					return;
				}

				setOpeningError(requestError?.response?.data?.message || 'Không thể tải giờ hoạt động realtime.');
			} finally {
				if (active) {
					setOpeningLoading(false);
				}
			}
		};

		loadOpeningRealtime(true);
		intervalId = window.setInterval(() => loadOpeningRealtime(false), 30000);

		return () => {
			active = false;
			if (intervalId) {
				window.clearInterval(intervalId);
			}
		};
	}, [venueId]);

	const handleChangeReviewField = (field, value) => {
		setReviewForm((prev) => ({ ...prev, [field]: value }));
	};

	const handleSelectRating = (ratingValue) => {
		handleChangeReviewField('rating', ratingValue);
	};

	const handleCopyShareLink = async () => {
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(shareUrl);
				setShareCopied(true);
				window.setTimeout(() => setShareCopied(false), 1800);
			}
		} catch {
			setShareCopied(false);
		}
	};

	const handlePickReviewImages = (event) => {
		const nextFiles = Array.from(event.target.files || []);
		setReviewForm((prev) => ({ ...prev, images: [...prev.images, ...nextFiles].slice(0, 6) }));
		event.target.value = '';
	};

	const fetchFavoriteCollection = async () => {
		if (!authToken) {
			return [];
		}

		const response = await axios.get(`${apiUrl}/users/favorites`, {
			headers: { Authorization: `Bearer ${authToken}` }
		});

		return Array.isArray(response.data?.favorites) ? response.data.favorites : [];
	};

	const handleOpenFavoriteCollection = async () => {
		if (!authToken) {
			navigate(APP_ROUTES.LOGIN);
			return;
		}

		setShowFavoritesModal(true);
		setFavoriteCollectionLoading(true);
		setFavoriteCollectionError('');

		try {
			const favorites = await fetchFavoriteCollection();
			setFavoriteCollection(favorites.filter((item) => String(item.itemType || '').toLowerCase() === 'place'));
		} catch {
			setFavoriteCollection([]);
			setFavoriteCollectionError('Không thể tải danh sách quán yêu thích.');
		} finally {
			setFavoriteCollectionLoading(false);
		}
	};

	const handleRemoveFavoriteItem = async (item) => {
		if (!authToken || !item?.itemId) {
			return;
		}

		try {
			await axios.post(
				`${apiUrl}/users/favorites/toggle`,
				{
					itemId: item.itemId,
					itemType: item.itemType,
					name: item.name,
					image: item.image,
					price: item.price,
					description: item.description
				},
				{
					headers: { Authorization: `Bearer ${authToken}` }
				}
			);

			setFavoriteCollection((prev) =>
				prev.filter((favorite) => !(favorite.itemType === item.itemType && String(favorite.itemId) === String(item.itemId)))
			);

			if (String(item.itemType) === 'place' && String(item.itemId) === favoriteVenueId) {
				setIsFavorite(false);
			}
		} catch {
			setFavoriteCollectionError('Không thể bỏ yêu thích quán này.');
		}
	};

	const handleRemoveReviewImage = (imageId) => {
		setReviewForm((prev) => ({
			...prev,
			images: prev.images.filter((file) => `${file.name}-${file.lastModified}-${file.size}` !== imageId)
		}));
	};

	const handleToggleFavorite = async () => {
		if (!favoriteVenueId) {
			return;
		}

		if (!authToken) {
			navigate(APP_ROUTES.LOGIN);
			return;
		}

		setFavoriteError('');
		setFavoriteLoading(true);
		try {
			const response = await axios.post(
				`${apiUrl}/users/favorites/toggle`,
				{
					itemId: favoriteVenueId,
					itemType: 'place',
					name: resolveVenueName(venue),
					image: resolveCoverImage(venue),
					price: venuePriceRange,
					description: venue.address || ''
				},
				{
					headers: { Authorization: `Bearer ${authToken}` }
				}
			);

			setIsFavorite(Boolean(response.data?.favorited));
			if (showFavoritesModal) {
				const favorites = await fetchFavoriteCollection();
				setFavoriteCollection(favorites.filter((item) => String(item.itemType || '').toLowerCase() === 'place'));
			}
		} catch (requestError) {
			if (requestError?.response?.status === 401) {
				setFavoriteError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
				navigate(APP_ROUTES.LOGIN);
			} else {
				setFavoriteError(requestError?.response?.data?.message || 'Nút yêu thích đang lỗi. Vui lòng thử lại.');
			}
		} finally {
			setFavoriteLoading(false);
		}
	};

	const handleSubmitReview = async (event) => {
		event.preventDefault();
		setReviewError('');
		setReviewActionError('');

		const normalizedTitle = reviewForm.title.trim();
		const normalizedComment = reviewForm.comment.trim();

		if (!normalizedComment) {
			setReviewError('Vui lòng nhập nội dung bình luận.');
			return;
		}

		const blockedTerm = findBlockedTerm(`${normalizedTitle} ${normalizedComment}`);
		if (blockedTerm) {
			setReviewError('Nội dung bình luận có từ ngữ không phù hợp. Vui lòng chỉnh sửa lại.');
			return;
		}

		const payload = new FormData();
		if (Number.isInteger(reviewForm.rating) && reviewForm.rating >= 1 && reviewForm.rating <= 5) {
			payload.append('rating', String(reviewForm.rating));
		}
		payload.append('title', normalizedTitle);
		payload.append('comment', normalizedComment);
		reviewForm.images.forEach((file) => payload.append('images', file));

		setSubmittingReview(true);
		try {
			await createVenueReview(venueId, payload);
			await reloadCommunityData();

			setReviewForm({ rating: null, title: '', comment: '', images: [] });
			setShowCommentModal(false);
		} catch (submitError) {
			setReviewError(submitError?.response?.data?.message || 'Gửi bình luận thất bại.');
		} finally {
			setSubmittingReview(false);
		}
	};

	const handleOpenReplyModal = (review) => {
		setReviewActionError('');
		setActiveReplyReview(review);
		setReplyForm({ rating: null, title: '', content: '', images: [] });
		setShowReplyModal(true);
	};

	const handleSelectReplyRating = (ratingValue) => {
		setReplyForm((prev) => ({ ...prev, rating: ratingValue }));
	};

	const handleChangeReplyContent = (value) => {
		setReplyForm((prev) => ({ ...prev, content: value }));
	};

	const handlePickReplyImages = (event) => {
		const nextFiles = Array.from(event.target.files || []);
		setReplyForm((prev) => ({ ...prev, images: [...prev.images, ...nextFiles].slice(0, 6) }));
		event.target.value = '';
	};

	const handleRemoveReplyImage = (imageId) => {
		setReplyForm((prev) => ({
			...prev,
			images: prev.images.filter((file) => `${file.name}-${file.lastModified}-${file.size}` !== imageId)
		}));
	};

	const handleChangeReplyTitle = (value) => {
		setReplyForm((prev) => ({ ...prev, title: value }));
	};

	const handleToggleReviewLike = async (review) => {
		if (!authToken) {
			navigate(APP_ROUTES.LOGIN);
			return;
		}

		setReviewActionError('');
		try {
			const response = await toggleVenueReviewLike(venueId, review.id);
			setReviews((prev) =>
				prev.map((item) =>
					item.id === review.id
						? {
							...item,
							likeCount: Number(response?.likeCount || 0),
							likedByMe: Boolean(response?.liked)
						}
						: item
				)
			);
		} catch (error) {
			setReviewActionError(error?.response?.data?.message || 'Không thể cập nhật lượt thích.');
		}
	};

	const handleSubmitReviewReply = async () => {
		if (!activeReplyReview?.id) {
			return;
		}

		if (!authToken) {
			navigate(APP_ROUTES.LOGIN);
			return;
		}

		const draft = String(replyForm.content || '').trim();
		if (!draft) {
			setReviewActionError(i18n.replyRequired);
			return;
		}

		setReviewActionError('');
		setReplySubmitting(true);
		try {
			const payload = new FormData();
			payload.append('content', draft);
			if (replyForm.title.trim()) {
				payload.append('title', replyForm.title.trim());
			}
			if (Number.isInteger(replyForm.rating) && replyForm.rating >= 1 && replyForm.rating <= 5) {
				payload.append('rating', String(replyForm.rating));
			}
			replyForm.images.forEach((file) => payload.append('images', file));

			await createVenueReviewReply(venueId, activeReplyReview.id, payload);
			const synced = await reloadCommunityData();
			const updatedReview = Array.isArray(synced?.reviews)
				? synced.reviews.find((item) => String(item.id) === String(activeReplyReview.id))
				: null;

			if (updatedReview) {
				setActiveReplyReview(updatedReview);
			}

			setReplyForm({ rating: null, title: '', content: '', images: [] });
		} catch (error) {
			setReviewActionError(error?.response?.data?.message || i18n.replySubmitFail);
		} finally {
			setReplySubmitting(false);
		}
	};

	const handleDeleteReview = async (review) => {
		if (!review?.canDelete) {
			return;
		}

		const confirmed = window.confirm('Bạn có chắc muốn xóa bình luận này không?');
		if (!confirmed) {
			return;
		}

		setReviewActionError('');
		try {
			await deleteVenueReview(venueId, review.id);
			await reloadCommunityData();
		} catch (error) {
			setReviewActionError(error?.response?.data?.message || 'Không thể xóa bình luận.');
		}
	};

	useEffect(() => {
		if (!showReplyModal || !activeReplyReview?.id) {
			return;
		}

		const nextActiveReview = reviews.find((item) => String(item.id) === String(activeReplyReview.id));
		if (nextActiveReview) {
			setActiveReplyReview(nextActiveReview);
		}
	}, [reviews, showReplyModal, activeReplyReview?.id]);

	if (loading) {
		return <section className={`venue-detail-page theme-${theme}`}><p>Đang tải chi tiết quán...</p></section>;
	}

	if (error || !venue) {
		return (
			<section className={`venue-detail-page theme-${theme}`}>
				<div className="venue-detail-error-box">
					<p>{error || 'Không tìm thấy địa điểm.'}</p>
					<button type="button" onClick={() => navigate(-1)}>Quay lại</button>
				</div>
			</section>
		);
	}

	const currentOpen = openingRealtime?.current || null;
	const isRealtimeReady = Boolean(currentOpen);
	const displayStart = currentOpen?.start || todaySchedule?.open || 'N/A';
	const displayEnd = currentOpen?.end || todaySchedule?.close || 'N/A';
	const displayStatusText = !isRealtimeReady ? 'Đang cập nhật' : currentOpen?.isOpen ? 'Đang mở cửa' : 'Đã đóng cửa';
	const showOpenState = isRealtimeReady ? currentOpen?.isOpen : !todaySchedule?.off;
	const displaySchedule = openingRealtime?.weeklySchedule || weeklySchedule;

	return (
		<section className={`venue-detail-page theme-${theme}`}>
			<article className="venue-detail-hero-card">
				<div className="venue-detail-cover-wrap">
					<img src={resolveCoverImage(venue)} alt={resolveVenueName(venue)} className="venue-detail-cover" />
				</div>

				<div className="venue-detail-main-info">
					<div className="venue-detail-quick-actions">
						<button
							type="button"
							className={`venue-icon-btn ${isFavorite ? 'is-active' : ''}`}
							onClick={handleToggleFavorite}
							disabled={favoriteLoading}
							aria-label="Yêu thích"
						>
							{isFavorite ? '♥' : '♡'}
						</button>
					</div>

					<h1>{resolveVenueName(venue)}</h1>
					<p className="venue-detail-address">📍 {venue.address || 'Chưa có địa chỉ'}</p>
					{venue.ward_name ? <p className="venue-detail-ward">🗺️ {venue.ward_name}</p> : null}

					<p className="venue-detail-opening-inline">
						<span className={showOpenState ? 'is-open' : 'is-close'}>
							{displayStatusText}
						</span>
						<span>
							{formatDisplayTime(displayStart)} - {formatDisplayTime(displayEnd)}
						</span>
						<button
							type="button"
							className="venue-open-info-btn"
							onClick={() => setShowOpeningHoursModal(true)}
							aria-label="Xem giờ hoạt động chi tiết"
						>
							!
						</button>
					</p>

					<p className="venue-detail-price-row">$ {venuePriceRange}</p>

					<div className="venue-detail-rating-row">
						<span>{toStars(communityStats.averageRating || 0)}</span>
						<span>{Number(communityStats.averageRating || 0).toFixed(1)}/5 ({communityStats.totalReviews} đánh giá)</span>
					</div>

					{favoriteError ? <p className="venue-form-error">{favoriteError}</p> : null}

					<div className="venue-detail-bottom-actions">
						<button
							type="button"
							className="venue-report-btn"
							onClick={() => navigate(`${APP_ROUTES.FEEDBACK}?${buildVenueReportQuery(venue)}`)}
						>
							⚑ Báo cáo
						</button>
					</div>
				</div>
			</article>

			<div className="venue-detail-actions-row">
				<button
					type="button"
					className="venue-action-btn"
					onClick={handleOpenFavoriteCollection}
					disabled={favoriteCollectionLoading}
				>
					{isFavorite ? '♥' : '♡'} Yêu thích & Bộ sưu tập
				</button>
				<button type="button" className="venue-action-btn" onClick={() => setShowCommentModal(true)}>💬 Bình luận</button>
				<button type="button" className="venue-action-btn" onClick={() => setShowImagesModal(true)}>🖼️ Hình ảnh</button>
				<button
					type="button"
					className="venue-action-btn"
					onClick={() => setShowShareModal(true)}
				>
					↗ Chia sẻ
				</button>
			</div>

			<section className="venue-detail-reviews-section">
				<h2>Bình luận</h2>
				{reviewActionError ? <p className="venue-form-error">{reviewActionError}</p> : null}

				{!reviews.length ? <p>Chưa có bình luận nào cho quán này.</p> : null}

				<div className="venue-review-list">
					{reviews.map((review) => (
						<article key={`review-${review.id}`} className="venue-review-card">
							<header>
								<strong>{review.authorName || 'Ẩn danh'}</strong>
								<span>{new Date(review.createdAt || review.created_at).toLocaleString('vi-VN')}</span>
							</header>
							<p className="venue-review-stars">{toStars(review.rating)} · {Number(review.rating || 0).toFixed(1)}</p>
							{review.title ? <h3>{review.title}</h3> : null}
							<p>{review.comment}</p>

							{Array.isArray(review.imageUrls) && review.imageUrls.length ? (
								<div className="venue-review-image-grid">
									{review.imageUrls.map((imageUrl) => (
										<img
											key={`${review.id}-${imageUrl}`}
											src={resolveAssetUrl(imageUrl, apiBase)}
											alt="Review attachment"
											loading="lazy"
										/>
									))}
								</div>
							) : null}

							<div className="venue-review-actions">
								<button
									type="button"
									className={`venue-review-action-btn ${review.likedByMe ? 'is-active' : ''}`}
									onClick={() => handleToggleReviewLike(review)}
								>
									<span aria-hidden="true">♥</span>
									<span>Thích</span>
									<strong>{Number(review.likeCount || 0)}</strong>
								</button>

								<button
									type="button"
									className="venue-review-action-btn"
									onClick={() => handleOpenReplyModal(review)}
								>
									<span aria-hidden="true">💬</span>
									<span>{i18n.discuss}</span>
									<strong>{Number(review.replyCount || 0)}</strong>
								</button>

								<button
									type="button"
									className="venue-review-action-btn"
									onClick={() => navigate(`${APP_ROUTES.FEEDBACK}?${buildReviewReportQuery(venue, review)}`)}
								>
									<span aria-hidden="true">⚠</span>
									<span>Báo lỗi</span>
								</button>

								{review.canDelete ? (
									<button
										type="button"
										className="venue-review-action-btn is-danger"
										onClick={() => handleDeleteReview(review)}
									>
										<span aria-hidden="true">🗑</span>
										<span>Xóa</span>
									</button>
								) : null}
							</div>

							{Array.isArray(review.replies) && review.replies.length ? (
								<div className="venue-review-reply-preview-list">
									{review.replies.map((reply) => (
										<div key={`reply-preview-${review.id}-${reply.id}`} className="venue-review-reply-item">
											<strong>{reply.authorName || 'Ẩn danh'}</strong>
											<span>{new Date(reply.createdAt || reply.created_at).toLocaleString('vi-VN')}</span>
											{Number(reply.rating || 0) > 0 ? <p className="venue-review-stars">{toStars(reply.rating)} · {Number(reply.rating || 0).toFixed(1)}</p> : null}
											{reply.title ? <h4 className="venue-review-reply-title">{reply.title}</h4> : null}
											<p>{reply.content}</p>
											{Array.isArray(reply.imageUrls) && reply.imageUrls.length ? (
												<div className="venue-review-image-grid">
													{reply.imageUrls.map((imageUrl) => (
														<img
															key={`reply-image-${reply.id}-${imageUrl}`}
															src={resolveAssetUrl(imageUrl, apiBase)}
															alt="Reply attachment"
															loading="lazy"
														/>
													))}
												</div>
											) : null}
										</div>
									))}
								</div>
							) : null}
						</article>
					))}
				</div>
			</section>

			{showOpeningHoursModal ? (
				<div className="venue-modal-overlay" onClick={() => setShowOpeningHoursModal(false)}>
					<div className="venue-modal-card venue-modal-schedule-modern" onClick={(event) => event.stopPropagation()}>
						<div className="venue-modal-schedule-topbar">
							<div className="venue-modal-live-state" aria-live="polite">
								<span className={`venue-live-dot ${showOpenState ? 'is-open' : 'is-close'}`} aria-hidden="true" />
								<strong>{displayStatusText}</strong>
								<span>{formatDisplayTime(displayStart)} - {formatDisplayTime(displayEnd)}</span>
							</div>
							<button type="button" className="venue-modal-close" onClick={() => setShowOpeningHoursModal(false)}>×</button>
						</div>

						{openingLoading ? <p>Đang tải...</p> : null}
						{openingError ? <p>{openingError}</p> : null}

						{!openingLoading && !openingError ? (
							<div className="venue-schedule-horizontal">
								<div className="venue-schedule-horizontal-days">
									{displaySchedule.map((item) => (
										<div key={`schedule-day-${item.key}`} className={`venue-schedule-cell ${item.isToday ? 'is-today' : ''}`}>
											{normalizeScheduleLabel(item)} {item.isToday ? <span className="venue-schedule-today-dot" /> : null}
										</div>
									))}
								</div>
								<div className="venue-schedule-horizontal-times">
									{displaySchedule.map((item) => (
										<div key={`schedule-time-${item.key}`} className="venue-schedule-cell">
											{item.off ? 'Đóng cửa' : `${item.open} - ${item.close}`}
										</div>
									))}
								</div>
							</div>
						) : null}
					</div>
				</div>
			) : null}

			{showCommentModal ? (
				<div className="venue-modal-overlay" onClick={() => setShowCommentModal(false)}>
					<div className="venue-modal-card venue-modal-comment" onClick={(event) => event.stopPropagation()}>
						<button type="button" className="venue-modal-close" onClick={() => setShowCommentModal(false)}>×</button>
						<h3>Viết Bình Luận</h3>

						<div className="venue-comment-hero-card">
							<img src={resolveCoverImage(venue)} alt={resolveVenueName(venue)} loading="lazy" />
							<div className="venue-comment-hero-content">
								<h4>{resolveVenueName(venue)}</h4>
								<p>📍 {venue.address || 'Chưa có địa chỉ'}</p>
								<p className="venue-comment-hero-opening">
									<span className={showOpenState ? 'is-open' : 'is-close'}>{showOpenState ? 'Đang mở cửa' : 'Đã đóng cửa'}</span>
									{formatDisplayTime(displayStart)} - {formatDisplayTime(displayEnd)}
								</p>
								<p>💲 {venuePriceRange}</p>
								<p>{toStars(communityStats.averageRating || 0)} {Number(communityStats.averageRating || 0).toFixed(1)}/5 ({communityStats.totalReviews} đánh giá)</p>
							</div>
						</div>

						<form className="venue-comment-form" onSubmit={handleSubmitReview}>
							<div className="venue-comment-form-grid">
								<label className="venue-comment-upload-box" htmlFor="venue-review-images">
									<input
										id="venue-review-images"
										type="file"
										accept="image/*"
										multiple
										onChange={handlePickReviewImages}
									/>
									<span className="venue-comment-upload-icon">📷</span>
									<span>Ảnh & Video</span>
									{reviewImagePreviews.length ? (
										<div className="venue-review-upload-preview-grid">
											{reviewImagePreviews.map((item) => (
												<div key={item.id} className="venue-review-upload-preview-item">
													<img src={item.url} alt="Ảnh bình luận" loading="lazy" />
													<button
														type="button"
														onClick={(event) => {
															event.preventDefault();
															handleRemoveReviewImage(item.id);
														}}
													>
														−
													</button>
												</div>
											))}
										</div>
									) : null}
									<small>{reviewForm.images.length ? `Đã chọn ${reviewForm.images.length}/6 ảnh` : 'Tối đa 6 ảnh'}</small>
								</label>

								<div className="venue-comment-fields">
									<label className="venue-comment-rating-row">
										Đánh giá sao
										<div className="venue-star-rating-picker" role="radiogroup" aria-label="Đánh giá sao">
											{[1, 2, 3, 4, 5].map((value) => (
												<button
													key={`review-star-${value}`}
													type="button"
													className={`venue-star-btn ${reviewForm.rating !== null && value <= reviewForm.rating ? 'is-active' : ''}`}
													onClick={() => handleSelectRating(value)}
													aria-label={`${value} sao`}
												>
													★
												</button>
											))}
										</div>
										<span className="venue-rating-hint">{reviewForm.rating ? `${reviewForm.rating}/5` : 'Chưa chọn'}</span>
									</label>

									<label>
										Tiêu đề
										<input
											type="text"
											value={reviewForm.title}
											onChange={(event) => handleChangeReviewField('title', event.target.value)}
											placeholder="Tiêu đề"
										/>
									</label>

									<label>
										Mô tả chi tiết bình luận
										<textarea
											rows="5"
											value={reviewForm.comment}
											onChange={(event) => handleChangeReviewField('comment', event.target.value)}
											placeholder="Mô tả chi tiết bình luận ..."
										/>
									</label>
								</div>
								</div>

							{reviewError ? <p className="venue-form-error">{reviewError}</p> : null}

							<button type="submit" disabled={submittingReview}>
								{submittingReview ? 'Đang gửi...' : 'Bình luận'}
							</button>
						</form>
					</div>
				</div>
			) : null}

			{showReplyModal && activeReplyReview ? (
				<div className="venue-modal-overlay" onClick={() => setShowReplyModal(false)}>
					<div className="venue-modal-card venue-modal-comment venue-modal-discussion" onClick={(event) => event.stopPropagation()}>
						<button type="button" className="venue-modal-close" onClick={() => setShowReplyModal(false)}>×</button>
						<h3>{i18n.replyTitle}</h3>

						{authToken ? (
							<form
								className="venue-comment-form venue-discussion-form"
								onSubmit={(event) => {
									event.preventDefault();
									handleSubmitReviewReply();
								}}
							>
								<div className="venue-comment-form-grid">
									<label className="venue-comment-upload-box" htmlFor="venue-reply-images">
										<input
											id="venue-reply-images"
											type="file"
											accept="image/*"
											multiple
											onChange={handlePickReplyImages}
										/>
										<span className="venue-comment-upload-icon">📷</span>
										<span>{i18n.uploadMedia}</span>
										{replyImagePreviews.length ? (
											<div className="venue-review-upload-preview-grid">
												{replyImagePreviews.map((item) => (
													<div key={item.id} className="venue-review-upload-preview-item">
														<img src={item.url} alt="Ảnh thảo luận" loading="lazy" />
														<button
															type="button"
															onClick={(event) => {
																event.preventDefault();
																handleRemoveReplyImage(item.id);
															}}
														>
															−
														</button>
													</div>
												))}
											</div>
										) : null}
										<small>{replyForm.images.length ? `${replyForm.images.length}/6` : i18n.maxSixImages}</small>
									</label>

									<div className="venue-comment-fields">
										<label className="venue-comment-rating-row">
											{i18n.rating}
											<div className="venue-star-rating-picker" role="radiogroup" aria-label="Đánh giá sao cho thảo luận">
												{[1, 2, 3, 4, 5].map((value) => (
													<button
														key={`reply-star-${value}`}
														type="button"
														className={`venue-star-btn ${replyForm.rating !== null && value <= replyForm.rating ? 'is-active' : ''}`}
														onClick={() => handleSelectReplyRating(value)}
														aria-label={`${value} sao`}
													>
														★
													</button>
												))}
											</div>
											<span className="venue-rating-hint">{replyForm.rating ? `${replyForm.rating}/5` : i18n.notSelected}</span>
										</label>

										<label>
											{i18n.title}
											<input
												type="text"
												value={replyForm.title}
												onChange={(event) => handleChangeReplyTitle(event.target.value)}
												placeholder={i18n.replyTitlePlaceholder}
											/>
										</label>

										<label>
											{i18n.detailComment}
											<textarea
												rows="5"
												value={replyForm.content}
												onChange={(event) => handleChangeReplyContent(event.target.value)}
												placeholder={i18n.replyPlaceholder}
											/>
										</label>
									</div>
								</div>

								<button type="submit" disabled={replySubmitting}>
									{replySubmitting ? i18n.submitting : i18n.submitComment}
								</button>
							</form>
						) : (
							<p className="venue-review-reply-empty">{i18n.repliesLoginHint}</p>
						)}
					</div>
				</div>
			) : null}

			{showImagesModal ? (
				<div className="venue-modal-overlay" onClick={() => setShowImagesModal(false)}>
					<div className="venue-modal-card venue-modal-images" onClick={(event) => event.stopPropagation()}>
						<button type="button" className="venue-modal-close" onClick={() => setShowImagesModal(false)}>×</button>
						<h3>Hình ảnh từ đánh giá</h3>

						{!allReviewImages.length ? <p>Chưa có hình ảnh nào từ bình luận.</p> : null}

						<div className="venue-images-grid">
							{allReviewImages.map((imageUrl) => (
								<img key={`gallery-${imageUrl}`} src={resolveAssetUrl(imageUrl, apiBase)} alt="Review gallery" loading="lazy" />
							))}
						</div>
					</div>
				</div>
			) : null}

			{showShareModal ? (
				<div className="venue-modal-overlay" onClick={() => setShowShareModal(false)}>
					<div className="venue-modal-card venue-modal-share" onClick={(event) => event.stopPropagation()}>
						<button type="button" className="venue-modal-close" onClick={() => setShowShareModal(false)}>×</button>
						<h3>Chia sẻ</h3>
						<p className="venue-share-subtitle">Vui lòng chọn hình thức chia sẻ</p>

						<div className="venue-share-icons">
							<a
								href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
								target="_blank"
								rel="noreferrer"
								className="venue-share-icon-btn is-facebook"
								aria-label="Chia sẻ Facebook"
							>
								f
							</a>
							<a
								href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(resolveVenueName(venue))}&body=${encodeURIComponent(shareUrl)}`}
								target="_blank"
								rel="noreferrer"
								className="venue-share-icon-btn is-google"
								aria-label="Chia sẻ Gmail"
							>
								G
							</a>
						</div>

						<div className="venue-share-copy-row">
							<input type="text" readOnly value={shareUrl} aria-label="Đường dẫn chia sẻ" />
							<button type="button" onClick={handleCopyShareLink}>Sao chép link</button>
						</div>
						{shareCopied ? <p className="venue-share-copy-success">Đã sao chép link.</p> : null}
					</div>
				</div>
			) : null}

			{showFavoritesModal ? (
				<div className="venue-modal-overlay" onClick={() => setShowFavoritesModal(false)}>
					<div className="venue-modal-card venue-modal-favorites" onClick={(event) => event.stopPropagation()}>
						<button type="button" className="venue-modal-close" onClick={() => setShowFavoritesModal(false)}>×</button>
						<h3>Yêu thích & Bộ sưu tập</h3>

						{favoriteCollectionLoading ? <p>Đang tải danh sách quán yêu thích...</p> : null}
						{favoriteCollectionError ? <p className="venue-form-error">{favoriteCollectionError}</p> : null}

						{!favoriteCollectionLoading && !favoriteCollectionError && !favoriteCollection.length ? (
							<p>Bạn chưa có quán nào trong bộ sưu tập.</p>
						) : null}

						{!favoriteCollectionLoading && favoriteCollection.length ? (
							<div className="venue-favorite-list">
								{favoriteCollection.map((item) => (
									<article key={`${item.itemType}-${item.itemId}`} className="venue-favorite-item">
										<img
											src={resolveAssetUrl(item.image, apiBase) || resolveCoverImage(venue)}
											alt={item.name || 'Favorite'}
											loading="lazy"
											onError={(event) => {
												event.currentTarget.onerror = null;
												event.currentTarget.src = resolveCoverImage(venue);
											}}
										/>
										<div className="venue-favorite-item-body">
											<strong>{item.name || 'Không có tên'}</strong>
											<p>{item.description || 'Chưa có mô tả.'}</p>
											<div className="venue-favorite-item-actions">
												<button
													type="button"
													onClick={() => {
														setShowFavoritesModal(false);
														navigate(`/venues/${item.itemId}`);
													}}
												>
													Xem quán
												</button>
												<button type="button" onClick={() => handleRemoveFavoriteItem(item)}>Bỏ yêu thích</button>
											</div>
										</div>
									</article>
								))}
							</div>
						) : null}
					</div>
				</div>
			) : null}
		</section>
	);
}

export default VenueDetailPage;
