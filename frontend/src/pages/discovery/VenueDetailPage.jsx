import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
	createVenueReviewReply,
	createVenueReview,
	deleteVenueReview,
	deleteVenueReviewReply,
	updateVenueReview,
	fetchVenueCommunityBundle,
	fetchVenueDetails,
	fetchVenueOpeningHoursRealtime,
	fetchVenueServices,
	toggleVenueReviewLike,
	toggleVenueReviewReplyLike
} from '../../services/api/venuesApi';
import { submitFeedback } from '../../services/feedbackService';
import { APP_ROUTES } from '../../constants/routes';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { normalizeVenueMetadata } from '../../components/map/cityMapUtils';
import { fetchVenueChatThread, markChatThreadRead, sendVenueChatMessage } from '../../services/api/chatApi';
import { trackTrendingAssignmentClick } from '../../services/api/adPackagesApi';
import HeroVenueSection from './HeroVenueSection';
import VenueInfoSection from './VenueInfoSection';
import SimilarVenuesSection from './SimilarVenuesSection';
import VenueLocationMap from './VenueLocationMap';
import './VenueDetailPage.css';

const FALLBACK_VENUE_IMAGE =
	'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80';

const WEEK_DAYS = [
	{ key: 'monday', label: 'Monday' },
	{ key: 'tuesday', label: 'Tuesday' },
	{ key: 'wednesday', label: 'Wednesday' },
	{ key: 'thursday', label: 'Thursday' },
	{ key: 'friday', label: 'Friday' },
	{ key: 'saturday', label: 'Saturday' },
	{ key: 'sunday', label: 'Sunday' }
];

function createPackageClickToken() {
	return `venue-detail-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const REVIEW_BLOCKED_TERMS = [
	'địt',
	'đụ',
	'dm',
	'dcm',
	'đéo',
	'cặc',
	'lồn',
	'đĩ',
	'vcl'
];

const VENUE_REPORT_REASON_OPTIONS = [
	{ value: 'incorrect_info', label: 'Incorrect information' },
	{ value: 'spam_ads', label: 'Spam / advertising' },
	{ value: 'inappropriate_content', label: 'Inappropriate content' },
	{ value: 'duplicate', label: 'Duplicate entry' },
	{ value: 'other', label: 'Other' }
];

const REVIEW_REPORT_REASON_OPTIONS = [
	{ value: 'inappropriate_language', label: 'Inappropriate language' },
	{ value: 'spam_ads', label: 'Spam / advertising' },
	{ value: 'incorrect_info', label: 'Incorrect information' },
	{ value: 'other', label: 'Other' }
];

const REPORT_SEVERITY_OPTIONS = [
	{ value: 'low', label: 'Low', stars: '★' },
	{ value: 'medium', label: 'Medium', stars: '★★' },
	{ value: 'high', label: 'High', stars: '★★★' }
];

const PAGE_I18N = {
	vi: {
		replyRequired: 'Nội dung thảo luận là bắt buộc.',
		replyBlocked: 'Thảo luận có chứa từ ngữ không phù hợp.',
		replySubmitFail: 'Không thể gửi thảo luận.',
		repliesEmpty: 'Chưa có thảo luận nào.',
		repliesLoginHint: 'Vui lòng đăng nhập để thảo luận.',
		discuss: 'Thảo luận',
		replyTitle: 'Thảo luận đánh giá',
		rating: 'Đánh giá',
		notSelected: 'Chưa chọn',
		title: 'Tiêu đề',
		detailComment: 'Nội dung chi tiết',
		uploadMedia: 'Ảnh & Video',
		maxSixImages: 'Tối đa 6 ảnh',
		submitComment: 'Bình luận',
		submitting: 'Đang gửi...',
		replyPlaceholder: 'Viết thảo luận chi tiết...',
		reviewCommentPlaceholder: 'Viết bình luận chi tiết...',
		replyTitlePlaceholder: 'Tiêu đề',
		updating: 'Đang cập nhật',
		weekDays: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'],
		aboutTitle: 'Giới thiệu',
		servicesTitle: 'Dịch vụ cung cấp',
		serviceFallback: 'Dịch vụ',
		servicesEmpty: 'Chủ quán chưa cập nhật dịch vụ.',
		contactTitle: 'Thông tin liên hệ',
		phoneLabel: 'Đây là số điện thoại',
		addressLabel: 'Đây là địa chỉ của quán',
		notUpdated: 'Chưa cập nhật',
		messageVenue: 'Gửi tin nhắn cho quán',
		chatOwnerFallback: 'Chủ quán',
		openNow: 'Đang mở cửa',
		closedNow: 'Đang đóng cửa',
		areaUpdating: 'Đang cập nhật khu vực',
		currentVenueInfo: 'Thông tin quán hiện tại',
		noAddressYet: 'Chưa có địa chỉ',
		reviewsUnit: 'đánh giá',
		loadingMessages: 'Đang tải tin nhắn...',
		chatUnavailable: 'Quán này chưa liên kết chủ quán để nhắn tin.',
		openFromHeaderHint: 'Mở chat từ biểu tượng tin nhắn ở header để phản hồi với vai trò chủ quán.',
		startChatHint: 'Bắt đầu trò chuyện với quán này. Tin nhắn được nhóm theo chủ quán.',
		typeMessagePlaceholder: 'Nhập tin nhắn cho quán...',
		send: 'Gửi',
		sending: 'Đang gửi...',
		signIn: 'Đăng nhập',
		other: 'Khác',
		mapSectionTitle: '📍 Vị trí & Giờ hoạt động',
		mapOpeningHours: '⏰ Giờ hoạt động',
		mapNoSchedule: 'Chưa có lịch hoạt động',
		mapAddressLabel: 'Đây là địa chỉ của quán',
		mapAddressFallback: 'Chưa cập nhật địa chỉ',
		openInternalMap: 'Mở trên bản đồ Smart City',
		similarTitle: 'Quán tương tự',
		similarDescriptionPrefix: 'Các địa điểm cùng nhóm',
		similarDescriptionMiddle: 'tại',
		similarLoading: 'Đang tải gợi ý...',
		similarEmpty: 'Hiện chưa có quán tương tự phù hợp trong khu vực này.',
		similarErrorPrefix: 'Lỗi:',
		similarView: 'Xem →'
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
		,
		updating: 'Updating',
		weekDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
		aboutTitle: 'About',
		servicesTitle: 'Services Offered',
		serviceFallback: 'Service',
		servicesEmpty: 'The venue owner has not updated services yet.',
		contactTitle: 'Contact information',
		phoneLabel: 'Phone number',
		addressLabel: 'Venue address',
		notUpdated: 'Not updated',
		messageVenue: 'Send message to venue',
		chatOwnerFallback: 'Venue owner',
		openNow: 'Open now',
		closedNow: 'Closed now',
		areaUpdating: 'Area updating',
		currentVenueInfo: 'Current venue info',
		noAddressYet: 'No address yet',
		reviewsUnit: 'reviews',
		loadingMessages: 'Loading messages...',
		chatUnavailable: 'This venue is not linked to an owner for chat yet.',
		openFromHeaderHint: 'Open chat from the header message icon to reply as venue owner.',
		startChatHint: 'Start chatting with this venue. Messages are grouped by venue owner.',
		typeMessagePlaceholder: 'Type your message to this venue...',
		send: 'Send',
		sending: 'Sending...',
		signIn: 'Sign in',
		other: 'Other',
		mapSectionTitle: '📍 Location & Hours',
		mapOpeningHours: '⏰ Opening Hours',
		mapNoSchedule: 'No schedule available',
		mapAddressLabel: 'Venue address',
		mapAddressFallback: 'Address not updated',
		openInternalMap: 'Open in Smart City map',
		similarTitle: 'Similar venues',
		similarDescriptionPrefix: 'Places in the same',
		similarDescriptionMiddle: 'at',
		similarLoading: 'Loading suggestions...',
		similarEmpty: 'No matching similar venues found in this area yet.',
		similarErrorPrefix: 'Error:',
		similarView: 'View →'
	}
};
const CHAT_DELETE_SYNC_KEY = 'chat_thread_deleted_sync';
const ACTIVE_CHAT_THREAD_SYNC_KEY = 'active_chat_thread_sync';
const VENUE_DESCRIPTION_COLLAPSE_LIMIT = 210;

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

	const tokens = normalized
		.split(' ')
		.map((token) => token.trim())
		.filter(Boolean);

	for (const term of REVIEW_BLOCKED_TERMS) {
		const normalizedTerm = normalizeModerationText(term);
		if (!normalizedTerm) {
			continue;
		}

		if (tokens.includes(normalizedTerm)) {
			return term;
		}
	}

	return null;
}

function resolveAssetUrl(url, apiBase) {
	const normalized = String(url || '')
		.trim()
		.replace(/\\/g, '/')
		.replace(/^['"]|['"]$/g, '');

	if (!normalized) {
		return '';
	}

	if (normalized.toLowerCase().startsWith('data:image/')) {
		return normalized;
	}

	if (/^https?:\/\//i.test(normalized)) {
		try {
			const parsed = new URL(normalized);
			if (/^\/api(?:\/v\d+)?\/uploads\//i.test(parsed.pathname)) {
				parsed.pathname = parsed.pathname.replace(/^\/api(?:\/v\d+)?/i, '');
				return parsed.toString();
			}
		} catch {
			return normalized;
		}

		return normalized;
	}

	const normalizedWithoutApiPrefix = normalized
		.replace(/^\/?api\/v\d+\/uploads\//i, '/uploads/')
		.replace(/^\/?api\/uploads\//i, '/uploads/')
		.replace(/^\.\//, '');

	if (normalizedWithoutApiPrefix.startsWith('/')) {
		return `${apiBase}${normalizedWithoutApiPrefix}`;
	}

	return `${apiBase}/${normalizedWithoutApiPrefix}`;
}

function buildImageIdentity(url) {
	const normalized = String(url || '').trim();
	if (!normalized) {
		return '';
	}

	if (/^https?:\/\//i.test(normalized)) {
		try {
			const parsed = new URL(normalized);
			return `${parsed.pathname}${parsed.search || ''}`;
		} catch {
			return normalized;
		}
	}

	return normalized;
}

function resolveUniqueAssetUrls(urls, apiBase) {
	const mapped = urls
		.map((item) => resolveAssetUrl(item, apiBase))
		.filter(Boolean);

	const identityMap = new Map();
	mapped.forEach((item) => {
		const key = buildImageIdentity(item);
		if (!key || identityMap.has(key)) {
			return;
		}

		identityMap.set(key, item);
	});

	return [...identityMap.values()];
}

function normalizeImageUrlList(value) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.flatMap((item) => {
			if (typeof item === 'string') {
				return [item];
			}

			if (item && typeof item === 'object') {
				return [item.url, item.image_url, item.imageUrl, item.src, item.path].filter(
					(candidate) => typeof candidate === 'string'
				);
			}

			return [];
		})
		.map((item) => item.trim())
		.filter((item) => {
			const normalized = String(item || '').trim().toLowerCase();
			const hasValidImagePath =
				/^https?:\/\//i.test(normalized)
				|| normalized.startsWith('/uploads/')
				|| normalized.startsWith('uploads/')
				|| normalized.startsWith('data:image/');
			return Boolean(normalized)
				&& hasValidImagePath
				&& !['nan', 'null', 'undefined'].includes(normalized)
				&& !normalized.startsWith('blob:');
		});
}

function extractVenueImageUrlsFromVenue(venue) {
	const metadata = normalizeVenueMetadata(venue?.metadata);

	const metadataImages = [
		...(Array.isArray(metadata.galleryImages) ? metadata.galleryImages : []),
		...(Array.isArray(metadata.images) ? metadata.images : []),
		...(Array.isArray(metadata.imageUrls) ? metadata.imageUrls : []),
		...(Array.isArray(metadata.photos) ? metadata.photos : [])
	];

	const directVenueImages = [
		...(Array.isArray(venue?.venue_images) ? venue.venue_images : []),
		...(venue?.venue_primary_image_url ? [venue.venue_primary_image_url] : []),
		...(venue?.map_image_url ? [venue.map_image_url] : []),
		...(venue?.cover_image_url ? [venue.cover_image_url] : []),
		...(venue?.coverImageUrl ? [venue.coverImageUrl] : [])
	];

	return [...new Set(normalizeImageUrlList([...directVenueImages, ...metadataImages]))];
}

function normalizeHalfStarRating(value) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return 0;
	}

	const bounded = Math.max(0, Math.min(5, parsed));
	return Math.round(bounded * 2) / 2;
}

function isValidHalfStarRating(value) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return false;
	}

	if (parsed < 0.5 || parsed > 5) {
		return false;
	}

	return Number.isInteger(parsed * 2);
}

function resolveHalfStarSelection(event, starValue) {
	if (!event?.currentTarget) {
		return normalizeHalfStarRating(starValue);
	}

	const targetRect = event.currentTarget.getBoundingClientRect();
	const pointerX = event.clientX - targetRect.left;
	const pickedValue = pointerX <= targetRect.width / 2 ? starValue - 0.5 : starValue;
	return normalizeHalfStarRating(pickedValue);
}

function resolveStarDisplayItems(rating) {
	const normalized = normalizeHalfStarRating(rating);
	const fullStars = Math.floor(normalized);
	const hasHalfStar = normalized - fullStars >= 0.5;

	return Array.from({ length: 5 }, (_item, index) => {
		const starNumber = index + 1;
		if (starNumber <= fullStars) {
			return 'full';
		}

		if (hasHalfStar && starNumber === fullStars + 1) {
			return 'half';
		}

		return 'empty';
	});
}

function StarRatingDisplay({ rating, className = '' }) {
	const starItems = resolveStarDisplayItems(rating);

	return (
		<span className={`venue-star-display ${className}`.trim()} aria-label={`${normalizeHalfStarRating(rating)} out of 5 stars`}>
			{starItems.map((starType, index) => (
				<span key={`venue-star-${index + 1}`} className={`venue-star-display-item is-${starType}`} aria-hidden="true">
					★
				</span>
			))}
		</span>
	);
}

function resolveVenueName(venue) {
	return venue?.name || venue?.title || 'Unnamed venue';
}

function resolveCoverImage(venue) {
	const candidates = [
		venue?.venue_primary_image_url,
		...(Array.isArray(venue?.venue_images) ? venue.venue_images : []),
		venue?.map_image_url,
		venue?.cover_image_url,
		venue?.coverImageUrl
	].filter((item) => typeof item === 'string' && item.trim());

	return candidates[0] || FALLBACK_VENUE_IMAGE;
}

function resolveVenueDescription(venue) {
	const metadata = normalizeVenueMetadata(venue?.metadata);
	const candidates = [
		venue?.description,
		metadata.description,
		metadata.shortDescription,
		metadata.summary,
		metadata.overview,
		metadata.introduction
	]
		.map((item) => String(item || '').replace(/\s+/g, ' ').trim())
		.filter(Boolean);

	return candidates[0] || '';
}

function truncateVenueDescription(description, maxLength = VENUE_DESCRIPTION_COLLAPSE_LIMIT) {
	const normalized = String(description || '').replace(/\s+/g, ' ').trim();

	if (!normalized) {
		return {
			text: '',
			truncated: false
		};
	}

	if (normalized.length <= maxLength) {
		return {
			text: normalized,
			truncated: false
		};
	}

	const clipped = normalized.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
	return {
		text: `${clipped}...`,
		truncated: true
	};
}

function resolveWeeklySchedule(venue) {
	const metadata = normalizeVenueMetadata(venue?.metadata);
	const canonicalSourceObject =
		metadata.weeklySchedule && typeof metadata.weeklySchedule === 'object' && !Array.isArray(metadata.weeklySchedule)
			? metadata.weeklySchedule
			: null;

	const canonicalSourceArray = Array.isArray(metadata.weeklySchedule)
		? metadata.weeklySchedule.reduce((accumulator, item) => {
			const itemKey = String(item?.key || item?.day || '').trim().toLowerCase();
			if (!itemKey) {
				return accumulator;
			}

			accumulator[itemKey] = {
				start: String(item?.start || item?.open || item?.openTime || '').trim(),
				end: String(item?.end || item?.close || item?.closeTime || '').trim(),
				off: Boolean(item?.off || item?.isClosed)
			};

			return accumulator;
		}, {})
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

	const source = canonicalSourceObject || canonicalSourceArray || legacySource;
	const fallbackStart = String(metadata.startTime || '').trim();
	const fallbackEnd = String(metadata.endTime || '').trim();
	const hasFallbackRange =
		/^\d{2}:\d{2}$/.test(fallbackStart) && /^\d{2}:\d{2}$/.test(fallbackEnd) && fallbackStart < fallbackEnd;
	const resolveDaySource = (day) => {
		if (!source || typeof source !== 'object') {
			return {};
		}

		const dayCandidates = [
			day.key,
			day.label,
			day.label.toLowerCase(),
			day.label.toUpperCase()
		];

		for (const candidate of dayCandidates) {
			const value = source?.[candidate];
			if (value && typeof value === 'object') {
				return value;
			}
		}

		return {};
	};

		if (source || hasFallbackRange) {
			return WEEK_DAYS.map((day) => {
			const item = resolveDaySource(day);
			const start = String(item.start || item.open || item.openTime || '').trim() || (hasFallbackRange ? fallbackStart : '');
			const end = String(item.end || item.close || item.closeTime || '').trim() || (hasFallbackRange ? fallbackEnd : '');
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
		return 'Closed';
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
		return `${minPrice.toLocaleString('en-US')} VND - ${maxPrice.toLocaleString('en-US')} VND`;
	}

	const directCandidates = [venue?.price, venue?.price_range, metadata.price, metadata.priceRange]
		.map((item) => String(item || '').trim())
		.filter(Boolean);

	return directCandidates[0] || 'Updating';
}

function resolveChatOwnerName(venue) {
	const metadata = normalizeVenueMetadata(venue?.metadata);
	const candidates = [
		venue?.owner_name,
		venue?.ownerName,
		venue?.merchant_name,
		venue?.merchantName,
		venue?.fullname,
		venue?.fullName,
		metadata.ownerName,
		metadata.owner_name,
		metadata.merchantName,
		metadata.merchant_name,
		metadata.contactName,
		metadata.contact_name
	]
		.map((item) => String(item || '').trim())
		.filter(Boolean);

	return candidates[0] || 'Venue owner';
}

function buildVenueChatMeta(venue, fallback = {}) {
	return {
		id: String(venue?.id ?? fallback.id ?? '').trim(),
		ownerName: String(fallback.ownerName || resolveChatOwnerName(venue)).trim(),
		name: resolveVenueName(venue),
		address: String(venue?.address || fallback.address || '').trim(),
		ward_name: String(venue?.ward_name || fallback.ward_name || '').trim(),
		cover_image_url: resolveCoverImage(venue),
		price: String(fallback.price || '').trim()
	};
}

function buildChatContextLine(message, fallbackVenueMeta = null) {
	const resolvedVenueName = String(message?.venueName || fallbackVenueMeta?.name || '').trim();
	const resolvedVenueAddress = String(message?.venueAddress || fallbackVenueMeta?.address || '').trim();
	const resolvedContextLabel = String(message?.contextLabel || '').trim();

	if (resolvedVenueName) {
		return `Venue: ${resolvedVenueName}${resolvedVenueAddress ? ` · ${resolvedVenueAddress}` : ''}`;
	}

	if (resolvedContextLabel) {
		return `Topic: ${resolvedContextLabel}`;
	}

	return '';
}

function normalizeScheduleLabel(item) {
	const key = String(item?.key || '').toLowerCase();
	return WEEK_DAYS.find((day) => day.key === key)?.label || item?.label || '';
}

function normalizeTextForIcon(value) {
	return String(value || '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim();
}

function resolveServiceIcon(service) {
	const normalizedName = normalizeTextForIcon(service?.name || service?.label || service?.title || '');

	if (!normalizedName) {
		return '🛎️';
	}

	const serviceIconRules = [
		{ keywords: ['online', 'dat san', 'booking', 'reservation'], icon: '📱' },
		{ keywords: ['ship', 'delivery', 'giao hang'], icon: '🚚' },
		{ keywords: ['takeaway', 'mang ve'], icon: '🥡' },
		{ keywords: ['ve theo gio', 'hour', 'gio'], icon: '⏱️' },
		{ keywords: ['dung cu', 'equipment', 'cho thue'], icon: '🏸' },
		{ keywords: ['lop', 'huan luyen', 'training', 'coach'], icon: '🎓' },
		{ keywords: ['parking', 'giu xe'], icon: '🅿️' },
		{ keywords: ['wifi', 'internet'], icon: '📶' },
		{ keywords: ['private', 'phong rieng', 'vip'], icon: '🔒' },
		{ keywords: ['event', 'su kien'], icon: '🎉' },
		{ keywords: ['kids', 'tre em'], icon: '🧒' },
		{ keywords: ['pet', 'thu cung'], icon: '🐾' },
		{ keywords: ['music', 'am nhac'], icon: '🎵' },
		{ keywords: ['food', 'do an', 'restaurant', 'am thuc'], icon: '🍽️' }
	];

	const matchedRule = serviceIconRules.find((rule) =>
		rule.keywords.some((keyword) => normalizedName.includes(keyword))
	);

	return matchedRule?.icon || '🛎️';
}

function VenueDetailPage() {
	const [searchParams] = useSearchParams();
	const { venueId } = useParams();
	const location = useLocation();
	const navigate = useNavigate();
	const { language } = useLanguage();
	const { token, user } = useAuth();
	const { theme } = useTheme();
	const apiUrl = useMemo(
		() =>
			import.meta.env.VITE_API_BASE_URL
			|| (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api'),
		[]
	);
	const apiBase = useMemo(() => apiUrl.replace(/\/api\/v1$|\/api$/i, ''), [apiUrl]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [venue, setVenue] = useState(null);
	const [reviews, setReviews] = useState([]);
	const [venueServices, setVenueServices] = useState([]);
	const [communityStats, setCommunityStats] = useState({ averageRating: 0, totalReviews: 0 });
	const [venueGalleryImages, setVenueGalleryImages] = useState([]);
	const [allReviewImages, setAllReviewImages] = useState([]);
	const [showOpeningHoursModal, setShowOpeningHoursModal] = useState(false);
	const [showCommentModal, setShowCommentModal] = useState(false);
	const [showImagesModal, setShowImagesModal] = useState(false);
	const [activeImagePreview, setActiveImagePreview] = useState(null);
	const [showFavoritesModal, setShowFavoritesModal] = useState(false);
	const [showShareModal, setShowShareModal] = useState(false);
	const [showVenueReportModal, setShowVenueReportModal] = useState(false);
	const [showReviewReportModal, setShowReviewReportModal] = useState(false);
	const [showReplyReportModal, setShowReplyReportModal] = useState(false);
	const [activeReviewToReport, setActiveReviewToReport] = useState(null);
	const [activeReplyToReport, setActiveReplyToReport] = useState(null);
	const [submittingVenueReport, setSubmittingVenueReport] = useState(false);
	const [submittingReviewReport, setSubmittingReviewReport] = useState(false);
	const [submittingReplyReport, setSubmittingReplyReport] = useState(false);
	const [venueReportStatus, setVenueReportStatus] = useState({ type: '', message: '' });
	const [reviewReportStatus, setReviewReportStatus] = useState({ type: '', message: '' });
	const [replyReportStatus, setReplyReportStatus] = useState({ type: '', message: '' });
	const [venueReportForm, setVenueReportForm] = useState({
		reason: '',
		description: '',
		severity: 'low',
		attachment: null
	});
	const [reviewReportForm, setReviewReportForm] = useState({
		reason: 'inappropriate_language',
		description: ''
	});
	const [replyReportForm, setReplyReportForm] = useState({
		reason: 'inappropriate_language',
		description: ''
	});
	const [shareCopied, setShareCopied] = useState(false);
	const [openingRealtime, setOpeningRealtime] = useState(null);
	const [openingLoading, setOpeningLoading] = useState(false);
	const [openingError, setOpeningError] = useState('');
	const [submittingReview, setSubmittingReview] = useState(false);
	const [editingReviewId, setEditingReviewId] = useState(null);
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
	const [chatMessages, setChatMessages] = useState([]);
	const [chatInput, setChatInput] = useState('');
	const [chatContextOptions, setChatContextOptions] = useState([]);
	const [selectedChatContextValue, setSelectedChatContextValue] = useState('');
	const [chatSending, setChatSending] = useState(false);
	const [chatLoading, setChatLoading] = useState(false);
	const [chatError, setChatError] = useState('');
	const [showChatWidget, setShowChatWidget] = useState(false);
	const [activeChatThreadId, setActiveChatThreadId] = useState(null);
	const [syncedChatThread, setSyncedChatThread] = useState(null);
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
	const [reviewForm, setReviewForm] = useState({
		rating: null,
		title: '',
		comment: '',
		images: []
	});
	const chatListRef = useRef(null);
	const shareUrl = useMemo(() => {
		if (typeof window !== 'undefined' && window.location?.origin) {
			return `${window.location.origin}/venues/${venueId}`;
		}

		return `${apiBase}/venues/${venueId}`;
	}, [apiBase, venueId]);

	const weeklySchedule = useMemo(() => resolveWeeklySchedule(venue), [venue]);
	const todaySchedule = useMemo(() => resolveTodaySchedule(weeklySchedule), [weeklySchedule]);
	const venuePriceRange = useMemo(() => resolveVenuePriceRange(venue), [venue]);
	const fullVenueDescription = useMemo(() => resolveVenueDescription(venue), [venue]);
	const collapsedVenueDescription = useMemo(
		() => truncateVenueDescription(fullVenueDescription),
		[fullVenueDescription]
	);
	const visibleVenueDescription =
		isDescriptionExpanded || !collapsedVenueDescription.truncated
			? fullVenueDescription
			: collapsedVenueDescription.text;
	const chatVenueMeta = useMemo(
		() => (venue ? buildVenueChatMeta(venue, { price: venuePriceRange }) : null),
		[venue, venuePriceRange]
	);
	const selectedChatThreadId = useMemo(() => {
		const numericValue = Number(location.state?.chatThreadId || 0);
		return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
	}, [location.state]);
	const hasOverviewReturnSnapshot = useMemo(
		() => Boolean(
			location.state?.fromOverview
			&& location.state?.overviewReturnSnapshot
			&& typeof location.state.overviewReturnSnapshot === 'object'
		),
		[location.state]
	);
	const syncedChatThreadId = useMemo(() => {
		const numericValue = Number(syncedChatThread?.threadId || 0);
		return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
	}, [syncedChatThread]);
	const shouldAutoOpenChat = useMemo(() => Boolean(location.state?.openChat), [location.state]);
	const isCurrentUserVenueOwner = useMemo(() => {
		const venueOwnerUserId = String(venue?.owner_user_id || venue?.ownerUserId || '').trim();
		const currentUserId = String(user?.id || '').trim();
		return Boolean(venueOwnerUserId) && Boolean(currentUserId) && venueOwnerUserId === currentUserId;
	}, [venue, user]);
	const chatConversationGroupKey = useMemo(() => {
		const venueOwnerUserId = String(venue?.owner_user_id || venue?.ownerUserId || '').trim();
		const currentUserId = String(user?.id || '').trim();
		if (!venueOwnerUserId || !currentUserId || venueOwnerUserId === currentUserId) {
			return '';
		}
		return `${venueOwnerUserId}::${currentUserId}`;
	}, [venue, user]);
	const effectiveSelectedChatThreadId = useMemo(() => {
		if (selectedChatThreadId) {
			return selectedChatThreadId;
		}

		if (!isCurrentUserVenueOwner || !syncedChatThreadId) {
			return null;
		}

		const syncedVenueId = String(syncedChatThread?.venueId || '').trim();
		const currentVenueId = String(venueId || '').trim();
		return syncedVenueId && currentVenueId && syncedVenueId === currentVenueId ? syncedChatThreadId : null;
	}, [selectedChatThreadId, isCurrentUserVenueOwner, syncedChatThreadId, syncedChatThread, venueId]);
	const canUseVenueChat = useMemo(
		() => Boolean(String(venue?.owner_user_id || venue?.ownerUserId || '').trim()),
		[venue]
	);
	const favoriteVenueId = useMemo(() => String(venue?.id ?? venue?.venue_id ?? venueId ?? '').trim(), [venue?.id, venue?.venue_id, venueId]);
	const authToken = useMemo(() => String(token || '').replace(/^Bearer\s+/i, '').trim(), [token]);
	const trackedPromotionClickKeyRef = useRef('');
	const reviewItemRefs = useRef({});
	const trendClickContext = useMemo(() => {
		const assignmentId = Number.parseInt(location.state?.trendClickContext?.assignmentId || 0, 10);
		if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
			return null;
		}

		return {
			assignmentId,
			source: String(location.state?.trendClickContext?.source || 'overview-trending').trim() || 'overview-trending',
			clickToken: String(location.state?.trendClickContext?.clickToken || '').trim()
		};
	}, [location.state]);
	const reviewImagePreviews = useMemo(
		() => reviewForm.images.map((file) => ({ id: `${file.name}-${file.lastModified}-${file.size}`, url: URL.createObjectURL(file) })),
		[reviewForm.images]
	);
	const replyImagePreviews = useMemo(
		() => replyForm.images.map((file) => ({ id: `${file.name}-${file.lastModified}-${file.size}`, url: URL.createObjectURL(file) })),
		[replyForm.images]
	);
	const venueReportAttachmentPreview = useMemo(() => {
		const attachment = venueReportForm.attachment;
		if (!attachment) {
			return '';
		}

		return URL.createObjectURL(attachment);
	}, [venueReportForm.attachment]);

	const applyCommunityData = (communityData, fallbackVenue = null) => {
		const communityVenueImages = normalizeImageUrlList(
			communityData?.photos?.venue || communityData?.venueImages || communityData?.venue?.venue_images
		);
		const nextVenue = fallbackVenue || communityData?.venue || null;
		const venueImagesFromVenuePayload = extractVenueImageUrlsFromVenue(nextVenue);
		const normalizedVenueImages = resolveUniqueAssetUrls(
			[...communityVenueImages, ...venueImagesFromVenuePayload],
			apiBase
		);

		const venueImageSet = new Set(normalizedVenueImages);
		const normalizedReviewImages = resolveUniqueAssetUrls(
			normalizeImageUrlList(communityData?.photos?.reviews || communityData?.reviewImages),
			apiBase
		).filter((imageUrl) => !venueImageSet.has(imageUrl));

		if (nextVenue) {
			setVenue({
				...nextVenue,
				...(normalizedVenueImages.length ? { venue_images: normalizedVenueImages } : {})
			});
		}

		setReviews(Array.isArray(communityData?.reviews) ? communityData.reviews : []);
		setCommunityStats({
			averageRating: Number(communityData?.stats?.averageRating || 0),
			totalReviews: Number(communityData?.stats?.totalReviews || 0)
		});
		setVenueGalleryImages(normalizedVenueImages);
		setAllReviewImages(normalizedReviewImages);
	};

	const handleGoToMapLocation = () => {
		const id = String(venue?.id || venueId || '').trim();
		const latitude = Number(venue?.latitude);
		const longitude = Number(venue?.longitude);

		if (!id) {
			return;
		}

		const params = new URLSearchParams();
		params.set('venueId', id);

		if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
			params.set('lat', String(latitude));
			params.set('lng', String(longitude));
		}

		navigate(`${APP_ROUTES.CITY_MAP}?${params.toString()}`);
	};

	const handleBackNavigation = () => {
		if (hasOverviewReturnSnapshot) {
			navigate(APP_ROUTES.HOME, {
				state: {
					restoreOverviewSnapshot: location.state.overviewReturnSnapshot
				}
			});
			return;
		}

		navigate(-1);
	};

	const openVenueReportModal = () => {
		if (!venue) {
			return;
		}

		setVenueReportForm({
			reason: '',
			description: '',
			severity: 'low',
			attachment: null
		});
		setVenueReportStatus({ type: '', message: '' });
		setShowVenueReportModal(true);
	};

	const openReviewReportModal = (review) => {
		if (!review) {
			return;
		}

		setActiveReviewToReport(review);
		setReviewReportForm({
			reason: 'inappropriate_language',
			description: ''
		});
		setReviewReportStatus({ type: '', message: '' });
		setShowReviewReportModal(true);
	};

	const openReplyReportModal = (review, reply) => {
		if (!reply) {
			return;
		}

		setActiveReplyToReport({ review, reply });
		setReplyReportForm({
			reason: 'inappropriate_language',
			description: ''
		});
		setReplyReportStatus({ type: '', message: '' });
		setShowReplyReportModal(true);
	};

	const handleSubmitVenueReport = async (event) => {
		event.preventDefault();

		if (!venue) {
			return;
		}

		if (!venueReportForm.reason) {
			setVenueReportStatus({ type: 'error', message: 'Please select a report reason.' });
			return;
		}

		setSubmittingVenueReport(true);
		setVenueReportStatus({ type: '', message: '' });

		const selectedReasonLabel =
			VENUE_REPORT_REASON_OPTIONS.find((item) => item.value === venueReportForm.reason)?.label || 'Other';
		const selectedSeverityLabel =
			REPORT_SEVERITY_OPTIONS.find((item) => item.value === venueReportForm.severity)?.label || 'Low';
		const detailText = String(venueReportForm.description || '').trim();

		const reportMessage = [
			`Venue report: ${resolveVenueName(venue)}`,
			`Reason: ${selectedReasonLabel}`,
			`Severity: ${selectedSeverityLabel}`,
			`Address: ${venue?.address || 'N/A'}`,
			detailText ? `Details: ${detailText}` : ''
		]
			.filter(Boolean)
			.join('\n');

		try {
			await submitFeedback({
				category: 'venue_report',
				message: reportMessage,
				attachment: venueReportForm.attachment || null,
				contactEmail: user?.email || '',
				metadata: {
					contextType: 'venue',
					contextId: venue?.id,
					venueId: venue?.id,
					venueName: resolveVenueName(venue),
					severity: venueReportForm.severity
				}
			});

			setVenueReportStatus({ type: 'success', message: 'Venue report submitted successfully.' });
			window.setTimeout(() => {
				setShowVenueReportModal(false);
			}, 700);
		} catch (submitError) {
			setVenueReportStatus({
				type: 'error',
				message: submitError?.response?.data?.message || 'Unable to submit venue report right now.'
			});
		} finally {
			setSubmittingVenueReport(false);
		}
	};

	const handleSubmitReviewReport = async (event) => {
		event.preventDefault();

		if (!activeReviewToReport) {
			return;
		}

		if (!reviewReportForm.reason) {
			setReviewReportStatus({ type: 'error', message: 'Please select a report reason.' });
			return;
		}

		setSubmittingReviewReport(true);
		setReviewReportStatus({ type: '', message: '' });

		const selectedReasonLabel =
			REVIEW_REPORT_REASON_OPTIONS.find((item) => item.value === reviewReportForm.reason)?.label || 'Other';
		const detailText = String(reviewReportForm.description || '').trim();
		const message = [
			`Review report #${activeReviewToReport.id || 'N/A'}`,
			`Reason: ${selectedReasonLabel}`,
			`Author: ${activeReviewToReport.authorName || 'Anonymous'}`,
			`Content: ${activeReviewToReport.comment || ''}`,
			detailText ? `Details: ${detailText}` : ''
		]
			.filter(Boolean)
			.join('\n');

		try {
			await submitFeedback({
				category: 'review_report',
				message,
				contactEmail: user?.email || '',
				metadata: {
					contextType: 'review',
					contextId: activeReviewToReport?.id,
					venueId: venue?.id,
					venueName: resolveVenueName(venue)
				}
			});

			setReviewReportStatus({ type: 'success', message: 'Review report submitted successfully.' });
			window.setTimeout(() => {
				setShowReviewReportModal(false);
			}, 700);
		} catch (submitError) {
			setReviewReportStatus({
				type: 'error',
				message: submitError?.response?.data?.message || 'Unable to submit review report right now.'
			});
		} finally {
			setSubmittingReviewReport(false);
		}
	};

	const handleSubmitReplyReport = async (event) => {
		event.preventDefault();

		if (!activeReplyToReport?.reply) {
			return;
		}

		if (!replyReportForm.reason) {
			setReplyReportStatus({ type: 'error', message: 'Please select a report reason.' });
			return;
		}

		setSubmittingReplyReport(true);
		setReplyReportStatus({ type: '', message: '' });

		const selectedReasonLabel =
			REVIEW_REPORT_REASON_OPTIONS.find((item) => item.value === replyReportForm.reason)?.label || 'Other';
		const detailText = String(replyReportForm.description || '').trim();
		const reply = activeReplyToReport.reply;
		const parentReview = activeReplyToReport.review;

		const message = [
			`Review reply report #${reply.id || 'N/A'}`,
			`Reason: ${selectedReasonLabel}`,
			`Author: ${reply.authorName || 'Anonymous'}`,
			`Content: ${reply.content || ''}`,
			detailText ? `Details: ${detailText}` : ''
		]
			.filter(Boolean)
			.join('\n');

		try {
			await submitFeedback({
				category: 'review_report',
				message,
				contactEmail: user?.email || '',
				metadata: {
					contextType: 'review_reply',
					contextId: reply?.id,
					parentReviewId: parentReview?.id,
					venueId: venue?.id,
					venueName: resolveVenueName(venue)
				}
			});

			setReplyReportStatus({ type: 'success', message: 'Reply report submitted successfully.' });
			window.setTimeout(() => {
				setShowReplyReportModal(false);
			}, 700);
		} catch (submitError) {
			setReplyReportStatus({
				type: 'error',
				message: submitError?.response?.data?.message || 'Unable to submit reply report right now.'
			});
		} finally {
			setSubmittingReplyReport(false);
		}
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
		return () => {
			if (venueReportAttachmentPreview) {
				URL.revokeObjectURL(venueReportAttachmentPreview);
			}
		};
	}, [venueReportAttachmentPreview]);

	useEffect(() => {
		const assignmentId = Number.parseInt(venue?.promotionAssignment?.assignmentId || 0, 10);
		if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
			return;
		}

		const trackingKey = `${assignmentId}:${venue?.id || venueId}:${user?.id || 'guest'}`;
		if (trackedPromotionClickKeyRef.current === trackingKey) {
			return;
		}

		trackedPromotionClickKeyRef.current = trackingKey;
		trackTrendingAssignmentClick(
			assignmentId,
			trendClickContext?.source || 'venue-detail',
			trendClickContext?.clickToken || createPackageClickToken()
		).catch(() => null);

		if (trendClickContext?.assignmentId) {
			navigate(
				{
					pathname: location.pathname,
					search: location.search
				},
				{
					replace: true,
					state: {
						...(location.state || {}),
						trendClickContext: null
					}
				}
			);
		}
	}, [
		venue?.promotionAssignment?.assignmentId,
		venue?.id,
		venueId,
		user?.id,
		trendClickContext,
		navigate,
		location.pathname,
		location.search,
		location.state
	]);

	useEffect(() => {
		let mounted = true;

		async function loadVenueDetail() {
			setLoading(true);
			setError('');

			try {
				const [detailResult, communityResult] = await Promise.allSettled([
					fetchVenueDetails(venueId),
					fetchVenueCommunityBundle(venueId)
				]);

				if (!mounted) {
					return;
				}

				const hasDetail = detailResult.status === 'fulfilled';
				const hasCommunity = communityResult.status === 'fulfilled';

				if (hasDetail) {
					const venueData = detailResult.value;
					setVenue(venueData);
					setVenueGalleryImages(resolveUniqueAssetUrls(extractVenueImageUrlsFromVenue(venueData), apiBase));
					setAllReviewImages([]);
					setReviews([]);
					setCommunityStats({
						averageRating: Number(venueData?.average_rating || 0),
						totalReviews: Number(venueData?.total_reviews || 0)
					});
				}

				if (hasCommunity) {
					applyCommunityData(communityResult.value, hasDetail ? detailResult.value : null);
				}

				if (!hasDetail && !hasCommunity) {
					const detailError = detailResult.status === 'rejected' ? detailResult.reason : null;
					const communityError = communityResult.status === 'rejected' ? communityResult.reason : null;

					setError(
						detailError?.response?.data?.message ||
						communityError?.response?.data?.message ||
						'Unable to load venue details.'
					);
				}
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
	}, [apiBase, venueId]);

	useEffect(() => {
		setIsDescriptionExpanded(false);
	}, [venueId]);

	// Fetch venue services
	useEffect(() => {
		if (!venueId) return;
		let active = true;

		async function loadVenueServices() {
			try {
				const response = await fetchVenueServices(venueId);
				if (!active) {
					return;
				}

				const servicesFromApi = Array.isArray(response?.services) ? response.services : [];
				setVenueServices(servicesFromApi);
			} catch (err) {
				console.error('Error fetching venue services:', err);
				if (active) {
					setVenueServices([]);
				}
			}
		}

		loadVenueServices();

		return () => {
			active = false;
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
		if (shouldAutoOpenChat) {
			setShowChatWidget(true);
		}
	}, [shouldAutoOpenChat]);

	useEffect(() => {
		const applySyncedChatThread = (payload) => {
			if (!payload || typeof payload !== 'object') {
				setSyncedChatThread(null);
				return;
			}

			setSyncedChatThread({
				threadId: payload.threadId || null,
				venueId: payload.venueId || null,
				ownerUserId: payload.ownerUserId || '',
				customerUserId: payload.customerUserId || ''
			});
		};

		try {
			const rawValue = window.localStorage.getItem(ACTIVE_CHAT_THREAD_SYNC_KEY);
			applySyncedChatThread(rawValue ? JSON.parse(rawValue) : null);
		} catch {
			setSyncedChatThread(null);
		}

		const handleActiveChatThreadChanged = (event) => {
			applySyncedChatThread(event?.detail || null);
		};

		const handleActiveChatThreadStorage = (event) => {
			if (event.key !== ACTIVE_CHAT_THREAD_SYNC_KEY) {
				return;
			}

			try {
				applySyncedChatThread(event.newValue ? JSON.parse(event.newValue) : null);
			} catch {
				setSyncedChatThread(null);
			}
		};

		window.addEventListener('active-chat-thread-changed', handleActiveChatThreadChanged);
		window.addEventListener('storage', handleActiveChatThreadStorage);

		return () => {
			window.removeEventListener('active-chat-thread-changed', handleActiveChatThreadChanged);
			window.removeEventListener('storage', handleActiveChatThreadStorage);
		};
	}, []);

	useEffect(() => {
		if (!showChatWidget || !authToken || !venueId) {
			return;
		}

		let active = true;

		const loadChatThread = async (showLoader = true) => {
			if (showLoader) {
				setChatLoading(true);
			}

			try {
				const data = await fetchVenueChatThread(
					venueId,
					effectiveSelectedChatThreadId ? { threadId: effectiveSelectedChatThreadId } : {},
					token
				);
				if (!active) {
					return;
				}

				setChatError('');
				setActiveChatThreadId(data?.thread?.id || null);
				setChatMessages(Array.isArray(data?.thread?.messages) ? data.thread.messages : []);
				const nextContextOptions = Array.isArray(data?.contextOptions) ? data.contextOptions : [];
				setChatContextOptions(nextContextOptions);
				setSelectedChatContextValue((prev) => {
					if (prev && (prev === 'other' || nextContextOptions.some((option) => String(option?.id || '') === prev))) {
						return prev;
					}

					const currentVenueOption = nextContextOptions.find((option) => String(option?.id || '') === String(venueId || ''));
					if (currentVenueOption) {
						return String(currentVenueOption.id);
					}

					return 'other';
				});
			} catch (requestError) {
				if (!active) {
					return;
				}

				setChatMessages([]);
				setActiveChatThreadId(null);
				setChatContextOptions([]);
				setSelectedChatContextValue('');
				setChatError(requestError?.response?.data?.message || 'Unable to load chat conversation.');
			} finally {
				if (active && showLoader) {
					setChatLoading(false);
				}
			}
		};

		loadChatThread(true);
		const intervalId = window.setInterval(() => loadChatThread(false), 5000);

		return () => {
			active = false;
			window.clearInterval(intervalId);
		};
	}, [showChatWidget, authToken, venueId, effectiveSelectedChatThreadId]);

	useEffect(() => {
		if (!chatListRef.current) {
			return;
		}

		chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
	}, [chatMessages]);

	useEffect(() => {
		if (!showChatWidget || !activeChatThreadId || !authToken || !chatMessages.length) {
			return;
		}

		markChatThreadRead(activeChatThreadId, token)
			.then((result) => {
				window.dispatchEvent(new CustomEvent('chat-threads-read', { detail: result || {} }));
			})
			.catch(() => {});
	}, [showChatWidget, activeChatThreadId, authToken, token, chatMessages.length]);

	useEffect(() => {
		const applyDeletedThread = (detail) => {
			const deletedGroupKey = String(detail?.groupKey || '').trim();
			const deletedVenueId = String(detail?.venueId || '').trim();
			const deletedThreadIds = new Set(
				(Array.isArray(detail?.deletedThreadIds) ? detail.deletedThreadIds : []).map((value) => String(value))
			);
			const currentVenueId = String(venueId || '').trim();

			const matchesActiveThread = activeChatThreadId && deletedThreadIds.has(String(activeChatThreadId));
			const matchesConversationGroup = deletedGroupKey && chatConversationGroupKey && deletedGroupKey === chatConversationGroupKey;
			const matchesVenue = deletedVenueId && currentVenueId && deletedVenueId === currentVenueId;

			if (!matchesActiveThread && !matchesConversationGroup && !matchesVenue) {
				return;
			}

			setChatMessages([]);
			setActiveChatThreadId(null);
			setChatInput('');
			setChatError('');
		};

		const handleDeletedThread = (event) => {
			applyDeletedThread(event?.detail || {});
		};

		const handleDeletedThreadStorage = (event) => {
			if (event.key !== CHAT_DELETE_SYNC_KEY || !event.newValue) {
				return;
			}

			try {
				applyDeletedThread(JSON.parse(event.newValue));
			} catch {
				// Ignore malformed sync payloads.
			}
		};

		window.addEventListener('chat-thread-deleted', handleDeletedThread);
		window.addEventListener('storage', handleDeletedThreadStorage);
		return () => {
			window.removeEventListener('chat-thread-deleted', handleDeletedThread);
			window.removeEventListener('storage', handleDeletedThreadStorage);
		};
	}, [activeChatThreadId, chatConversationGroupKey, venueId]);

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
		const reviewId = searchParams.get('reviewId');
		
		if (!reviewId || !reviews.length) {
			return;
		}

		setTimeout(() => {
			const reviewElement = reviewItemRefs.current[reviewId];
			if (reviewElement) {
				reviewElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
				// Add subtle glow animation
				reviewElement.classList.add('scrolled-to');
				setTimeout(() => {
					reviewElement.classList.remove('scrolled-to');
				}, 800);
			}
		}, 100);
	}, [searchParams, reviews]);

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

				setOpeningError(requestError?.response?.data?.message || 'Unable to load real-time opening hours.');
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

	const handleSelectRating = (event, starValue) => {
		handleChangeReviewField('rating', resolveHalfStarSelection(event, starValue));
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
			setFavoriteCollectionError('Unable to load favorite venues.');
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
			setFavoriteCollectionError('Unable to remove this venue from favorites.');
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
				setFavoriteError('Your session has expired. Please sign in again.');
				navigate(APP_ROUTES.LOGIN);
			} else {
				setFavoriteError(requestError?.response?.data?.message || 'Favorite action failed. Please try again.');
			}
		} finally {
			setFavoriteLoading(false);
		}
	};

	const handleSendChatMessage = async (event) => {
		event.preventDefault();

		const normalizedMessage = chatInput.trim();
		if (!normalizedMessage || !venue) {
			return;
		}

		if (!authToken) {
			navigate(APP_ROUTES.LOGIN);
			return;
		}

		if (!canUseVenueChat) {
			setChatError('This venue is not linked to an owner, so chat is unavailable.');
			return;
		}

		setChatSending(true);
		setChatError('');

		try {
			const normalizedContextValue = String(selectedChatContextValue || '').trim();
			const response = await sendVenueChatMessage(
				venueId,
				{
					content: normalizedMessage,
					threadId: activeChatThreadId || undefined,
					contextVenueId:
						normalizedContextValue && normalizedContextValue !== 'other'
							? Number(normalizedContextValue)
							: undefined,
					contextLabel: normalizedContextValue === 'other' ? 'Other' : undefined
				},
				token
			);

			setActiveChatThreadId(response?.thread?.id || activeChatThreadId || null);
			setChatMessages(Array.isArray(response?.thread?.messages) ? response.thread.messages : []);
			setChatInput('');

			if (response?.thread?.id) {
				await markChatThreadRead(response.thread.id, token).catch(() => {});
			}
		} catch (requestError) {
			setChatError(requestError?.response?.data?.message || 'Unable to send message.');
		} finally {
			setChatSending(false);
		}
	};
	const handleSubmitReview = async (event) => {
		event.preventDefault();
		setReviewError('');
		setReviewActionError('');

		const normalizedTitle = reviewForm.title.trim();
		const normalizedComment = reviewForm.comment.trim();

		if (!normalizedComment) {
			setReviewError('Please enter your review comment.');
			return;
		}

		const blockedTerm = findBlockedTerm(`${normalizedTitle} ${normalizedComment}`);
		if (blockedTerm) {
			setReviewError('Your review contains inappropriate words. Please revise and try again.');
			return;
		}

		const payload = new FormData();
		if (isValidHalfStarRating(reviewForm.rating)) {
			payload.append('rating', String(reviewForm.rating));
		}
		payload.append('title', normalizedTitle);
		payload.append('comment', normalizedComment);
		reviewForm.images.forEach((file) => payload.append('images', file));

		setSubmittingReview(true);
		try {
			if (editingReviewId) {
				const response = await updateVenueReview(venueId, editingReviewId, payload);

				if (response?.review?.id) {
					setReviews((prev) =>
						prev.map((item) =>
							String(item.id) === String(response.review.id)
								? {
									...item,
									...response.review,
									rating: normalizeHalfStarRating(response.review.rating),
									imageUrls: Array.isArray(response.review.imageUrls) ? response.review.imageUrls : [],
									canDelete: true
								}
								: item
						)
					);
				}

				if (response?.stats) {
					setCommunityStats({
						averageRating: Number(response.stats.averageRating || 0),
						totalReviews: Number(response.stats.totalReviews || 0)
					});
				}

				await reloadCommunityData();
				setReviewForm({ rating: null, title: '', comment: '', images: [] });
				setEditingReviewId(null);
				setShowCommentModal(false);
				return;
			}

			const response = await createVenueReview(venueId, payload);
			const createdReview = response?.review;

			if (createdReview?.id) {
				setReviews((prev) => {
					const nextReview = {
						...createdReview,
						rating: normalizeHalfStarRating(createdReview.rating),
						imageUrls: Array.isArray(createdReview.imageUrls) ? createdReview.imageUrls : [],
						likeCount: Number(createdReview.likeCount || 0),
						replyCount: Number(createdReview.replyCount || 0),
						likedByMe: Boolean(createdReview.likedByMe),
						replies: Array.isArray(createdReview.replies) ? createdReview.replies : [],
						canDelete: true
					};

					return [nextReview, ...prev];
				});

				setAllReviewImages((prev) => {
					const venueImageSet = new Set(venueGalleryImages);
					const appended = (Array.isArray(createdReview.imageUrls) ? createdReview.imageUrls : []).filter(
						(imageUrl) => !venueImageSet.has(resolveAssetUrl(imageUrl, apiBase))
					);
					return resolveUniqueAssetUrls([...prev, ...appended], apiBase).filter(
						(imageUrl) => !venueImageSet.has(imageUrl)
					);
				});
			}

			if (response?.stats) {
				setCommunityStats({
					averageRating: Number(response.stats.averageRating || 0),
					totalReviews: Number(response.stats.totalReviews || 0)
				});
			} else {
				setCommunityStats((prev) => ({
					...prev,
					totalReviews: prev.totalReviews + 1,
					averageRating: prev.averageRating
				}));
			}

			setReviewForm({ rating: null, title: '', comment: '', images: [] });
			setEditingReviewId(null);
			setShowCommentModal(false);
		} catch (submitError) {
			setReviewError(submitError?.response?.data?.message || 'Failed to submit review.');
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

	const handleSelectReplyRating = (event, starValue) => {
		setReplyForm((prev) => ({ ...prev, rating: resolveHalfStarSelection(event, starValue) }));
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
			setReviewActionError(error?.response?.data?.message || 'Unable to update like status.');
		}
	};

	const handleToggleReplyLike = async (review, reply) => {
		if (!authToken) {
			navigate(APP_ROUTES.LOGIN);
			return;
		}

		setReviewActionError('');
		try {
			const response = await toggleVenueReviewReplyLike(venueId, review.id, reply.id);
			setReviews((prev) =>
				prev.map((item) =>
					item.id === review.id
						? {
							...item,
							replies: Array.isArray(item.replies)
								? item.replies.map((childReply) =>
									childReply.id === reply.id
										? {
											...childReply,
											likeCount: Number(response?.likeCount || 0),
											likedByMe: Boolean(response?.liked)
										}
										: childReply
								)
								: []
						}
						: item
				)
			);
		} catch (error) {
			setReviewActionError(error?.response?.data?.message || 'Unable to update like status.');
		}
	};

	const handleReplyToReply = (review, reply) => {
		setReviewActionError('');
		setActiveReplyReview(review);
		setReplyForm({
			rating: null,
			title: '',
			content: `@${reply?.authorName || 'Anonymous'} `,
			images: []
		});
		setShowReplyModal(true);
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
			if (isValidHalfStarRating(replyForm.rating)) {
				payload.append('rating', String(replyForm.rating));
			}
			replyForm.images.forEach((file) => payload.append('images', file));

			const response = await createVenueReviewReply(venueId, activeReplyReview.id, payload);
			const createdReply = response?.reply;

			if (createdReply?.id) {
				setReviews((prev) =>
					prev.map((item) => {
						if (String(item.id) !== String(activeReplyReview.id)) {
							return item;
						}

						const nextReplies = [
							...(Array.isArray(item.replies) ? item.replies : []),
							{
								...createdReply,
								rating: normalizeHalfStarRating(createdReply.rating),
								imageUrls: Array.isArray(createdReply.imageUrls) ? createdReply.imageUrls : [],
								likeCount: Number(createdReply.likeCount || 0),
								likedByMe: Boolean(createdReply.likedByMe)
							}
						];

						return {
							...item,
							replies: nextReplies,
							replyCount: Number(response?.replyCount || nextReplies.length)
						};
					})
				);
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

		const confirmed = window.confirm('Are you sure you want to delete this review?');
		if (!confirmed) {
			return;
		}

		setReviewActionError('');
		try {
			await deleteVenueReview(venueId, review.id);
			await reloadCommunityData();
		} catch (error) {
			setReviewActionError(error?.response?.data?.message || 'Unable to delete this review.');
		}
	};

	const handleDeleteReply = async (review, reply) => {
		if (!reply?.canDelete) {
			return;
		}

		const confirmed = window.confirm('Are you sure you want to delete this discussion?');
		if (!confirmed) {
			return;
		}

		setReviewActionError('');
		try {
			await deleteVenueReviewReply(venueId, review.id, reply.id);
			await reloadCommunityData();
		} catch (error) {
			setReviewActionError(error?.response?.data?.message || 'Unable to delete this discussion.');
		}
	};

	const handleOpenImagePreview = (imageUrl, altText = 'Review attachment') => {
		const resolvedUrl = resolveAssetUrl(imageUrl, apiBase);
		if (!resolvedUrl) {
			return;
		}

		setActiveImagePreview({
			url: resolvedUrl,
			alt: altText
		});
	};

	const handleEditReview = (review) => {
		if (!review?.canDelete) {
			return;
		}

		setEditingReviewId(review.id);
		setReviewError('');
		setReviewActionError('');
		setReviewForm({
			rating: isValidHalfStarRating(review.rating) ? normalizeHalfStarRating(review.rating) : null,
			title: String(review.title || '').trim(),
			comment: String(review.comment || '').trim(),
			images: []
		});
		setShowCommentModal(true);
	};

	const closeCommentModal = () => {
		setShowCommentModal(false);
		setEditingReviewId(null);
		setReviewError('');
		setReviewForm({ rating: null, title: '', comment: '', images: [] });
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
		return <section className={`venue-detail-page theme-${theme}`}><p>Loading venue details...</p></section>;
	}

	if (error || !venue) {
		return (
			<section className={`venue-detail-page theme-${theme}`}>
				<div className="venue-detail-error-box">
					<p>{error || 'Venue not found.'}</p>
					<button type="button" onClick={handleBackNavigation}>Back</button>
				</div>
			</section>
		);
	}

	const currentOpen = openingRealtime?.current || null;
	const isRealtimeReady = Boolean(currentOpen);
	const displayStart = currentOpen?.start || todaySchedule?.open || 'N/A';
	const displayEnd = currentOpen?.end || todaySchedule?.close || 'N/A';
	const displayStatusText = !isRealtimeReady ? i18n.updating : currentOpen?.isOpen ? i18n.openNow : i18n.closedNow;
	const showOpenState = isRealtimeReady ? currentOpen?.isOpen : !todaySchedule?.off;
	const displaySchedule =
		Array.isArray(openingRealtime?.weeklySchedule) && openingRealtime.weeklySchedule.length > 0
			? openingRealtime.weeklySchedule
			: weeklySchedule;
	const venueAddress = String(venue?.address || '').trim();
	const venueLatitude = Number(venue?.latitude);
	const venueLongitude = Number(venue?.longitude);

	const handleOpenInternalVenueMap = () => {
		const params = new URLSearchParams();
		const venueId = String(venue?.id || '').trim();

		if (venueId) {
			params.set('venueId', venueId);
		}

		if (Number.isFinite(venueLatitude) && Number.isFinite(venueLongitude)) {
			params.set('lat', String(venueLatitude));
			params.set('lng', String(venueLongitude));
		}

		navigate(`${APP_ROUTES.CITY_MAP}${params.toString() ? `?${params.toString()}` : ''}`);
	};

	return (
		<section className={`venue-detail-page theme-${theme}`}>
			{/* Hero Section with Image Auto-Rotation */}
			<HeroVenueSection
				venue={venue}
				images={venueGalleryImages}
				onPreviewImage={(imageUrl) => handleOpenImagePreview(imageUrl, 'Venue cover image')}
				onBackClick={handleBackNavigation}
				onWriteReview={() => {
					setEditingReviewId(null);
					setReviewError('');
					setReviewForm({ rating: null, title: '', comment: '', images: [] });
					setShowCommentModal(true);
				}}
				onAddPhotos={() => setShowImagesModal(true)}
				onShare={() => setShowShareModal(true)}
				onSave={handleToggleFavorite}
				onReportVenue={openVenueReportModal}
				isSaved={isFavorite}
				isOpen={showOpenState}
				rating={Number(communityStats.averageRating || 0)}
				reviews={Number(communityStats.totalReviews || 0)}
				category={String(venue?.category || 'Dining').trim()}
				openingHours={`${formatDisplayTime(displayStart)} - ${formatDisplayTime(displayEnd)}`}
			/>


			{/* Venue Info Layout */}
			<div className="venue-detail-info-grid">
				<div className="venue-detail-info-left">
					<VenueInfoSection
						description={visibleVenueDescription || (language === 'vi' ? 'Chưa có mô tả cho quán này.' : 'No description available for this venue.')}
						services={Array.isArray(venueServices) ? venueServices : []}
						labels={{
							aboutTitle: i18n.aboutTitle,
							servicesTitle: i18n.servicesTitle,
							serviceFallback: i18n.serviceFallback,
							noDescription: language === 'vi' ? 'Chưa có mô tả cho quán này.' : 'No description available for this venue.'
						}}
						resolveServiceIcon={resolveServiceIcon}
						showServices={false}
					/>
					{venue ? (
						<VenueLocationMap
							venue={venue}
							address={venueAddress}
							latitude={venueLatitude}
							longitude={venueLongitude}
							weeklySchedule={displaySchedule || []}
							currentStatusText={displayStatusText}
							isOpenNow={showOpenState}
							labels={{
								title: i18n.mapSectionTitle,
								openingHours: i18n.mapOpeningHours,
								noSchedule: i18n.mapNoSchedule,
								weekDays: i18n.weekDays,
								addressLabel: i18n.mapAddressLabel,
								addressFallback: i18n.mapAddressFallback,
								openMapTitle: i18n.openInternalMap
							}}
							onOpenInternalMap={handleOpenInternalVenueMap}
						/>
					) : null}
					<div className="venue-services-container venue-services-container--after-location">
						<h2>{i18n.servicesTitle}</h2>
						{Array.isArray(venueServices) && venueServices.length > 0 ? (
							<div className="services-grid">
								{venueServices.map((service, idx) => (
									<div key={idx} className="service-card">
										<div className="service-icon">
											{resolveServiceIcon(service)}
										</div>
										<div className="service-name">
											{service.name || i18n.serviceFallback}
										</div>
										{service.description && (
											<div className="service-description">
												{service.description}
											</div>
										)}
									</div>
								))}
							</div>
						) : (
							<p className="venue-services-empty">{i18n.servicesEmpty}</p>
						)}
					</div>
				</div>
				<div className="venue-detail-info-right">
					<div className="venue-detail-contact-card">
						<h3>{i18n.contactTitle}</h3>
						<div className="venue-detail-contact-item">
							<span className="venue-detail-contact-label">{i18n.phoneLabel}</span>
							<a
								href={`tel:${String(venue?.phone || '').trim()}`}
								className="venue-detail-contact-value"
							>
								{String(venue?.phone || '').trim() || i18n.notUpdated}
							</a>
						</div>
						<div className="venue-detail-contact-item">
							<span className="venue-detail-contact-label">{i18n.addressLabel}</span>
							<button
								type="button"
								className="venue-detail-location-btn"
								onClick={handleOpenInternalVenueMap}
								title={i18n.openInternalMap}
							>
								📍 {venueAddress || i18n.notUpdated}
							</button>
						</div>

						<div className="venue-detail-chat-anchor">
							<button
								type="button"
								className="venue-detail-message-btn"
								onClick={() => {
									if (!authToken) {
										navigate(APP_ROUTES.LOGIN);
										return;
									}

									setShowChatWidget((prev) => !prev);
								}}
							>
								{i18n.messageVenue}
							</button>

							{showChatWidget && authToken && canUseVenueChat ? (
								<div className="venue-chat-widget">
									<div className="venue-chat-widget-header">
										<div className="venue-chat-widget-brand">
											<div className="venue-chat-widget-avatar">
												<img src={resolveCoverImage(venue)} alt={resolveVenueName(venue)} loading="lazy" />
											</div>
											<div>
												<strong>{chatVenueMeta?.ownerName || i18n.chatOwnerFallback}</strong>
												<p>{showOpenState ? i18n.openNow : i18n.closedNow} · {venue.ward_name || i18n.areaUpdating}</p>
											</div>
										</div>
										<div className="venue-chat-widget-actions">
											<button
												type="button"
												className="venue-chat-widget-minimize"
												onClick={() => setShowChatWidget(false)}
												aria-label="Collapse chat"
											>
												−
											</button>
										</div>
									</div>

									<div className="venue-chat-widget-body">
										<div className="venue-chat-widget-intro">
											<p className="venue-chat-widget-intro-title">{i18n.currentVenueInfo}</p>
											<p><strong>{resolveVenueName(venue)}</strong></p>
											<p>📍 {venue.address || i18n.noAddressYet}</p>
											<p>💲 {venuePriceRange}</p>
											<p>⭐ {Number(communityStats.averageRating || 0).toFixed(1)}/5 · {communityStats.totalReviews} {i18n.reviewsUnit}</p>
										</div>

										<div className="venue-chat-widget-messages" ref={chatListRef}>
											{chatLoading ? (
												<div className="venue-chat-widget-empty">
													<p>{i18n.loadingMessages}</p>
												</div>
											) : chatError ? (
												<div className="venue-chat-widget-empty">
													<p>{chatError}</p>
												</div>
											) : chatMessages.length ? (
												chatMessages.map((message) => {
													const contextLine = buildChatContextLine(message, chatVenueMeta);
													const resolvedMessageVenueName = String(message?.venueName || '').trim();
													const shouldShowVenueContext = Boolean(contextLine || resolvedMessageVenueName);

													return (
													<article
														key={message.id}
														className={`venue-chat-widget-bubble ${message.sender === 'seller' ? 'is-seller' : 'is-customer'}`}
													>
														<header>
															<strong>{message.author}</strong>
															<span>{new Date(message.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
														</header>
														{shouldShowVenueContext ? <p className="venue-chat-widget-context">{contextLine}</p> : null}
														<p>{message.content}</p>
													</article>
													);
												})
											) : !canUseVenueChat ? (
												<div className="venue-chat-widget-empty">
													<p>{i18n.chatUnavailable}</p>
												</div>
											) : isCurrentUserVenueOwner && !effectiveSelectedChatThreadId ? (
												<div className="venue-chat-widget-empty">
													<p>{i18n.openFromHeaderHint}</p>
												</div>
											) : (
												<div className="venue-chat-widget-empty">
													<p>{i18n.startChatHint}</p>
												</div>
											)}
										</div>

										<form className="venue-chat-widget-form" onSubmit={handleSendChatMessage}>
											<textarea
												rows="3"
												value={chatInput}
												onChange={(event) => setChatInput(event.target.value)}
												placeholder={i18n.typeMessagePlaceholder}
												disabled={!authToken || !canUseVenueChat}
											/>
											<div className="venue-chat-widget-form-footer">
												<span>{chatMessages.length} messages</span>
												<select
													className="venue-chat-widget-context-select"
													value={selectedChatContextValue}
													onChange={(event) => setSelectedChatContextValue(event.target.value)}
													disabled={!authToken || !canUseVenueChat || chatSending || chatLoading}
												>
													{chatContextOptions.map((option) => (
														<option key={`chat-context-${option.id}`} value={String(option.id)}>
															{option.name}
														</option>
													))}
													<option value="other">{i18n.other}</option>
												</select>
												{authToken ? (
													<button
														type="submit"
														disabled={chatSending || chatLoading || !chatInput.trim() || !canUseVenueChat || (isCurrentUserVenueOwner && !activeChatThreadId)}
													>
														{chatSending ? i18n.sending : i18n.send}
													</button>
												) : (
													<button type="button" onClick={() => navigate(APP_ROUTES.LOGIN)}>
														{i18n.signIn}
													</button>
												)}
											</div>
										</form>
									</div>
								</div>
							) : null}
						</div>
					</div>

					<SimilarVenuesSection
						currentVenueId={venue?.id}
						currentCategoryId={Number(venue?.category_id || 0)}
						currentWardId={String(venue?.ward_id || '').trim()}
						currentCategoryLabel={String(venue?.category_name || venue?.category || '').trim()}
						currentWardLabel={String(venue?.ward_name || '').trim()}
						maxItems={3}
						labels={{
							title: i18n.similarTitle,
							descriptionPrefix: i18n.similarDescriptionPrefix,
							descriptionMiddle: i18n.similarDescriptionMiddle,
							loading: i18n.similarLoading,
							empty: i18n.similarEmpty,
							errorPrefix: i18n.similarErrorPrefix,
							viewLabel: i18n.similarView,
							reviews: i18n.reviewsUnit,
							defaultCategoryLabel: language === 'vi' ? 'địa điểm' : 'venues',
							defaultWardLabel: language === 'vi' ? 'khu vực này' : 'this area'
						}}
						onVenueClick={(venueId) => {
							navigate(`/venues/${venueId}`);
							window.scrollTo(0, 0);
						}}
					/>
				</div>
			</div>


			<section className="venue-detail-reviews-section">
				<div className="venue-detail-reviews-header">
					<h2>Reviews</h2>
					<button
						type="button"
						className="venue-review-quick-comment-btn"
						onClick={() => {
							setEditingReviewId(null);
							setReviewError('');
							setReviewForm({ rating: null, title: '', comment: '', images: [] });
							setShowCommentModal(true);
						}}
					>
						{language === 'vi' ? '💬 Bình luận ngay' : '💬 Add a comment'}
					</button>
				</div>
				{reviewActionError ? <p className="venue-form-error">{reviewActionError}</p> : null}

				{!reviews.length ? <p>No reviews for this venue yet.</p> : null}

				<div className="venue-review-list">
					{reviews.map((review) => (
						<article
							key={`review-${review.id}`}
							className="venue-review-card"
							ref={(el) => {
								if (el) {
									reviewItemRefs.current[review.id] = el;
								} else {
									delete reviewItemRefs.current[review.id];
								}
							}}
						>
							<header>
								<strong>{review.authorName || 'Anonymous'}</strong>
								<span>{new Date(review.createdAt || review.created_at).toLocaleString('en-US')}</span>
							</header>
							<p className="venue-review-stars"><StarRatingDisplay rating={review.rating} /> · {Number(review.rating || 0).toFixed(1)}</p>
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
											className="venue-review-clickable-image"
											onClick={() => handleOpenImagePreview(imageUrl, 'Review attachment')}
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
									<span>Like</span>
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
									onClick={() => openReviewReportModal(review)}
								>
									<span aria-hidden="true">⚠</span>
									<span>Report</span>
								</button>

								{review.canDelete ? (
									<button
										type="button"
										className="venue-review-action-btn"
										onClick={() => handleEditReview(review)}
									>
										<span aria-hidden="true">✎</span>
										<span>Edit</span>
									</button>
								) : null}

								{review.canDelete ? (
									<button
										type="button"
										className="venue-review-action-btn is-danger"
										onClick={() => handleDeleteReview(review)}
									>
										<span aria-hidden="true">🗑</span>
										<span>Delete</span>
									</button>
								) : null}
							</div>

							{Array.isArray(review.replies) && review.replies.length ? (
								<div className="venue-review-reply-preview-list">
									{review.replies.map((reply) => (
										<div key={`reply-preview-${review.id}-${reply.id}`} className="venue-review-reply-item">
											<strong>{reply.authorName || 'Anonymous'}</strong>
											<span>{new Date(reply.createdAt || reply.created_at).toLocaleString('en-US')}</span>
											{Number(reply.rating || 0) > 0 ? <p className="venue-review-stars"><StarRatingDisplay rating={reply.rating} /> · {Number(reply.rating || 0).toFixed(1)}</p> : null}
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
															className="venue-review-clickable-image"
															onClick={() => handleOpenImagePreview(imageUrl, 'Reply attachment')}
														/>
													))}
												</div>
											) : null}
											<div className="venue-review-reply-actions">
												<button
													type="button"
													className={`venue-review-action-btn ${reply.likedByMe ? 'is-active' : ''}`}
													onClick={() => handleToggleReplyLike(review, reply)}
												>
													<span aria-hidden="true">♥</span>
													<span>Like</span>
													<strong>{Number(reply.likeCount || 0)}</strong>
												</button>

												<button
													type="button"
													className="venue-review-action-btn"
													onClick={() => handleReplyToReply(review, reply)}
												>
													<span aria-hidden="true">💬</span>
													<span>{i18n.discuss}</span>
												</button>

												<button
													type="button"
													className="venue-review-action-btn"
													onClick={() => openReplyReportModal(review, reply)}
												>
													<span aria-hidden="true">⚠</span>
													<span>Report</span>
												</button>

												{reply.canDelete ? (
													<button
														type="button"
														className="venue-review-action-btn is-danger"
														onClick={() => handleDeleteReply(review, reply)}
													>
														<span aria-hidden="true">🗑</span>
														<span>Delete</span>
													</button>
												) : null}
											</div>
										</div>
									))}
								</div>
							) : null}
						</article>
					))}
				</div>
			</section>

			{showVenueReportModal ? (
				<div className="venue-modal-overlay" onClick={() => setShowVenueReportModal(false)}>
					<div className="venue-modal-card venue-report-modal-card" onClick={(event) => event.stopPropagation()}>
						<header className="venue-report-modal-head">
							<h3>🚨 Report venue</h3>
							<button type="button" onClick={() => setShowVenueReportModal(false)}>×</button>
						</header>

						<form className="venue-report-modal-form" onSubmit={handleSubmitVenueReport}>
							<label>
								Report reason
								<select
									value={venueReportForm.reason}
									onChange={(event) => setVenueReportForm((prev) => ({ ...prev, reason: event.target.value }))}
									required
								>
									<option value="">— Select reason —</option>
									{VENUE_REPORT_REASON_OPTIONS.map((item) => (
										<option key={`venue-report-reason-${item.value}`} value={item.value}>
											{item.label}
										</option>
									))}
								</select>
							</label>

							<label>
								Detailed description
								<textarea
									rows="4"
									value={venueReportForm.description}
									onChange={(event) => setVenueReportForm((prev) => ({ ...prev, description: event.target.value }))}
									placeholder="Describe the issue in detail..."
								/>
							</label>

							<div className="venue-report-upload-row">
								<label className="venue-report-upload-btn">
									📷 Upload image
									<input
										type="file"
										accept="image/png,image/jpeg,image/webp"
										onChange={(event) => {
											const nextFile = event.target.files?.[0] || null;
											setVenueReportForm((prev) => ({ ...prev, attachment: nextFile }));
										}}
									/>
								</label>
								{venueReportAttachmentPreview ? (
									<div className="venue-report-upload-preview">
										<img src={venueReportAttachmentPreview} alt="Report attachment preview" />
										<button
											type="button"
											onClick={() => setVenueReportForm((prev) => ({ ...prev, attachment: null }))}
										>
											×
										</button>
									</div>
								) : null}
							</div>

							<div className="venue-report-severity-row">
								<span>Quick severity:</span>
								<div>
									{REPORT_SEVERITY_OPTIONS.map((item) => (
										<button
											key={`venue-report-severity-${item.value}`}
											type="button"
											className={`venue-report-severity-chip ${venueReportForm.severity === item.value ? 'is-active' : ''}`}
											onClick={() => setVenueReportForm((prev) => ({ ...prev, severity: item.value }))}
										>
											{item.stars} {item.label}
										</button>
									))}
								</div>
							</div>

							<p className="venue-report-warning">⚠️ False reports may lead to account restrictions</p>

							{venueReportStatus.message ? (
								<p className={`venue-report-status ${venueReportStatus.type}`}>{venueReportStatus.message}</p>
							) : null}

							<div className="venue-report-actions">
								<button type="button" onClick={() => setShowVenueReportModal(false)}>
									Cancel
								</button>
								<button type="submit" className="is-danger" disabled={submittingVenueReport}>
									{submittingVenueReport ? 'Submitting...' : 'Submit report'}
								</button>
							</div>
						</form>
					</div>
				</div>
			) : null}

			{showReviewReportModal && activeReviewToReport ? (
				<div className="venue-modal-overlay" onClick={() => setShowReviewReportModal(false)}>
					<div className="venue-modal-card venue-comment-report-modal" onClick={(event) => event.stopPropagation()}>
						<header className="venue-report-modal-head">
							<h3>🚨 Report review</h3>
							<button type="button" onClick={() => setShowReviewReportModal(false)}>×</button>
						</header>

						<p className="venue-report-intro">Please select a reason and describe the review issue in detail.</p>

						<div className="venue-comment-report-preview">
							<strong>{activeReviewToReport.authorName || 'Anonymous'}</strong>
							<p>{activeReviewToReport.comment || ''}</p>
						</div>

						<form className="venue-report-modal-form" onSubmit={handleSubmitReviewReport}>
							<fieldset className="venue-report-radio-grid">
								<legend>Report reason:</legend>
								{REVIEW_REPORT_REASON_OPTIONS.map((item) => (
									<label key={`review-report-reason-${item.value}`}>
										<input
											type="radio"
											name="venue-review-report-reason"
											value={item.value}
											checked={reviewReportForm.reason === item.value}
											onChange={(event) => setReviewReportForm((prev) => ({ ...prev, reason: event.target.value }))}
										/>
										<span>{item.label}</span>
									</label>
								))}
							</fieldset>

							<label>
								<textarea
									rows="3"
									value={reviewReportForm.description}
									onChange={(event) => setReviewReportForm((prev) => ({ ...prev, description: event.target.value }))}
									placeholder="Describe the issue in detail..."
								/>
							</label>

							<p className="venue-report-warning">⚠️ False reports may lead to account restrictions</p>

							{reviewReportStatus.message ? (
								<p className={`venue-report-status ${reviewReportStatus.type}`}>{reviewReportStatus.message}</p>
							) : null}

							<div className="venue-report-actions">
								<button type="button" onClick={() => setShowReviewReportModal(false)}>
									Cancel
								</button>
								<button type="submit" className="is-danger" disabled={submittingReviewReport}>
									{submittingReviewReport ? 'Submitting...' : 'Submit report'}
								</button>
							</div>
						</form>
					</div>
				</div>
			) : null}

			{showReplyReportModal && activeReplyToReport?.reply ? (
				<div className="venue-modal-overlay" onClick={() => setShowReplyReportModal(false)}>
					<div className="venue-modal-card venue-comment-report-modal" onClick={(event) => event.stopPropagation()}>
						<header className="venue-report-modal-head">
							<h3>🚨 Report reply</h3>
							<button type="button" onClick={() => setShowReplyReportModal(false)}>×</button>
						</header>

						<p className="venue-report-intro">Please select a reason and describe the reply issue in detail.</p>

						<div className="venue-comment-report-preview">
							<strong>{activeReplyToReport.reply.authorName || 'Anonymous'}</strong>
							<p>{activeReplyToReport.reply.content || ''}</p>
						</div>

						<form className="venue-report-modal-form" onSubmit={handleSubmitReplyReport}>
							<fieldset className="venue-report-radio-grid">
								<legend>Report reason:</legend>
								{REVIEW_REPORT_REASON_OPTIONS.map((item) => (
									<label key={`reply-report-reason-${item.value}`}>
										<input
											type="radio"
											name="venue-reply-report-reason"
											value={item.value}
											checked={replyReportForm.reason === item.value}
											onChange={(event) => setReplyReportForm((prev) => ({ ...prev, reason: event.target.value }))}
										/>
										<span>{item.label}</span>
									</label>
								))}
							</fieldset>

							<label>
								<textarea
									rows="3"
									value={replyReportForm.description}
									onChange={(event) => setReplyReportForm((prev) => ({ ...prev, description: event.target.value }))}
									placeholder="Describe the issue in detail..."
								/>
							</label>

							<p className="venue-report-warning">⚠️ False reports may lead to account restrictions</p>

							{replyReportStatus.message ? (
								<p className={`venue-report-status ${replyReportStatus.type}`}>{replyReportStatus.message}</p>
							) : null}

							<div className="venue-report-actions">
								<button type="button" onClick={() => setShowReplyReportModal(false)}>
									Cancel
								</button>
								<button type="submit" className="is-danger" disabled={submittingReplyReport}>
									{submittingReplyReport ? 'Submitting...' : 'Submit report'}
								</button>
							</div>
						</form>
					</div>
				</div>
			) : null}

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

						{openingLoading ? <p>Loading...</p> : null}
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
											{item.off ? 'Closed' : `${item.open} - ${item.close}`}
										</div>
									))}
								</div>
							</div>
						) : null}
					</div>
				</div>
			) : null}

			{showCommentModal ? (
				<div className="venue-modal-overlay" onClick={closeCommentModal}>
					<div className="venue-modal-card venue-modal-comment" onClick={(event) => event.stopPropagation()}>
						<button type="button" className="venue-modal-close" onClick={closeCommentModal}>×</button>
						<h3>{editingReviewId ? 'Edit review' : 'Write a review'}</h3>

						<div className="venue-comment-hero-card">
							<img src={resolveCoverImage(venue)} alt={resolveVenueName(venue)} loading="lazy" />
							<div className="venue-comment-hero-content">
								<h4>{resolveVenueName(venue)}</h4>
								<p>📍 {venue.address || 'No address yet'}</p>
								<p className="venue-comment-hero-opening">
									<span className={showOpenState ? 'is-open' : 'is-close'}>{showOpenState ? 'Open now' : 'Closed now'}</span>
									{formatDisplayTime(displayStart)} - {formatDisplayTime(displayEnd)}
								</p>
								<p>💲 {venuePriceRange}</p>
								<p><StarRatingDisplay rating={communityStats.averageRating || 0} /> {Number(communityStats.averageRating || 0).toFixed(1)}/5 ({communityStats.totalReviews} reviews)</p>
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
									<span>Photo & Video</span>
									{reviewImagePreviews.length ? (
										<div className="venue-review-upload-preview-grid">
											{reviewImagePreviews.map((item) => (
												<div key={item.id} className="venue-review-upload-preview-item">
													<img src={item.url} alt="Review image" loading="lazy" />
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
									<small>{reviewForm.images.length ? `${reviewForm.images.length}/6 selected` : 'Up to 6 images'}</small>
								</label>

								<div className="venue-comment-fields">
									<label className="venue-comment-rating-row">
										Rating
										<div className="venue-star-rating-picker" role="radiogroup" aria-label="Star rating">
											{[1, 2, 3, 4, 5].map((value) => (
												(() => {
													const normalizedSelectedRating = normalizeHalfStarRating(reviewForm.rating);
													const isFull = normalizedSelectedRating >= value;
													const isHalf = !isFull && normalizedSelectedRating >= value - 0.5;

													return (
												<button
													key={`review-star-${value}`}
													type="button"
													className={`venue-star-btn ${isFull ? 'is-active' : ''} ${isHalf ? 'is-half-active' : ''}`}
													onClick={(event) => handleSelectRating(event, value)}
													aria-label={`${value} stars`}
												>
													★
												</button>
													);
												})()
											))}
										</div>
										<span className="venue-rating-hint">{reviewForm.rating ? `${normalizeHalfStarRating(reviewForm.rating)}/5` : 'Not selected'}</span>
									</label>

									<label>
										Title
										<input
											type="text"
											value={reviewForm.title}
											onChange={(event) => handleChangeReviewField('title', event.target.value)}
											placeholder="Title"
										/>
									</label>

									<label>
										Detailed review comment
										<textarea
											rows="5"
											value={reviewForm.comment}
											onChange={(event) => handleChangeReviewField('comment', event.target.value)}
											placeholder="Write your detailed review..."
										/>
									</label>
								</div>
								</div>

							{reviewError ? <p className="venue-form-error">{reviewError}</p> : null}

							<button type="submit" disabled={submittingReview}>
								{submittingReview ? 'Submitting...' : editingReviewId ? 'Save changes' : 'Submit review'}
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
														<img src={item.url} alt="Discussion image" loading="lazy" />
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
											<div className="venue-star-rating-picker" role="radiogroup" aria-label="Discussion star rating">
												{[1, 2, 3, 4, 5].map((value) => (
													(() => {
														const normalizedSelectedRating = normalizeHalfStarRating(replyForm.rating);
														const isFull = normalizedSelectedRating >= value;
														const isHalf = !isFull && normalizedSelectedRating >= value - 0.5;

														return (
													<button
														key={`reply-star-${value}`}
														type="button"
														className={`venue-star-btn ${isFull ? 'is-active' : ''} ${isHalf ? 'is-half-active' : ''}`}
														onClick={(event) => handleSelectReplyRating(event, value)}
														aria-label={`${value} stars`}
													>
														★
													</button>
														);
													})()
												))}
											</div>
											<span className="venue-rating-hint">{replyForm.rating ? `${normalizeHalfStarRating(replyForm.rating)}/5` : i18n.notSelected}</span>
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
						<h3>Images</h3>

						<section className="venue-image-group-section">
							<h4>Images from venue</h4>
							{!venueGalleryImages.length ? <p>No images from this venue yet.</p> : null}
							{venueGalleryImages.length ? (
								<div className="venue-images-grid">
									{venueGalleryImages.map((imageUrl) => (
										<img
											key={`venue-gallery-${imageUrl}`}
											src={resolveAssetUrl(imageUrl, apiBase)}
											alt="Venue gallery"
											loading="lazy"
											className="venue-review-clickable-image"
											onClick={() => handleOpenImagePreview(imageUrl, 'Venue gallery image')}
											onError={(event) => {
												event.currentTarget.onerror = null;
												event.currentTarget.src = FALLBACK_VENUE_IMAGE;
											}}
										/>
									))}
								</div>
							) : null}
						</section>

						<section className="venue-image-group-section">
							<h4>Images from reviews</h4>
							{!allReviewImages.length ? <p>No images from reviews yet.</p> : null}
							{allReviewImages.length ? (
								<div className="venue-images-grid">
									{allReviewImages.map((imageUrl) => (
										<img
											key={`review-gallery-${imageUrl}`}
											src={resolveAssetUrl(imageUrl, apiBase)}
											alt="Review gallery"
											loading="lazy"
											className="venue-review-clickable-image"
											onClick={() => handleOpenImagePreview(imageUrl, 'Review gallery image')}
											onError={(event) => {
												event.currentTarget.onerror = null;
												event.currentTarget.src = FALLBACK_VENUE_IMAGE;
											}}
										/>
									))}
								</div>
							) : null}
						</section>
					</div>
				</div>
			) : null}

			{activeImagePreview ? (
				<div className="venue-modal-overlay" onClick={() => setActiveImagePreview(null)}>
					<div className="venue-modal-card venue-modal-image-preview" onClick={(event) => event.stopPropagation()}>
						<button type="button" className="venue-modal-close" onClick={() => setActiveImagePreview(null)}>×</button>
						<img
							className="venue-image-preview-full"
							src={activeImagePreview.url}
							alt={activeImagePreview.alt || 'Preview image'}
							loading="lazy"
							onError={(event) => {
								event.currentTarget.onerror = null;
								event.currentTarget.src = FALLBACK_VENUE_IMAGE;
							}}
						/>
					</div>
				</div>
			) : null}

			{showShareModal ? (
				<div className="venue-modal-overlay" onClick={() => setShowShareModal(false)}>
					<div className="venue-modal-card venue-modal-share" onClick={(event) => event.stopPropagation()}>
						<button type="button" className="venue-modal-close" onClick={() => setShowShareModal(false)}>×</button>
						<h3>Share</h3>
						<p className="venue-share-subtitle">Choose a sharing method</p>

						<div className="venue-share-icons">
							<a
								href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
								target="_blank"
								rel="noreferrer"
								className="venue-share-icon-btn is-facebook"
								aria-label="Share on Facebook"
							>
								f
							</a>
							<a
								href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(resolveVenueName(venue))}&body=${encodeURIComponent(shareUrl)}`}
								target="_blank"
								rel="noreferrer"
								className="venue-share-icon-btn is-google"
								aria-label="Share via Gmail"
							>
								G
							</a>
						</div>

						<div className="venue-share-copy-row">
							<input type="text" readOnly value={shareUrl} aria-label="Share link" />
							<button type="button" onClick={handleCopyShareLink}>Copy link</button>
						</div>
						{shareCopied ? <p className="venue-share-copy-success">Link copied.</p> : null}
					</div>
				</div>
			) : null}

			{showFavoritesModal ? (
				<div className="venue-modal-overlay" onClick={() => setShowFavoritesModal(false)}>
					<div className="venue-modal-card venue-modal-favorites" onClick={(event) => event.stopPropagation()}>
						<button type="button" className="venue-modal-close" onClick={() => setShowFavoritesModal(false)}>×</button>
						<h3>Favorites & Collections</h3>

						{favoriteCollectionLoading ? <p>Loading favorite venues...</p> : null}
						{favoriteCollectionError ? <p className="venue-form-error">{favoriteCollectionError}</p> : null}

						{!favoriteCollectionLoading && !favoriteCollectionError && !favoriteCollection.length ? (
							<p>You do not have any venues in your collection yet.</p>
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
												event.currentTarget.src = FALLBACK_VENUE_IMAGE;
											}}
										/>
										<div className="venue-favorite-item-body">
											<strong>{item.name || 'Untitled venue'}</strong>
											<p>{item.description || 'No description yet.'}</p>
											<div className="venue-favorite-item-actions">
												<button
													type="button"
													onClick={() => {
														setShowFavoritesModal(false);
														navigate(`/venues/${item.itemId}`);
													}}
												>
													View venue
												</button>
												<button type="button" onClick={() => handleRemoveFavoriteItem(item)}>Remove favorite</button>
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

