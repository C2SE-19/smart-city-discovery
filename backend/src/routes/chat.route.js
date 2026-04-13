const express = require('express');
const OpenAI = require('openai');
const { pool } = require('../config/database');

const router = express.Router();

const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const CORPUS_LIMIT = Number(process.env.CHAT_VENUE_CORPUS_LIMIT || 500);
const PREFILTER_LIMIT = 80;
const RESULT_LIMIT = 5;

const FOOD_TERMS = [
  'am thuc', 'food', 'restaurant', 'quan an', 'nha hang', 'cafe', 'ca phe', 'coffee',
  'pho', 'bun', 'com', 'lau', 'nuong', 'hai san', 'tra sua', 'do uong', 'mi quang', 'cao lau'
];

const ENTERTAINMENT_TERMS = [
  'entertainment', 'giai tri', 'karaoke', 'bar', 'club', 'cong vien', 'water park', 'vinwonders',
  'game', 'khu vui choi', 'tham quan', 'du lich'
];

const INDOOR_TERMS = ['trong nha', 'indoor', 'may lanh', 'dieu hoa', 'inside', 'mall', 'trung tam thuong mai'];
const OUTDOOR_TERMS = ['ngoai troi', 'outdoor', 'san vuon', 'view bien', 'ban cong', 'ven song', 'terrace'];

function normalizeText(text) {
  return String(text || '').trim().toLowerCase();
}

function normalizeNoAccent(text) {
  return normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function safeJsonParse(raw, fallback = null) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function shortenReply(text, maxWords = 55) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return '';
  }

  if (words.length <= maxWords) {
    return words.join(' ');
  }

  return `${words.slice(0, maxWords).join(' ')}...`;
}

function flattenToTokens(value, bucket = []) {
  if (value == null) {
    return bucket;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => flattenToTokens(item, bucket));
    return bucket;
  }

  if (typeof value === 'object') {
    Object.values(value).forEach((item) => flattenToTokens(item, bucket));
    return bucket;
  }

  const token = String(value).trim();
  if (token) {
    bucket.push(token);
  }

  return bucket;
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function extractTermsFallback(message) {
  const text = normalizeNoAccent(message);
  const tokens = text
    .split(/[^a-z0-9]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);

  const stop = new Set([
    'toi', 'minh', 'ban', 'cho', 'nha', 'quan', 'dia', 'diem', 'nao', 'khong', 'voi', 'mot',
    'hom', 'nay', 'can', 'muon', 'tim', 'goi', 'y', 'giup', 'duoc', 'khong', 'co', 've'
  ]);

  return unique(tokens.filter((token) => !stop.has(token))).slice(0, 10);
}

function buildHeuristicIntent(message) {
  const text = normalizeNoAccent(message);
  const looksFood = includesAny(text, FOOD_TERMS);
  const looksEntertainment = includesAny(text, ENTERTAINMENT_TERMS);
  const wantsRecommend = includesAny(text, ['goi y', 'de xuat', 'tim', 'cho nao', 'quan nao']) || looksFood || looksEntertainment;

  return {
    mode: wantsRecommend ? 'recommend' : 'chat',
    domain: looksFood ? 'food' : looksEntertainment ? 'entertainment' : 'general',
    userGoal: message,
    terms: extractTermsFallback(message),
    excludeTerms: [],
    constraints: {
      indoor: includesAny(text, INDOOR_TERMS),
      outdoor: includesAny(text, OUTDOOR_TERMS),
      openNow: includesAny(text, ['dang mo', 'mo cua', 'bay gio']),
      budget: 'any',
    },
    needsClarification: false,
    clarifyQuestion: '',
  };
}

async function extractIntent(client, message) {
  const heuristic = buildHeuristicIntent(message);

  if (!client) {
    return heuristic;
  }

  const systemPrompt = [
    'Ban la bo phan hieu y dinh cho chat app goi y dia diem.',
    'Tra ve JSON object hop le, khong viet them text.',
    'Schema:',
    '{"mode":"chat|recommend","domain":"food|entertainment|general","userGoal":string,"terms":string[],"excludeTerms":string[],"constraints":{"indoor":boolean,"outdoor":boolean,"openNow":boolean,"budget":"low|medium|high|any"},"needsClarification":boolean,"clarifyQuestion":string}',
    'Neu user hoi mon an/cafe/do uong => domain=food.',
    'Neu user hoi vui choi/tham quan => domain=entertainment.',
    'Chi de mode=chat khi user that su dang hoi thong tin chung, khong can goi y dia diem.',
  ].join(' ');

  try {
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.1,
      max_tokens: 260,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });

    const parsed = safeJsonParse(response?.choices?.[0]?.message?.content || '{}', {});

    const parsedMode = parsed?.mode === 'chat' ? 'chat' : parsed?.mode === 'recommend' ? 'recommend' : heuristic.mode;
    const parsedDomain = ['food', 'entertainment', 'general'].includes(parsed?.domain) ? parsed.domain : heuristic.domain;

    const text = normalizeNoAccent(message);
    const forceFood = includesAny(text, FOOD_TERMS);
    const forceEntertainment = !forceFood && includesAny(text, ENTERTAINMENT_TERMS);

    return {
      mode: forceFood || forceEntertainment ? 'recommend' : parsedMode,
      domain: forceFood ? 'food' : forceEntertainment ? 'entertainment' : parsedDomain,
      userGoal: String(parsed?.userGoal || heuristic.userGoal || message),
      terms: unique([...(parsed?.terms || []).map((x) => normalizeNoAccent(x)), ...heuristic.terms]).slice(0, 12),
      excludeTerms: unique((parsed?.excludeTerms || []).map((x) => normalizeNoAccent(x))).slice(0, 8),
      constraints: {
        indoor: Boolean(parsed?.constraints?.indoor ?? heuristic.constraints.indoor),
        outdoor: Boolean(parsed?.constraints?.outdoor ?? heuristic.constraints.outdoor),
        openNow: Boolean(parsed?.constraints?.openNow ?? heuristic.constraints.openNow),
        budget: ['low', 'medium', 'high', 'any'].includes(parsed?.constraints?.budget) ? parsed.constraints.budget : 'any',
      },
      needsClarification: Boolean(parsed?.needsClarification),
      clarifyQuestion: String(parsed?.clarifyQuestion || '').trim(),
    };
  } catch (error) {
    console.warn('Intent fallback:', error?.message || error);
    return heuristic;
  }
}

function mapVenueRow(row) {
  const metadata = typeof row.metadata === 'object' && row.metadata !== null
    ? row.metadata
    : safeJsonParse(row.metadata, {});

  const extra = flattenToTokens(metadata).slice(0, 160).join(' ');
  const searchableText = normalizeNoAccent([
    row.name,
    row.title,
    row.category_name,
    row.ward_name,
    row.address,
    row.description,
    row.service_names,
    row.category_hint,
    extra,
  ].join(' '));

  const category = normalizeNoAccent(row.category_name || '');

  return {
    id: row.id,
    name: row.name || row.title || 'Khong ro ten',
    categoryName: row.category_name || 'Khac',
    wardName: row.ward_name || '',
    address: row.address || '',
    description: row.description || '',
    coverImageUrl: row.cover_image_url || '',
    averageRating: Number(row.average_rating || 0),
    totalReviews: Number(row.total_reviews || 0),
    searchableText,
    category,
  };
}

async function queryVenueCorpus(limit = CORPUS_LIMIT) {
  const query = `
    SELECT
      venues.id,
      COALESCE(NULLIF(venues.name, ''), venues.title) AS name,
      venues.title,
      venues.address,
      venues.description,
      wards.name AS ward_name,
      place_categories.name AS category_name,
      venues.cover_image_url,
      venues.average_rating,
      venues.total_reviews,
      venues.metadata,
      (
        SELECT string_agg(value, ' ')
        FROM jsonb_array_elements_text(COALESCE(venues.metadata->'selectedServiceNames', '[]'::jsonb)) AS service_name(value)
      ) AS service_names,
      (
        SELECT string_agg(value, ' ')
        FROM jsonb_array_elements_text(COALESCE(venues.metadata->'selectedCategoryNames', '[]'::jsonb)) AS category_hint(value)
      ) AS category_hint
    FROM venues
    LEFT JOIN wards ON wards.ward_id = venues.ward_id
    LEFT JOIN place_categories ON place_categories.id = venues.category_id
    WHERE venues.status = 'approved'
    ORDER BY venues.average_rating DESC NULLS LAST, venues.total_reviews DESC NULLS LAST
    LIMIT $1;
  `;

  const result = await pool.query(query, [limit]);
  return result.rows.map(mapVenueRow);
}

function isFoodVenue(venue) {
  if (includesAny(venue.category, ENTERTAINMENT_TERMS)) {
    return false;
  }

  return includesAny(venue.category, FOOD_TERMS) || includesAny(venue.searchableText, FOOD_TERMS);
}

function isEntertainmentVenue(venue) {
  if (includesAny(venue.category, FOOD_TERMS)) {
    return false;
  }

  return includesAny(venue.category, ENTERTAINMENT_TERMS) || includesAny(venue.searchableText, ENTERTAINMENT_TERMS);
}

function isIndoorVenue(venue) {
  return includesAny(venue.searchableText, INDOOR_TERMS);
}

function isOutdoorVenue(venue) {
  return includesAny(venue.searchableText, OUTDOOR_TERMS);
}

function prefilterByIntent(corpus, intent) {
  let pool = [...corpus];

  if (intent.domain === 'food') {
    const food = pool.filter(isFoodVenue);
    if (food.length) {
      pool = food;
    }
  }

  if (intent.domain === 'entertainment') {
    const places = pool.filter(isEntertainmentVenue);
    if (places.length) {
      pool = places;
    }
  }

  if (intent.constraints.indoor) {
    const indoor = pool.filter(isIndoorVenue);
    if (!indoor.length) {
      return [];
    }
    pool = indoor;
  }

  if (intent.constraints.outdoor) {
    const outdoor = pool.filter(isOutdoorVenue);
    if (!outdoor.length) {
      return [];
    }
    pool = outdoor;
  }

  return pool;
}

function lexicalScore(venue, intent, message) {
  const text = venue.searchableText;
  let score = 0;

  intent.terms.forEach((term) => {
    if (text.includes(term)) score += 8;
  });

  intent.excludeTerms.forEach((term) => {
    if (text.includes(term)) score -= 10;
  });

  const msgTerms = extractTermsFallback(message);
  msgTerms.forEach((term) => {
    if (text.includes(term)) score += 3;
  });

  if (intent.domain === 'food' && isFoodVenue(venue)) score += 8;
  if (intent.domain === 'entertainment' && isEntertainmentVenue(venue)) score += 8;

  if (intent.constraints.indoor && isIndoorVenue(venue)) score += 6;
  if (intent.constraints.outdoor && isOutdoorVenue(venue)) score += 6;

  score += Math.min(5, venue.averageRating) * 1.4;
  score += Math.log10(venue.totalReviews + 1) * 1.4;

  return score;
}

function preRankCandidates(candidates, intent, message, limit = PREFILTER_LIMIT) {
  return [...candidates]
    .map((venue) => ({ ...venue, _lexical: lexicalScore(venue, intent, message) }))
    .sort((a, b) => b._lexical - a._lexical)
    .slice(0, limit);
}

async function llmRerank(client, intent, message, candidates) {
  if (!candidates.length) {
    return [];
  }

  if (!client) {
    return candidates.slice(0, RESULT_LIMIT);
  }

  const compact = candidates.map((venue) => ({
    id: venue.id,
    name: venue.name,
    category: venue.categoryName,
    address: venue.address,
    ward: venue.wardName,
    desc: String(venue.description || '').slice(0, 140),
    tags: [
      isFoodVenue(venue) ? 'food' : null,
      isEntertainmentVenue(venue) ? 'entertainment' : null,
      isIndoorVenue(venue) ? 'indoor' : null,
      isOutdoorVenue(venue) ? 'outdoor' : null,
    ].filter(Boolean),
  }));

  const systemPrompt = [
    'Ban la bo phan xep hang dia diem theo y dinh nguoi dung.',
    'Chi duoc xep hang trong danh sach ung vien duoc cung cap, khong tao dia diem moi.',
    'Tra ve JSON: {"selectedIds": number[], "confidence": number}.',
    `selectedIds toi da ${RESULT_LIMIT} phan tu. confidence 0..1.`,
    'Uu tien dung domain va constraints indoor/outdoor. Sai constraints thi khong chon.',
  ].join(' ');

  try {
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.1,
      max_tokens: 220,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: JSON.stringify({
            intent,
            userMessage: message,
            candidates: compact,
          }),
        },
      ],
    });

    const parsed = safeJsonParse(response?.choices?.[0]?.message?.content || '{}', {});
    const idSet = new Set(candidates.map((venue) => Number(venue.id)));
    const selectedIds = unique((parsed?.selectedIds || []).map((x) => Number(x))).filter((id) => idSet.has(id)).slice(0, RESULT_LIMIT);

    if (!selectedIds.length) {
      return candidates.slice(0, RESULT_LIMIT);
    }

    const byId = new Map(candidates.map((venue) => [Number(venue.id), venue]));
    return selectedIds.map((id) => byId.get(id)).filter(Boolean);
  } catch (error) {
    console.warn('LLM rerank fallback:', error?.message || error);
    return candidates.slice(0, RESULT_LIMIT);
  }
}

function validateFinalVenues(venues, intent) {
  return venues.filter((venue) => {
    if (intent.domain === 'food' && !isFoodVenue(venue)) {
      return false;
    }

    if (intent.domain === 'entertainment' && !isEntertainmentVenue(venue)) {
      return false;
    }

    if (intent.constraints.indoor && !isIndoorVenue(venue)) {
      return false;
    }

    if (intent.constraints.outdoor && !isOutdoorVenue(venue)) {
      return false;
    }

    return true;
  });
}

function fallbackReply(intent, reason = '') {
  if (intent.needsClarification && intent.clarifyQuestion) {
    return intent.clarifyQuestion;
  }

  if (reason === 'no_indoor') {
    return 'Mình chưa thấy địa điểm trong nhà rõ dữ liệu. Bạn thêm khu vực hoặc tầm giá giúp mình nhé.';
  }

  if (reason === 'no_outdoor') {
    return 'Mình chưa thấy địa điểm ngoài trời rõ dữ liệu. Bạn thêm khu vực mong muốn nhé.';
  }

  if (reason === 'low_confidence') {
    return 'Mình chưa đủ chắc để gợi ý chính xác. Bạn cho thêm 1-2 tiêu chí như khu vực hoặc ngân sách nhé.';
  }

  return 'Mình chưa đủ dữ liệu để chốt chắc. Bạn nói thêm 1-2 tiêu chí nha, mình lọc kỹ hơn liền.';
}

function buildGroundedRecommendReply(intent, venues) {
  if (!venues.length) {
    return fallbackReply(intent, 'low_confidence');
  }

  if (intent.constraints.indoor) {
    return 'Ok nè, mình lọc theo tiêu chí trong nhà rồi. Bạn xem list bên dưới, thích chỗ nào mình phân tích tiếp cho.';
  }

  if (intent.constraints.outdoor) {
    return 'Ok nè, mình lọc các chỗ ngoài trời cho bạn rồi. Bạn xem list bên dưới, cần mình lọc thêm theo khu vực thì nói mình.';
  }

  return 'Mình lọc sẵn vài lựa chọn hợp ý bạn rồi nè. Xem list bên dưới, muốn mình thu hẹp thêm thì nhắn tiếp nhé.';
}

async function generateChatReply(client, message, intent) {
  if (!client) {
    return 'Mình nghe đây. Bạn nói rõ thêm chút về điều bạn cần, mình hỗ trợ ngay.';
  }

  const systemPrompt = [
    'Ban la tro ly chat cua Smart City Discovery, phong cach noi chuyen tu nhien nhu 2 nguoi dang nhan tin.',
    'Tra loi ngan gon 1-3 cau, toi da 55 tu.',
    'Khong van mau, khong tao thong tin dia diem cu the ngoai data cung cap.',
    'Neu cau hoi mo ho, hoi lai 1 cau ngan de lam ro.',
  ].join(' ');

  try {
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.6,
      max_tokens: 130,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ message, intent }) },
      ],
    });

    return shortenReply(response?.choices?.[0]?.message?.content?.trim() || '', 55) || 'Mình nghe đây, bạn nói thêm chút để mình hiểu đúng ý nhé.';
  } catch (error) {
    console.warn('Chat generation fallback:', error?.message || error);
    return 'Mình hiểu ý của bạn rồi. Bạn nói thêm chút tiêu chí để mình trả lời sát hơn nha.';
  }
}

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const client = getOpenAIClient();
    const intent = await extractIntent(client, message);

    let venueResults = [];
    let reply = '';

    if (intent.mode === 'recommend') {
      const corpus = await queryVenueCorpus(CORPUS_LIMIT);
      const filtered = prefilterByIntent(corpus, intent);

      if (!filtered.length) {
        const reason = intent.constraints.indoor ? 'no_indoor' : intent.constraints.outdoor ? 'no_outdoor' : 'low_confidence';
        reply = fallbackReply(intent, reason);
        return res.json({ reply, venueResults: [] });
      }

      const preRanked = preRankCandidates(filtered, intent, message, PREFILTER_LIMIT);
      const llmSelected = await llmRerank(client, intent, message, preRanked);
      const validated = validateFinalVenues(llmSelected, intent);
      venueResults = validated.slice(0, RESULT_LIMIT).map(({ searchableText, category, _lexical, ...venue }) => venue);

      if (!venueResults.length) {
        reply = fallbackReply(intent, 'low_confidence');
      } else {
        reply = buildGroundedRecommendReply(intent, venueResults);
      }
    } else {
      reply = await generateChatReply(client, message, intent);
    }

    return res.json({ reply: shortenReply(reply, 55), venueResults });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;
