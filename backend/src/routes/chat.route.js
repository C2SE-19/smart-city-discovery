const express = require('express');
const OpenAI = require('openai');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();

const fs = require('fs');
const path = require('path');
const SYSTEM_FEATURES_PATH = path.resolve(__dirname, '..', '..', 'system_features.json');
let SYSTEM_FEATURES_CACHE = null;

function loadSystemFeatures() {
  if (SYSTEM_FEATURES_CACHE) return SYSTEM_FEATURES_CACHE;
  try {
    const raw = fs.readFileSync(SYSTEM_FEATURES_PATH, 'utf8');
    SYSTEM_FEATURES_CACHE = JSON.parse(raw);
    return SYSTEM_FEATURES_CACHE;
  } catch (e) {
    console.error('Failed to load system_features.json:', e && e.stack ? e.stack : e);
    SYSTEM_FEATURES_CACHE = [];
    return [];
  }
}

function isAssistantQuestionMessage(message) {
  const norm = normalizeText(message || '');
  if (!norm) return false;

  // Treat explicit question punctuation as assistant intent
  if (String(message || '').trim().endsWith('?')) return true;

  const indicators = [
    'lam sao','lam the nao','cach','huong dan','how to','what is','what are','where','o dau','la gi','giai thich','chinh sach','policy','làm sao','là gì','thế nào','the nao'
  ];

  for (const ind of indicators) {
    if (!ind) continue;
    if (containsTerm(norm, ind) || norm.includes(ind)) return true;
  }

  return false;
}

function findBestFeatureGuide(message) {
  const features = Array.isArray(loadSystemFeatures()) ? loadSystemFeatures() : [];
  if (!features.length) return null;
  const norm = normalizeText(message || '');
  if (!norm) return null;

  const msgTokens = norm.split(/\s+/).filter(Boolean);
  if (!msgTokens.length) return null;

  const WEIGHTS = {
    exactPhrase: 10,
    multiPhrase: 8,
    fullKeyword: 6,
    tokenOverlap: 1,
    partialOverlap: 0.5,
    negativeMismatch: 3,
    intentBoost: 5
  };

  // Intent-category boosting rules (normalized phrases)
  const BOOST_RULES = [
    { phrases: ['merchant','merchant dashboard','merchant workbench','dang bai','gui dia diem','post venue'], category: 'merchant' },
    { phrases: ['ban do','map','kham pha','kham pha'], category: 'map' },
    { phrases: ['danh gia','đánh giá','review','binh luan'], category: 'reviews' },
    { phrases: ['thanh toan','thanh toán','payment','payos','checkout'], category: 'payments' },
    { phrases: ['upload','them anh','thêm ảnh','upload anh','upload image'], category: 'uploads' },
    { phrases: ['anh','hinh','hinh anh','tim bang anh','tim anh','image','tìm bằng ảnh'], category: 'vision' },
    { phrases: ['bao cao','báo cáo','report'], category: 'reporting' },
    { phrases: ['quang cao','quảng cáo','ads','ad','advert'], category: 'ads' },
    { phrases: ['nhan tin','nhắn tin','chat voi chu quan','chat voi quan','chat quán'], category: 'chat' }
  ];

  const boostedCategories = new Set();
  for (const rule of BOOST_RULES) {
    for (const p of rule.phrases) {
      if (!p) continue;
      const np = normalizeText(p);
      if (!np) continue;
      if (containsTerm(norm, np) || norm.includes(np)) {
        boostedCategories.add(rule.category);
        break;
      }
    }
  }

  let best = null;
  let bestScore = -Infinity;

  for (const f of features) {
    if (!f) continue;

    const keys = Array.isArray(f.keywords) ? f.keywords.slice() : [];
    if (f.feature) keys.push(f.feature);

    let featureBestKeyScore = -Infinity;

    for (const rawKey of keys) {
      if (!rawKey) continue;
      const nk = normalizeText(String(rawKey));
      if (!nk) continue;

      const keyTokens = nk.split(/\s+/).filter(Boolean);
      if (!keyTokens.length) continue;

      // Base phrase/exact/full-key scoring
      let base = 0;
      if (nk === norm) {
        base += WEIGHTS.exactPhrase;
      } else if (nk.includes(norm) || norm.includes(nk)) {
        base += WEIGHTS.multiPhrase;
      } else if (keyTokens.every((t) => msgTokens.includes(t))) {
        base += WEIGHTS.fullKeyword;
      }

      // Token-level scoring and negative mismatches
      let exactMatches = 0;
      let partialMatches = 0;
      let unmatched = 0;

      for (const kt of keyTokens) {
        if (!kt) continue;
        let matched = false;
        // exact token match
        for (const mt of msgTokens) {
          if (kt === mt) { exactMatches++; matched = true; break; }
        }
        if (matched) continue;

        // partial fuzzy
        for (const mt of msgTokens) {
          if (!mt) continue;
          if (kt.includes(mt) || mt.includes(kt)) { partialMatches++; matched = true; break; }
        }
        if (!matched) unmatched++;
      }

      const keyScore = base + (exactMatches * WEIGHTS.tokenOverlap) + (partialMatches * WEIGHTS.partialOverlap) - (unmatched * WEIGHTS.negativeMismatch);

      if (keyScore > featureBestKeyScore) featureBestKeyScore = keyScore;
    }

    if (featureBestKeyScore === -Infinity) continue;

    // category boost
    let featureScore = featureBestKeyScore;
    try {
      if (f.category && boostedCategories.has(String(f.category).toLowerCase())) featureScore += WEIGHTS.intentBoost;
    } catch (e) {
      // ignore
    }

    if (featureScore > bestScore) {
      bestScore = featureScore;
      best = f;
    }
  }

  const MIN_SCORE_THRESHOLD = 4; // conservative: avoid noisy matches
  if (bestScore >= MIN_SCORE_THRESHOLD) return best;
  return null;
}

function hasExactFeatureKeywordMatch(message, feature) {
  if (!feature) return false;

  const normalizedMessage = normalizeText(message || '');
  if (!normalizedMessage) return false;

  const candidates = [
    ...(Array.isArray(feature.keywords) ? feature.keywords : []),
    feature.feature
  ];

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeText(String(candidate || ''));
    return normalizedCandidate && normalizedCandidate === normalizedMessage;
  });
}

function shouldReplyWithFeatureGuide(message, matchedFeature, allowSuggest) {
  if (!matchedFeature || !matchedFeature.guide) return false;

  const normalizedMessage = normalizeText(message || '');
  if (!normalizedMessage) return false;

  if (isAssistantQuestionMessage(message)) {
    return true;
  }

  const looksLikeSuggestionQuery = [
    'tim quan',
    'tim dia diem',
    'an gi',
    'an o dau',
    'o dau',
    'gan toi',
    'gan day',
    'goi y',
    'de xuat',
    'recommend',
    'suggest'
  ].some((term) => containsTerm(normalizedMessage, term));

  if (looksLikeSuggestionQuery) {
    return false;
  }

  if (hasExactFeatureKeywordMatch(normalizedMessage, matchedFeature)) {
    return true;
  }

  const tokenCount = normalizedMessage.split(/\s+/).filter(Boolean).length;
  if (!allowSuggest && tokenCount <= 4) {
    return true;
  }

  return false;
}

function looksLikeSystemAssistantRequest(message = '') {
  const normalizedMessage = normalizeText(message || '');
  if (!normalizedMessage) return false;

  const systemSignals = [
    'merchant',
    'dashboard',
    'map',
    'ban do',
    'upload',
    'tai anh',
    'up anh',
    'favorite',
    'yeu thich',
    'save',
    'review',
    'danh gia',
    'notification',
    'thong bao',
    'avatar',
    'profile',
    'tai khoan',
    'permission',
    'role',
    'payment',
    'thanh toan',
    'report',
    'bao cao',
    'forum',
    'feedback',
    'dang bai',
    'dang dia diem',
    'gui duyet',
    'duyet bai',
    'ai chatbot',
    'chatbot',
    'tro ly'
  ];

  return systemSignals.some((signal) => containsTerm(normalizedMessage, signal));
}

function detectCasualIntent(message = '') {
  const normalizedMessage = normalizeText(message || '');
  if (!normalizedMessage) return null;

  const greetingTerms = ['hi', 'hello', 'hey', 'chao', 'xin chao'];
  const thanksTerms = ['cam on', 'thanks', 'thank you', 'tks'];
  const byeTerms = ['bye', 'tam biet', 'bai bai', 'goodbye'];
  const lightTerms = ['hehe', 'hihi', 'haha', 'ok', 'oke', 'okela'];

  if (greetingTerms.some((term) => containsTerm(normalizedMessage, term) || normalizedMessage === term)) {
    return 'greeting';
  }
  if (thanksTerms.some((term) => containsTerm(normalizedMessage, term) || normalizedMessage === term)) {
    return 'thanks';
  }
  if (byeTerms.some((term) => containsTerm(normalizedMessage, term) || normalizedMessage === term)) {
    return 'bye';
  }
  if (lightTerms.some((term) => containsTerm(normalizedMessage, term) || normalizedMessage === term)) {
    return 'light';
  }

  return null;
}

function buildCasualReply(message = '') {
  const intent = detectCasualIntent(message);

  switch (intent) {
    case 'greeting':
      return 'Chào bạn, mình có thể hỗ trợ tìm địa điểm hoặc giải thích tính năng hệ thống.';
    case 'thanks':
      return 'Không có gì, cần gì cứ hỏi tiếp.';
    case 'bye':
      return 'Ok, khi nào cần thì nhắn mình tiếp.';
    case 'light':
      return 'Mình đây, bạn cứ hỏi tiếp.';
    default:
      return 'Mình đang nghe đây.';
  }
}

const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const RESULT_LIMIT = 5;
const CHAT_SUGGESTION_LIMIT = 2;
// Common stop words (English + Vietnamese) used to filter weak tokens from user queries
const STOP_WORDS = new Set([
  'the','a','an','and','or','of','in','on','at','for','to','by','with','from','about','as','is','are','it','this','that','these','those',
  'i','you','he','she','they','we','me','my','your','our','their','his','her',
  'là','la','có','co','không','khong','và','va','với','voi','cho','của','cua','ở','o','tại','tai','từ','tu','đến','den','vào','vao',
  'trong','ngoài','ngoai','trên','tren','dưới','duoi','một','mot','hai','ba','nhiều','nhieu','nhỏ','nho','lắm','lam','vậy','vay','như','nhu',
  'đó','do','đây','day','ấy','ay','đã','da','đang','dang','sẽ','se','rồi','roi','nhé','nhe','xin','please','pls','giúp','giup'
]);
const FALLBACK_JWT_SECRET = 'smart-city-discovery-dev-secret-change-me';
const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || FALLBACK_JWT_SECRET;
const CATEGORY_MAP = {
  food: {
    keywords: [
      'ăn', 'an', 'ăn gì', 'an gi', 'ăn j', 'an j', 'anj', 'ăn thử', 'ăn đi', 'đi ăn', 'đói', 'doi', 'thèm', 'them',
      'quán ăn', 'quan an', 'nhà hàng', 'nha hang', 'ăn uống', 'an uong', 'đồ ăn', 'do an', 'ăn vặt', 'an vat', 'ăn ngon', 'an ngon',
      'giá rẻ', 'gia re', 'ăn rẻ', 'an re', 'ăn no', 'an no', 'ăn sập', 'an sap', 'buffet', 'hải sản', 'hai san', 'lẩu', 'lau',
      'phở', 'pho', 'bún', 'bun', 'hủ tiếu', 'hu tieu', 'mì', 'mi', 'noodles', 'pizza', 'burger', 'sushi', 'street food', 'food'
    ],
    categoryPatterns: [
      '%restaurant%', '%food%', '%street-food%', '%am thuc%', '%ẩm thực%', '%an uong%', '%cuisine%', '%eatery%', '%food-court%'
    ],
    keywordPatterns: [
      '%phở%', '%pho%', '%bún%', '%bun%', '%cơm%', '%com%', '%lẩu%', '%lau%', '%hải sản%', '%hai san%', '%nhà hàng%', '%nha hang%',
      '%ăn vặt%', '%an vat%', '%street food%', '%food stall%', '%buffet%', '%pizza%', '%burger%', '%sushi%', '%noodles%'
    ]
  },

  cafe: {
    keywords: [
      'cafe', 'cf', 'caphe', 'cà phê', 'ca phe', 'coffee', 'coffe', 'café', 'quán cafe', 'quan cafe', 'quán cf', 'quan cf',
      'ngồi cafe', 'ngoi cafe', 'trà sữa', 'tra sua', 'milk tea', 'bubble tea', 'boba', 'trà', 'tea', 'chill', 'chillax', 'cf chill',
      'espresso', 'latte', 'cappuccino', 'cold brew', 'iced coffee', 'takeaway', 'to go', 'cozy cafe', 'quán nước', 'quan nuoc',
      'trà đá', 'tra da', 'sinh tố', 'sinh to', 'smoothie', 'nước mát', 'nuoc mat', 'máy lạnh', 'may lanh', 'aircon', 'quán có máy lạnh', 'quan co may lanh'
    ],
    categoryPatterns: ['%cafe%', '%coffee%', '%milk-tea%', '%tea%', '%bubble%'],
    keywordPatterns: [
      '%cà phê%', '%ca phe%', '%coffee%', '%trà sữa%', '%tra sua%', '%milk tea%', '%boba%', '%bubble tea%', '%iced coffee%', '%espresso%', '%trà đá%', '%tra da%', '%sinh tố%', '%sinh to%', '%smoothie%', '%máy lạnh%'
    ]
  },

  accommodation: {
    keywords: [
      'khách sạn', 'khach san', 'ks', 'hotel', 'resort', 'homestay', 'hostel', 'nhà nghỉ', 'nha nghi', 'motel', 'villa', 'biệt thự',
      'ở đâu', 'o dau', 'ở qua đêm', 'o qua dem', 'ngủ lại', 'ngu lai', 'thuê phòng', 'thue phong', 'đặt phòng', 'dat phong', 'booking', 'book', 'checkin', 'check-in',
      'phòng', 'phong', 'bnb', 'guesthouse', 'apartment', 'studio', 'airbnb'
    ],
    categoryPatterns: ['%hotel%', '%resort%', '%homestay%', '%accommodation%', '%lodging%', '%guesthouse%'],
    keywordPatterns: [
      '%khách sạn%', '%khach san%', '%homestay%', '%hostel%', '%hotel%', '%resort%', '%nhà nghỉ%', '%nha nghi%', '%phòng%', '%phong%'
    ]
  },

  dessert: {
    keywords: [
      'tráng miệng', 'trang mieng', 'dessert', 'kem', 'ice cream', 'gelato', 'chè', 'che', 'bánh ngọt', 'banh ngot', 'flan', 'pudding', 'sữa chua', 'sua chua',
      'trà đá', 'tra da', 'sinh tố', 'sinh to', 'smoothie', 'juice', 'bingsu', 'slush', 'slushie', 'giải nhiệt', 'giai nhiet', 'giải khát', 'giai khat', 'nước mát', 'nuoc mat'
    ],
    categoryPatterns: ['%dessert%', '%bakery%', '%sweet%', '%ice-cream%', '%ice cream%'],
    keywordPatterns: ['%dessert%', '%tráng miệng%', '%kem%', '%ice cream%', '%gelato%', '%chè%', '%che%', '%bánh ngọt%', '%banh ngot%', '%trà đá%', '%tra da%', '%sinh tố%', '%sinh to%', '%smoothie%']
  },

  entertainment: {
    keywords: [
      'giải trí', 'giai tri', 'đi chơi', 'di choi', 'vui chơi', 'vui', 'hang out', 'hangout', 'tụ tập', 'tu tap', 'quẩy', 'quay', 'party',
      'live music', 'concert', 'show', 'sự kiện', 'su kien', 'event', 'nightlife', 'đi bar', 'di bar', 'bar', 'club', 'pub', 'nhậu', 'quan nhau', 'karaoke',
      'khu vui chơi', 'khu giai tri', 'khu giải trí', 'khu tre em', 'outdoor event', 'festival', 'lễ hội'
    ],
    categoryPatterns: ['%entertainment%', '%giai tri%', '%bar%', '%club%', '%pub%', '%karaoke%', '%nightlife%'],
    keywordPatterns: ['%karaoke%', '%bar%', '%club%', '%khu vui chơi%', '%khu giai tri%', '%event%', '%concert%', '%festival%']
  },

  cinema: {
    keywords: [
      'rạp phim', 'rap phim', 'rap', 'xem phim', 'coi phim', 'movie', 'film', 'cinema', 'phim rạp', 'suất chiếu', 'suất chieu', 'showtime'
    ],
    categoryPatterns: ['%cinema%', '%movie%', '%film%', '%rạp phim%'],
    keywordPatterns: ['%rạp phim%', '%phim rạp%', '%xem phim%', '%suất chiếu%', '%showtime%']
  },

  market: {
    keywords: [
      'mua sắm', 'mua sam', 'shopping', 'shop', 'cửa hàng', 'cua hang', 'mall', 'trung tâm thương mại', 'TTTM', 'chợ', 'cho', 'market', 'night market', 'bazaar', 'boutique', 'store',
      'thời trang', 'thoi trang', 'giày', 'giay', 'phụ kiện', 'phu kien', 'electronics', 'siêu thị', 'sieuthi', 'supermarket', 'convenience store', 'sale', 'giảm giá'
    ],
    categoryPatterns: ['%market%', '%shopping%', '%mall%', '%boutique%', '%retail%'],
    keywordPatterns: ['%chợ%', '%cho%', '%siêu thị%', '%sieuthi%', '%mall%', '%shop%', '%store%', '%giam gia%', '%sale%']
  },

  travel: {
    keywords: [
      'du lịch', 'du lich', 'dulich', 'phượt', 'phuot', 'tour', 'tham quan', 'tham quan', 'checkin', 'check-in', 'check in', 'sống ảo', 'song ao',
      'travel', 'trip', 'vacation', 'holiday', 'tourist', 'photo spot', 'scenic spot', 'view đẹp', 'view dep'
    ],
    categoryPatterns: ['%tourist%', '%travel%', '%scenic%', '%attraction%'],
    keywordPatterns: ['%du lịch%', '%du lich%', '%tham quan%', '%phượt%', '%phuot%', '%tour%']
  },

  sports: {
    keywords: ['the thao', 'sport', 'gym', 'pickleball', 'bong da', 'san bong', 'football', 'soccer', 'futsal', 'san bong da'],
    categoryPatterns: ['%sport%', '%fitness%', '%football%', '%soccer%', '%futsal%', '%pickleball%', '%stadium%', '%arena%'],
    keywordPatterns: ['%gym%', '%pickleball%', '%bóng đá%', '%bong da%', '%sân bóng%', '%san bong%', '%football%', '%soccer%', '%futsal%']
  },

  general: {
    keywords: [],
    categoryPatterns: [],
    keywordPatterns: []
  }
};

const SYNONYM_GROUPS = [
  /* =========================
  🍜 DINING / FOOD
  ========================= */
  {
    name: 'dining_food',
    triggers: [
      "ăn","an","ăn gì","an gi","ăn j","an j","anj","ănj","ăn j m","ăn thử","an thu","ăn đi","an di","ăn đi nha","ăn đi đi",
      "đói","doi","đói quá","doi qua","doi vl","doi vcl","đói vl","thèm","them","thèm quá","kiếm đồ ăn","kiem do an","tìm đồ ăn","tim do an",
      "tìm quán ăn","tim quan an","quán ăn","quan an","quanan","quán ăn ngon","quan an ngon","nhà hàng","nha hang","ăn uống","an uong","food","restaurant",
      "eat","ăn no","an no","ăn sáng","an sang","ăn trưa","an trua","ăn tối","an toi","ăn khuya","an khuya","ăn vặt","an vat","snack","ăn rẻ","an re",
      "giá rẻ","gia re","ăn ngon","an ngon","ăn sập","an sap","ăn cho đã","an cho da","ăn cho no","an cho no","ăn tẹt ga","an tet ga","ăn nhẹ","an nhe",
      "đồ ăn","do an","ăn ở đâu","an o dau","ăn ở đâu ngon","an o dau ngon"
    ],
    expansions: [
      "restaurant","food","dining","ăn uống","quán ăn","nhà hàng","street food","ăn vặt","snack","cơm","phở","pho","bún","bun","hủ tiếu","hu tieu",
      "mì","mi","noodles","pizza","burger","sushi","seafood","hải sản","hai san","lẩu","lau","hotpot","buffet","eatery","canteen","fast food",
      "local food","street vendor","comfort food","cheap eats","fine dining","gourmet","food court","food stall","vendor","grill","barbecue"
    ]
  },

  /* =========================
  ☕ CAFE / DRINKS
  ========================= */
  {
    name: 'cafe_drinks',
    triggers: [
      "cafe","cf","caphe","cà phê","ca phe","coffee","coffe","café","quán cafe","quan cafe","quán cf","quan cf","quancf","uống cafe","uong cafe",
      "uống cf","uong cf","ngồi cafe","ngoi cafe","ngồi cf","ngoi cf","chill","chillax","chill xíu","chill xiu","cf chill","coffee shop","espresso","latte",
      "cappuccino","cold brew","iced coffee","iced","iced latte","trà sữa","tra sua","ts","milk tea","bubble tea","boba","trà","tea","juice","sinh tố","sinh to","smoothie",
      "takeaway","take away","take-away","to go","cozy cafe","cafe đẹp","cf đẹp","cf xịn","view đẹp","view dep","quán nước","quan nuoc"
    ],
    expansions: [
      "cafe","coffee","ca phe","coffee shop","quán cafe","quán cà phê","espresso","latte","cappuccino","cold brew","iced coffee","trà sữa","milk tea",
      "bubble tea","boba","tea","drinks","beverage","smoothie","juice","cozy cafe","brunch spot","cafe take away","takeaway","coffee bar","coffee house",
      "roaster","third wave coffee","café culture","brew" 
    ]
  },

  /* =========================
  🏨 ACCOMMODATION
  ========================= */
  {
    name: 'accommodation',
    triggers: [
      "khách sạn","khach san","ks","hotel","resort","homestay","hostel","nhà nghỉ","nha nghi","motel","nhà nghỉ bình dân","villa","biệt thự",
      "ở đâu","o dau","ở qua đêm","o qua dem","ngủ lại","ngu lai","thuê phòng","thue phong","đặt phòng","dat phong","dat phong online","booking","book","checkin","check-in",
      "phòng","phong","phòng ks","phong ks","phòng đôi","phòng đơn","phòng gia đình","phòng giá rẻ","ks 3 sao","ks 4 sao","ks 5 sao","khách sạn gần","khach san gan",
      "hostel giá rẻ","homestay giá rẻ","homestay gần","homestay gia re","thuê nhà","thuê villa","cho thuê","nhà cho thuê","apartment","studio","bnb"
    ],
    expansions: [
      "hotel","homestay","hostel","resort","accommodation","room","stay","motel","bnb","guesthouse","apartment","serviced apartment","lodging","inn","villa",
      "bed and breakfast","phòng","nhà nghỉ","đặt phòng","booking","check-in","overnight","short stay","long stay","cheap hotel","boutique hotel","luxury hotel",
      "airbnb","studio","private room"
    ]
  },

  /* =========================
  🎮 ENTERTAINMENT / NIGHTLIFE
  ========================= */
  {
    name: 'entertainment',
    triggers: [
      "giải trí","giai tri","đi chơi","di choi","vui chơi","vui","hang out","hangout","tụ tập","tu tap","quẩy","quay","party","buổi diễn","buoi dien",
      "live music","concert","show","sự kiện","su kien","event","nightlife","đi bar","di bar","bar","club","pub","nhậu","quan nhau","karaoke","xem nhạc",
      "đi chơi đâu","di choi dau","khu vui chơi","khu giai tri","khu giải trí","hoạt động giải trí","gian hàng","festival","le hoi","lễ hội","lễ hội âm nhạc"
    ],
    expansions: [
      "entertainment","nightlife","bar","club","pub","karaoke","live music","concert","event","show","performance","hangout","party","fun","outing",
      "amusement","evening entertainment","entertainment venue","pub crawl","night spot","local events","live show","festival","music venue","performance space"
    ]
  },

  /* =========================
  🎬 CINEMA
  ========================= */
  {
    name: 'cinema',
    triggers: [
      "rạp phim","rap phim","rap","xem phim","coi phim","movie","film","cinema","phim rạp","suất chiếu","suất chieu","showtime","mua vé phim","mua ve phim",
      "cgv","bhd","lotte","galaxy","imax","3d","2d","xem phim nay","xem phim tối nay","di coi phim","di rap","rap gan day","rap gan toi","ve xem phim"
    ],
    expansions: [
      "cinema","movie","film","movie theater","rạp chiếu phim","screening","showtime","ticket","vé xem phim","IMAX","3D","2D","multiplex","box office",
      "film screening","movie night","cinema chain","local cinema","screen"
    ]
  },

  /* =========================
  🎤 KARAOKE
  ========================= */
  {
    name: 'karaoke',
    triggers: [
      "karaoke","kara","kar","karo","ktv","KTV","hát","hat","đi hát","di hat","phòng hát","phong hat","karaoke box","karaoke gia đình","karaoke gia dinh",
      "karaoke bar","karaoke club","karaoke gần đây","karao","karaoke giá rẻ","karaoke xin","hat hat","song ca","hat doi","singing room","karaoke phòng karaoke"
    ],
    expansions: [
      "karaoke","KTV","karaoke room","singing","karaoke bar","karaoke club","family karaoke","karaoke box","phòng hát","sing room","karaoke venue","karaoke lounge",
      "private room karaoke","karaoke party","sing along","karaoke night"
    ]
  },

  /* =========================
  🎯 GAMING
  ========================= */
  {
    name: 'gaming',
    triggers: [
      "gaming","game","chơi game","choi game","quán net","quan net","net","quannet","cafe net","pc gaming","console","ps4","ps5","xbox","esport","e-sport","esports",
      "arcade","game center","lan center","cyber","phòng net","phong net","game pub","game lounge","máy game","may game","game house","thi đấu","thi dau"
    ],
    expansions: [
      "gaming center","game","arcade","esports","net cafe","quán net","PC gaming","console cafe","LAN center","arcade bar","gaming lounge","e-sports arena",
      "game hub","gaming venue","video games","arcade games","internet cafe"
    ]
  },

  /* =========================
  🎡 THEME PARK / FUN
  ========================= */
  {
    name: 'theme_park_fun',
    triggers: [
      "khu vui chơi","khu giai tri","khu giải trí","cong vien","công viên","cong vien nuoc","công viên nước","playground","khu tre em","khu tham quan","khu van hoa",
      "theme park","amusement park","water park","funfair","fair","festival","lễ hội","le hoi","ride","roller coaster","outdoor park","kids park",
      "bể bơi","be boi","hồ bơi","ho boi","swimming pool","bãi biển","bai bien","tắm biển","tam bien"
    ],
    expansions: [
      "theme park","amusement park","water park","playground","family fun","attraction","ride","roller coaster","funfair","carnival","kids park","indoor play",
      "adventure park","family attraction","children play area","outdoor attraction"
    ]
  },

  /* =========================
  🛍 SHOPPING
  ========================= */
  {
    name: 'shopping',
    triggers: [
      "mua sắm","mua sam","shopping","shop","cửa hàng","cua hang","mall","trung tâm thương mại","TTTM","chợ","cho","market","night market","bazaar","boutique","store",
      "thời trang","thoi trang","giày","giay","phụ kiện","phu kien","electronics","đi mua sắm","di mua sam","supermarket","siêu thị","sieuthi","convenience store",
      "shopping mall","mua hang","mua sam online","sale","giảm giá","giam gia"
    ],
    expansions: [
      "shopping","market","store","mall","local market","boutique","supermarket","grocery","convenience store","shopping center","bazaar","retail",
      "merchant","shop","storefront","shopping mall","marketplace","flea market","night market","handicraft market","outlet","department store"
    ]
  },

  /* =========================
  📍 TRAVEL
  ========================= */
  {
    name: 'travel',
    triggers: [
      "du lịch","du lich","dulich","du lịch","tour","tour du lịch","tham quan","tham quan","checkin","check-in","check in","sống ảo","song ao","phượt","phuot",
      "travel","trip","vacation","holiday","tourist","tourist attraction","photo spot","check in spot","khám phá","kham pha","discover","scenic spot","view đẹp","view dep","scenic",
      "tour guide","du lich gia re","du lich tron goi","du lich tu tuc","travel agency","homestay tour","package tour"
    ],
    expansions: [
      "tourist attraction","scenic spot","tour","travel","trip","holiday","vacation","sightseeing","check-in spot","photo spot","tourism","travel guide",
      "travel spot","scenic view","point of interest","tour package","day trip","excursion","travel destination","landmark","heritage site"
    ]
  },

  /* =========================
  🌮 STREET FOOD / DESSERT / SNACK
  ========================= */
  {
    name: 'street_food',
    triggers: [
      "đồ vặt","do vat","street food","food stall","gánh hàng","vỉa hè","via he","quán vỉa hè","hẻm","hem","ăn vặt","an vat","quán nhỏ","bon me","ăn vặt nha",
      "bánh mì","banh mi","bánh ngọt","banh ngot","chè","che","kem","ice cream","ice-cream","gelato","sinh tố","sinh to","tráng miệng","trang mieng"
    ],
    expansions: [
      "street food","đồ vặt","food stall","food cart","street vendor","cheap eats","hẻm","local specialties","grilled skewers","banh mi","bun cha","satay","snack stalls",
      "local vendor","vỉa hè food","dessert","kem","chè","bakery","sweet shop","ice cream shop","sundae","bingsu"
    ]
  },

  /* =========================
  🔖 PRICE / TIER SIGNALS
  ========================= */
  {
    name: 'cheap',
    triggers: [
      "giá rẻ","gia re","rẻ","re","cheap","affordable","budget","rẻ bèo","gia hop ly","gia hap ly","ăn rẻ","an re","hẻm rẻ","hem re"
    ],
    expansions: [
      "giá rẻ","cheap","affordable","budget","economical","value","discount","deal","cheap eats","street food","fast food","food court","hẻm","local","combo"
    ]
  },

  {
    name: 'expensive',
    triggers: [
      "xịn xò","xin xo","xịn","dat","đắt","expensive","fine dining","sang chảnh","sang","sang chảnh","luxury","cao cấp","cao cap"
    ],
    expansions: [
      "đắt","expensive","fine dining","upscale","luxury","gourmet","premium","steakhouse","omakase","chef","high end","premium experience","romantic dinner","tasting menu"
    ]
  },

  /* =========================
  👪 FAMILY / KID FRIENDLY
  ========================= */
  {
    name: 'family_kid_friendly',
    triggers: [
      "trẻ em","tre em","kids","children","family","gia đình","gia dinh","kids friendly","cho tre em","khu vui choi","choi cho tre","family friendly","gia dinh di choi"
    ],
    expansions: [
      "kids friendly","family friendly","playground","children area","kids menu","high chair","family restaurant","kid zone","indoor playground","children play area","baby seat","kid activities","family dining","child friendly","kids corner"
    ]
  },

  /* =========================
  🛠 AMENITIES / WIFI / QUIET
  ========================= */
  {
    name: 'wifi_quiet',
    triggers: [
      "wifi","yên tĩnh","yen tinh","quiet","wifi free","ổ cắm","o cam","power outlets","plug","ổ cắm điện","o cam dien","ổ cắm sạc"
    ],
    expansions: [
      "wifi","free wifi","yên tĩnh","quiet","power outlets","ổ cắm","plug sockets","work friendly","study friendly","good wifi","fast wifi","internet","cozy corner","desk","stable wifi"
    ]
  },

  /* =========================
  🌃 NIGHTLIFE / BAR
  ========================= */
  {
    name: 'nightlife',
    triggers: [
      "bar","club","pub","quẩy","quay","party","karaoke","đi bar","di bar","đi club","di club","late night","quán bar","quan bar"
    ],
    expansions: [
      "bar","club","pub","karaoke","DJ","live band","cocktails","drinks","night out","late night","rooftop","speakeasy","dance floor","night market","party spot"
    ]
  },

  /* =========================
  🥗 HEALTHY / DIET
  ========================= */
  {
    name: 'healthy',
    triggers: [
      "healthy","lành mạnh","lanh manh","salad","ăn healthy","an healthy","organic","juice bar","smoothie","ăn chay","an chay","vegetarian","vegan"
    ],
    expansions: [
      "healthy","salad","organic","vegetarian","vegan","juice bar","smoothie","low calorie","fresh","health cafe","green bowl","whole foods","salad bar","detox","fresh food"
    ]
  }
  ,
  /* =========================
  ❄️ WEATHER / COOLING (giải nhiệt, nước mát, kem, trà đá)
  ========================= */
  {
    name: 'weather_cooling',
    triggers: [
      'giải nhiệt','giai nhiet','giai-nhiet','giải khát','giai khat','nóng','nong','trời nóng','troi nong','nóng quá','nong qua','hơi nóng','hoi nong',
      'uống gì giải nhiệt','uong gi giai nhiet','uống gì mát','uong gi mat','giải nhiệt ở đâu','giai nhiet o dau'
    ],
    expansions: [
      'giải nhiệt','giai nhiet','cold drinks','trà đá','tra da','sinh tố','sinh to','smoothie','juice','kem','ice cream','bingsu','slush','slushie','dessert','cold beverage','refreshing drinks'
    ]
  },

  /* =========================
  🌬 INDOOR / AIRCON (chỗ mát, quán có máy lạnh)
  ========================= */
  {
    name: 'indoor_cool',
    triggers: [
      'máy lạnh','may lanh','máy lạnh ở đâu','may lanh o dau','chỗ máy lạnh','cho may lanh','quán có máy lạnh','quan co may lanh','aircon','air-cond'
    ],
    expansions: [
      'air-conditioned','máy lạnh','may lanh','indoor','quán có máy lạnh','aircon','cool indoor','shaded','chỗ mát'
    ]
  },

  /* =========================
  💦 WATER / SWIMMING
  ========================= */
  {
    name: 'water_fun',
    triggers: [
      'bể bơi','be boi','hồ bơi','ho boi','bể bơi gần đây','be boi gan day','hồ bơi gần','ho boi gan','hồ bơi gần đây','cong vien nuoc','công viên nước','swimming pool','di bơi','di boi','tắm biển','tam bien'
    ],
    expansions: [
      'swimming pool','bể bơi','be boi','water park','cong vien nuoc','công viên nước','pool','swim','beach','bãi biển'
    ]
  }
];
// Pre-normalize triggers for fast matching

// Pre-normalize triggers for fast matching
const _SYNONYM_TRIGGER_INDEX = SYNONYM_GROUPS.map(g => ({
  name: g.name,
  triggers: (g.triggers || []).map(t => String(t || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()),
  expansions: (g.expansions || []).map(e => String(e || '').trim())
}));

// ================== OPENAI ==================
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function normalizeText(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[ -\u001f\u007f-\u009f]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
 
// Enhanced normalizer (safe override) — keeps original API but improves slang handling
function normalizeTextEnhanced(text) {
  const raw = String(text || '');
  let s = raw.trim().toLowerCase();

  // decompose accents and remove combining marks
  s = s.normalize('NFKD').replace(/\p{M}/gu, '');

  // remove control chars and most punctuation (keep letters/numbers/spaces)
  s = s.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');
  s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ');

  // lightweight slang/token normalizations (word-level)
  const SLANG_MAP = {
    // pronouns & short forms
    'j': 'gi', 'aj': 'ai', 'anj': 'an gi', 'an j': 'an gi',
    'k': 'khong', 'kh': 'khong', 'ko': 'khong', 'kg': 'khong', 'hok': 'khong', 'hong': 'khong', 'khum': 'khong',
    'dc': 'duoc', 'đc': 'duoc', 'duoc': 'duoc',
    'bn': 'bao nhieu', 'baonhieu': 'bao nhieu', 'bnr': 'bao nhieu',
    'mk': 'minh', 'tui': 'minh', 'toi': 'minh',
    'cf': 'cafe', 'caphe': 'cafe', 'coffee': 'cafe', 'cafe': 'cafe',
    'dz': 'di', 'di': 'di', 'đi': 'di',
    'okela': 'ok', 'oke': 'ok', 'ok': 'ok', 'okie': 'ok',
    // intensity / exclamation
    'vl': 'rat', 'vcl': 'rat', 'vcc': 'rat', 'vai': 'rat', 'vãi': 'rat',
    'nhe': 'nhe', 'nha': 'nha', 'ne': 'ne',
    // device / misc
    'đt': 'dienthoai', 'dt': 'dienthoai',
    'choi': 'choi', 'quay': 'choi', 'quẩy': 'choi',
    'ngon': 'ngon', 'ngonn': 'ngon',
    're': 're', 'gia': 'gia', 'giare': 're',
    'hn': 'ha noi', 'hnoi': 'ha noi', 'sg': 'ho chi minh', 'tphcm': 'ho chi minh', 'hcm': 'ho chi minh',
    'dep': 'dep', 'đẹp': 'dep',
    'chill': 'chill', 'thoaimai': 'chill', 'thoai mai': 'chill',
    'doi': 'doi', 'đói': 'doi', 'no': 'no',
    'thik': 'thich', 'thích': 'thich',
    'g': 'gi', 'z': 'gi'
  };

  const parts = s.split(/\s+/).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i];
    if (SLANG_MAP[w]) parts[i] = SLANG_MAP[w];
  }
  s = parts.join(' ').replace(/\s+/g, ' ').trim();
  return s;
}

// Try to override the existing normalizeText function in-place (safe, non-breaking)
try {
  normalizeText = normalizeTextEnhanced; // eslint-disable-line no-global-assign
} catch (e) {
  // If override fails, existing normalizeText remains in effect — still safe.
}

// Expand keywords using SYNONYM_GROUPS — returns merged array of tokens + expansions
function expandKeywords(message) {
  const norm = normalizeText(message || '');
  if (!norm) return [];
  const tokens = norm.split(/\s+/).filter(Boolean);
  const out = new Set(tokens);

  for (const g of _SYNONYM_TRIGGER_INDEX) {
    for (const trig of g.triggers) {
      if (!trig) continue;
      if (norm.includes(trig) || containsTerm(norm, trig)) {
        (g.expansions || []).forEach((e) => out.add(String(e).trim()));
        break;
      }
    }
  }

  return Array.from(out);
}

// Lightweight casual-message detector for greetings/acknowledgements
function isCasualMessage(message) {
  return Boolean(detectCasualIntent(message));
}

// ------------------ Price / Weather / Related helpers ------------------
function parseMoneyToken(token) {
  if (!token) return null;
  const s = String(token || '').toLowerCase().replace(/\s+/g, '');

  const kMatch = s.match(/^([\d.,]+)k(?:d|đ|vnd)?$/i);
  if (kMatch) {
    const num = parseFloat(kMatch[1].replace(',', '.'));
    if (Number.isFinite(num)) return Math.round(num * 1000);
  }

  const trMatch = s.match(/^([\d.,]+)(?:tr|trieu|tri[eê]u|m)$/i);
  if (trMatch) {
    const num = parseFloat(trMatch[1].replace(',', '.'));
    if (Number.isFinite(num)) return Math.round(num * 1000000);
  }

  const numWithSep = s.match(/^([\d.,]+)(?:d|đ|vnd)?$/i);
  if (numWithSep) {
    const raw = numWithSep[1].replace(/[.,]/g, '');
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 1000) return parsed;
  }

  return null;
}

function parsePriceRange(message) {
  const norm = String(message || '').toLowerCase();
  let min = null, max = null, tag = null;

  // hyphen range e.g. 50k-150k
  const hyphen = norm.match(/(\d+[.,]?\d*\s*(?:k|tr|trieu|tri[eê]u|đ|d|vnd)?)\s*[-–]\s*(\d+[.,]?\d*\s*(?:k|tr|trieu|tri[eê]u|đ|d|vnd)?)/i);
  if (hyphen) {
    const a = parseMoneyToken(hyphen[1]);
    const b = parseMoneyToken(hyphen[2]);
    if (a !== null && b !== null) {
      min = Math.min(a, b);
      max = Math.max(a, b);
      return { min, max, tag };
    }
  }

  const under = norm.match(/(?:duoi|duới|duoi|dưới|below|under)\s*(\d+[.,]?\d*\s*(?:k|tr|trieu|tri[eê]u|đ|d|vnd)?)/i);
  if (under) {
    const m = parseMoneyToken(under[1]);
    if (m !== null) { max = m; return { min, max, tag }; }
  }

  const over = norm.match(/(?:tren|trên|over|above)\s*(\d+[.,]?\d*\s*(?:k|tr|trieu|tri[eê]u|đ|d|vnd)?)/i);
  if (over) {
    const m = parseMoneyToken(over[1]);
    if (m !== null) { min = m; return { min, max, tag }; }
  }

  if (norm.includes('giá rẻ') || norm.includes('gia re') || norm.includes('re') || norm.includes('cheap')) {
    tag = 'cheap';
    return { min, max, tag };
  }
  if (norm.includes('đắt') || norm.includes('dat') || norm.includes('expensive')) {
    tag = 'expensive';
    return { min, max, tag };
  }

  const anyNum = norm.match(/(\d+[.,]?\d*\s*(?:k|tr|trieu|tri[eê]u|đ|d|vnd))/i);
  if (anyNum) {
    const m = parseMoneyToken(anyNum[1]);
    if (m !== null) { max = m; return { min, max, tag }; }
  }

  return { min, max, tag };
}

function extractPriceFromVenue(venue) {
  const text = String((venue?.name || '') + ' ' + (venue?.description || '') + ' ' + (venue?.address || '')).toLowerCase();
  const m = text.match(/(\d+[.,]?\d*\s*(?:k|tr|trieu|tri[eê]u|đ|d|vnd))/i);
  if (m) return parseMoneyToken(m[1]);
  return null;
}

function filterVenuesByPrice(venues, priceRange) {
  if (!Array.isArray(venues) || !priceRange) return venues;
  const { min, max, tag } = priceRange;
  if (!min && !max && !tag) return venues;

  const matched = venues.filter((v) => {
    const price = extractPriceFromVenue(v);
    if (min !== null && Number.isFinite(min)) {
      if (!price) return false;
      if (price < min) return false;
    }
    if (max !== null && Number.isFinite(max)) {
      if (!price) return false;
      if (price > max) return false;
    }
    return true;
  });

  if (tag === 'cheap' && matched.length === 0) {
    const cheapWords = ['hẻm', 'hem', 'cheap', 'gia re', 'gia re', 're', 'ăn vặt', 'street food', 'fast food', 'food court'];
    return venues.filter(v => cheapWords.some(w => containsTerm(`${v.name} ${v.description} ${v.category || ''}`, w)));
  }

  if ((min !== null || max !== null) && matched.length === 0) {
    // don't return empty - fallback to original venues so user still gets suggestions
    return venues;
  }

  return matched;
}

function scoreVenueByWeather(venue, runtimeContext) {
  if (!runtimeContext || typeof runtimeContext !== 'object') return 0;
  const temp = Number(runtimeContext.temperatureC);
  const condition = String(runtimeContext.conditionMain || runtimeContext.conditionDescription || '').toLowerCase();
  const text = normalizeText(`${venue.name || ''} ${venue.category || ''} ${venue.description || ''}`);
  let score = 0;

  if (Number.isFinite(temp)) {
    if (temp >= 30) {
      if (text.includes('kem') || text.includes('ice cream') || text.includes('gelato') || text.includes('trà sữa') || text.includes('tra sua') || text.includes('iced')) score += 30;
    } else if (temp <= 16) {
      if (text.includes('phở') || text.includes('pho') || text.includes('lẩu') || text.includes('lau') || text.includes('soup') || text.includes('hotpot')) score += 25;
    }
  }

  if (condition) {
    if (condition.includes('rain') || condition.includes('mua') || condition.includes('mưa') || condition.includes('storm')) {
      if (text.includes('cafe') || text.includes('ca phe') || text.includes('nhà hàng') || text.includes('nha hang') || text.includes('restaurant') || text.includes('bar') || text.includes('pub') || text.includes('karaoke')) score += 20;
      if (text.includes('vỉa hè') || text.includes('via he') || text.includes('street food') || text.includes('outdoor') || text.includes('terrace')) score -= 15;
    } else if (condition.includes('clear') || condition.includes('sun') || condition.includes('nắng') || condition.includes('nang')) {
      if (text.includes('outdoor') || text.includes('terrace') || text.includes('garden') || text.includes('roof')) score += 8;
    }
  }

  return score;
}

function sortVenuesByWeather(venues, runtimeContext) {
  return (venues || []).slice().map((v, idx) => ({ v, idx, score: scoreVenueByWeather(v, runtimeContext) })).sort((a, b) => b.score - a.score || a.idx - b.idx).map(x => x.v);
}

function findRelatedVenues(primary, allVenues, seedText, relatedCount) {
  if (!Array.isArray(allVenues) || !allVenues.length) return [];
  const primaryIds = new Set((primary || []).map(v => v.id));
  const seedExpansions = expandKeywords(seedText || '');
  const candidates = allVenues.filter(v => !primaryIds.has(v.id));
  const scored = candidates.map((v, idx) => {
    const text = normalizeText(`${v.name || ''} ${v.category || ''} ${v.description || ''}`);
    let score = 0;
    for (const tok of seedExpansions) {
      if (!tok) continue;
      const nTok = normalizeText(tok);
      if (nTok && text.includes(nTok)) score += 10;
    }
    return { v, score, idx };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.idx - b.idx);
  const results = scored.slice(0, relatedCount).map(x => x.v);

  if (results.length < relatedCount) {
    const extra = candidates.filter(v => !results.find(r => r.id === v.id)).slice(0, relatedCount - results.length);
    return results.concat(extra);
  }
  return results;
}

function containsTerm(text, term) {
  const source = ` ${normalizeText(text)} `;
  const needle = normalizeText(term);
  if (!needle) return false;
  return source.includes(` ${needle} `);
}

function getKeywordWeight(keyword = '') {
  const normalized = normalizeText(keyword);
  if (!normalized) return 0;
  return Math.max(normalized.split(/\s+/).length * 3, normalized.length);
}

function getCategoryScoreBoost(category = '', normalizedText = '') {
  const retailSignals = ['shop', 'cua hang', 'store', 'shopping', 'mua sam', 'mua'];
  const sportsFacilitySignals = ['san bong', 'bong da', 'gym', 'pickleball', 'football', 'soccer', 'futsal', 'stadium', 'arena'];
  const foodSignals = ['quan an', 'nha hang', 'pho', 'bun', 'com', 'lau', 'hu tieu'];

  const hasRetailSignal = retailSignals.some((term) => containsTerm(normalizedText, term));
  const hasSportsFacilitySignal = sportsFacilitySignals.some((term) => containsTerm(normalizedText, term));
  const hasFoodSignal = foodSignals.some((term) => containsTerm(normalizedText, term));

  if (category === 'market' && hasRetailSignal) {
    return 25;
  }

  if (category === 'sports' && hasRetailSignal && !hasSportsFacilitySignal) {
    return -12;
  }

  if (category === 'food' && hasFoodSignal) {
    return 8;
  }

  return 0;
}

function detectCategoryFromText(text = '') {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return 'general';

  let bestCategory = 'general';
  let bestScore = 0;
  for (const [category, config] of Object.entries(CATEGORY_MAP)) {
    if (category === 'general') continue;
    const score = (config.keywords || []).reduce((total, keyword) => {
      return containsTerm(normalizedText, keyword) ? total + getKeywordWeight(keyword) : total;
    }, 0) + getCategoryScoreBoost(category, normalizedText);

    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestCategory;
}

function isFollowUpSuggestionRequest(text = '') {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return false;

  const followUpTokens = ['con', 'khac', 'nua', 'them', 'tiep', 'goi y', 'de xuat'];
  return followUpTokens.some((tok) => containsTerm(normalizedText, tok));
}

function getRecentUserHistoryText(chatHistory = [], limit = 4) {
  if (!Array.isArray(chatHistory) || !chatHistory.length) return '';

  return buildChatHistory(chatHistory)
    .filter((item) => item?.role === 'user')
    .slice(-limit)
    .map((item) => String(item?.content || ''))
    .join(' ');
}

function detectCategory(message = '', chatHistory = []) {
  const directCategory = detectCategoryFromText(message);
  if (directCategory !== 'general') {
    return directCategory;
  }

  if (!isFollowUpSuggestionRequest(message)) {
    return 'general';
  }

  const recentUserText = getRecentUserHistoryText(chatHistory);
  if (!recentUserText) {
    return 'general';
  }

  return detectCategoryFromText(recentUserText);
}

function buildChatHistory(history = []) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map((item) => {
      if (!item) {
        return null;
      }

      if (item.role && item.content) {
        return {
          role: item.role,
          content: String(item.content || item.text || item.message || '').trim()
        };
      }

      const sender = String(item.sender || '').toLowerCase();
      const role = sender === 'user' ? 'user' : 'assistant';
      const content = String(item.text || item.content || item.message || '').trim();

      return role && content ? { role, content } : null;
    })
    .filter(Boolean);
}

function shouldSuggest(message = '', chatHistory = []) {
  const text = normalizeText(message || '');
  if (!text) return false;
  const detectedCategory = detectCategory(message, chatHistory);
  const tokenCount = text.split(/\s+/).filter(Boolean).length;

  // explicit ask keywords (normalize keywords before checking)
  const explicitRaw = ['gợi ý', 'recommend', 'suggest', 'gợi', 'gợi ý quán', 'gợi ý chỗ', 'đề xuất', 'de xuat'];
  const explicit = explicitRaw.map(k => normalizeText(k));
  for (const k of explicit) {
    if (k && containsTerm(text, k)) return true;
  }

  // direct question about where/which (normalized tokens)
  const directTokens = ['o dau', 'dau', 'nen', 'an gi', 'an o dau', 'tim cho', 'tim quan', 'goi y', 'de xuat', 'khu vui choi', 'cho tre em'];
  for (const tok of directTokens) {
    if (containsTerm(text, tok)) return true;
  }

  // dish/requirement keywords — only suggest when user also expresses intent words
  const dishRaw = ['ăn', 'món', 'hải sản', 'cafe', 'coffee', 'kem', 'bánh mì', 'phở', 'bún', 'lẩu', 'nhậu', 'cơm', 'chè', 'pizza', 'burger', 'sushi', 'trà sữa', 'khu vui chơi', 'vui chơi', 'trẻ em', 'playground'];
  const reqRaw = ['wifi', 'yên tĩnh', 'giá rẻ', 'đông vui', 'gần trung tâm', 'tránh nóng', 'tránh ồn', 'mát', 'ấm'];
  const dishKeywords = dishRaw.map(k => normalizeText(k));
  const requirementKeywords = reqRaw.map(k => normalizeText(k));
  const containsDish = dishKeywords.some((k) => k && containsTerm(text, k));
  const containsReq = requirementKeywords.some((k) => k && containsTerm(text, k));

  const intentWords = ['muon', 'tim', 'cho', 'giup', 'can', 'goi y', 'de xuat'];
  const hasIntent = intentWords.some((w) => containsTerm(text, w));

  if (detectedCategory !== 'general' && hasIntent) return true;
  if (detectedCategory !== 'general' && tokenCount <= 4) return true;
  if ((containsDish || containsReq) && hasIntent) return true;

  // follow-up asks like "còn quán nào khác không?" should inherit suggestion intent
  const hasFollowUpSignal = isFollowUpSuggestionRequest(text);
  if (detectedCategory !== 'general' && hasFollowUpSignal) return true;
  if (hasFollowUpSignal && Array.isArray(chatHistory) && chatHistory.length) {
    const recentText = normalizeText(getRecentUserHistoryText(chatHistory, 6));

    const contextSuggestTokens = ['tim', 'goi y', 'de xuat', 'quan', 'an', 'mon', 'com', 'lau', 'bun', 'pho', 'cafe', 'khu vui choi', 'tre em'];
    const hasSuggestContext = contextSuggestTokens.some((tok) => containsTerm(recentText, tok));
    if (hasSuggestContext) return true;
  }

  // otherwise do not suggest
  return false;
}

function parseJsonFromString(text) {
  if (!text || typeof text !== 'string') return null;
  const first = text.indexOf('{');
  if (first === -1) return null;

  // find the matching closing brace by counting
  let depth = 0;
  for (let i = first; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;

    if (depth === 0) {
      const candidate = text.slice(first, i + 1);
      try {
        return JSON.parse(candidate);
      } catch (e) {
        return null;
      }
    }
  }

  return null;
}

function cleanReplyText(text) {
  let value = String(text || '').trim();
  if (!value) return value;

  // Remove trailing JSON/object fragments accidentally leaked into plain text
  value = value.replace(/\{[\s\S]*$/g, '').trim();
  value = value.replace(/"?suggested_venues"?\s*:\s*\[[^\]]*]\s*}?/gi, '').trim();
  value = value.replace(/"?suggestedVenues"?\s*:\s*\[[^\]]*]\s*}?/gi, '').trim();
  value = value.replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '').trim();

  return value;
}

function normalizeCoordinate(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

function computeDistanceKm(fromLatitude, fromLongitude, toLatitude, toLongitude) {
  const lat1 = normalizeCoordinate(fromLatitude, -90, 90);
  const lon1 = normalizeCoordinate(fromLongitude, -180, 180);
  const lat2 = normalizeCoordinate(toLatitude, -90, 90);
  const lon2 = normalizeCoordinate(toLongitude, -180, 180);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
    return Number.POSITIVE_INFINITY;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function prioritizeVenuesByDistance(venues = [], latitude = null, longitude = null) {
  const userLatitude = normalizeCoordinate(latitude, -90, 90);
  const userLongitude = normalizeCoordinate(longitude, -180, 180);

  if (!Number.isFinite(userLatitude) || !Number.isFinite(userLongitude)) {
    return Array.isArray(venues) ? venues.slice() : [];
  }

  return (Array.isArray(venues) ? venues : [])
    .map((venue, index) => ({
      venue,
      index,
      distanceKm: computeDistanceKm(userLatitude, userLongitude, venue?.latitude, venue?.longitude)
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm || a.index - b.index)
    .map((entry) => ({
      ...entry.venue,
      distanceKm: Number.isFinite(entry.distanceKm) ? Number(entry.distanceKm.toFixed(2)) : null
    }));
}

function extractBearerToken(req) {
  const authHeader = String(req?.headers?.authorization || '').trim();
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

function resolveJwtUserId(payload) {
  const raw = payload?.sub ?? payload?.id ?? payload?.userId ?? payload?.user_id ?? null;
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

function formatLocalClockByOffset(offsetSeconds) {
  const parsed = Number(offsetSeconds);
  if (!Number.isFinite(parsed)) return '';
  const shiftedDate = new Date(Date.now() + parsed * 1000);
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  }).format(shiftedDate);
}

async function resolveProjectRuntimeContext(req) {
  try {
    let latitude = normalizeCoordinate(req.body?.latitude, -90, 90);
    let longitude = normalizeCoordinate(req.body?.longitude, -180, 180);
    const token = extractBearerToken(req);
    let userId = '';

    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = resolveJwtUserId(payload);
      } catch (err) {
        userId = '';
      }
    }

    if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && userId) {
      const prefResult = await pool.query(
        `SELECT last_known_latitude, last_known_longitude
         FROM user_ai_preferences
         WHERE user_id = $1
         ORDER BY updated_at DESC
         LIMIT 1`,
        [userId]
      );

      if (prefResult.rows && prefResult.rows.length) {
        const row = prefResult.rows[0];
        const lat = Number(row.last_known_latitude);
        const lon = Number(row.last_known_longitude);
        latitude = Number.isFinite(lat) ? lat : null;
        longitude = Number.isFinite(lon) ? lon : null;
      }
    }

    const host = req.get('host');
    if (!host) return null;
    const protocol = req.protocol || 'http';
    const weatherUrl = `${protocol}://${host}/api/weather/current`;

    const weatherResp = await axios.get(weatherUrl, {
      params: Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude, longitude }
        : {},
      timeout: 3500
    });

    const weather = weatherResp?.data?.weather || null;
    if (!weather || typeof weather !== 'object') return null;

    return {
      city: String(weather.city || '').trim() || '',
      country: String(weather.country || '').trim() || '',
      conditionMain: String(weather.conditionMain || '').trim() || '',
      conditionDescription: String(weather.conditionDescription || '').trim() || '',
      temperatureC: Number(weather.temperatureC),
      timezoneOffsetSeconds: Number(weather.timezoneOffsetSeconds),
      latitude: Number(weather.latitude),
      longitude: Number(weather.longitude)
    };
  } catch (err) {
    return null;
  }
}

function buildRuntimeContextPromptFromProject(runtimeContext = null) {
  if (!runtimeContext || typeof runtimeContext !== 'object') return '';

  const locationLabel = [runtimeContext.city, runtimeContext.country].filter(Boolean).join(', ');
  const localTime = formatLocalClockByOffset(runtimeContext.timezoneOffsetSeconds);
  const latitude = Number(runtimeContext.latitude);
  const longitude = Number(runtimeContext.longitude);
  const weatherMain = String(runtimeContext.conditionMain || '').trim();
  const weatherDescription = String(runtimeContext.conditionDescription || '').trim();
  const temperatureC = Number(runtimeContext.temperatureC);

  const parts = [];
  if (locationLabel) parts.push(`- Vị trí hiện tại: ${locationLabel}`);
  if (localTime) parts.push(`- Giờ địa phương hiện tại: ${localTime}`);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    parts.push(`- Tọa độ hiện tại: ${latitude}, ${longitude}`);
  }
  if (weatherMain || weatherDescription || Number.isFinite(temperatureC)) {
    const weatherText = [weatherMain, weatherDescription].filter(Boolean).join(' - ');
    const tempText = Number.isFinite(temperatureC) ? `${temperatureC}°C` : '';
    parts.push(`- Thời tiết hiện tại: ${[weatherText, tempText].filter(Boolean).join(', ')}`);
  }

  if (!parts.length) return '';
  return `\nCONTEXT THỜI GIAN/VỊ TRÍ/THỜI TIẾT (LẤY TỪ DỮ LIỆU SẴN CÓ CỦA HỆ THỐNG):\n${parts.join('\n')}`;
}

function tryResolveAuthenticatedUserId(req) {
  try {
    const token = extractBearerToken(req);
    if (!token) return '';
    const payload = jwt.verify(token, JWT_SECRET);
    return resolveJwtUserId(payload);
  } catch (_err) {
    return '';
  }
}

function detectUserContextIntent(message = '') {
  const normalizedMessage = normalizeText(message || '');
  if (!normalizedMessage) return null;

  const rules = [
    {
      intent: 'identity',
      phrases: ['toi la ai', 'tai khoan toi', 'profile toi', 'thong tin cua toi', 'ai dang dang nhap', 'tai khoan cua minh']
    },
    {
      intent: 'favorites',
      phrases: ['yeu thich cua toi', 'quan yeu thich cua toi', 'dia diem yeu thich cua toi', 'favorites cua toi', 'save cua toi']
    },
    {
      intent: 'notifications',
      phrases: ['thong bao cua toi', 'notification cua toi', 'thong bao moi cua toi']
    },
    {
      intent: 'venues',
      phrases: ['quan toi dang', 'dia diem toi dang', 'bai dang cua toi', 'venue cua toi', 'quan cua toi', 'bai toi dang']
    },
    {
      intent: 'reviews',
      phrases: ['review cua toi', 'danh gia cua toi', 'binh luan cua toi']
    }
  ];

  for (const rule of rules) {
    if (rule.phrases.some((phrase) => containsTerm(normalizedMessage, phrase) || normalizedMessage === phrase)) {
      return rule.intent;
    }
  }

  return null;
}

async function resolveUserContextPayload(req, intent) {
  const userId = tryResolveAuthenticatedUserId(req);
  if (!userId) {
    return { intent, requiresAuth: true, exists: false, data: null };
  }

  try {
    if (intent === 'identity') {
      const result = await pool.query(
        `
          SELECT id::text AS id, fullname, username, email, role
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [userId]
      );

      const row = result.rows[0] || null;
      return { intent, requiresAuth: false, exists: Boolean(row), data: row };
    }

    if (intent === 'favorites') {
      const result = await pool.query(
        `
          SELECT item_id AS "itemId", item_type AS "itemType", name, created_at AS "createdAt"
          FROM user_favorites
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 5
        `,
        [userId]
      );

      return {
        intent,
        requiresAuth: false,
        exists: true,
        data: {
          total: result.rows.length,
          items: result.rows
        }
      };
    }

    if (intent === 'notifications') {
      const result = await pool.query(
        `
          SELECT type, title, content, is_read AS "isRead", created_at AS "createdAt"
          FROM user_notifications
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 5
        `,
        [userId]
      );

      const unreadResult = await pool.query(
        `
          SELECT COUNT(*)::int AS unread_count
          FROM user_notifications
          WHERE user_id = $1 AND is_read = FALSE
        `,
        [userId]
      );

      return {
        intent,
        requiresAuth: false,
        exists: true,
        data: {
          unreadCount: Number(unreadResult.rows[0]?.unread_count || 0),
          items: result.rows
        }
      };
    }

    if (intent === 'venues') {
      const result = await pool.query(
        `
          SELECT
            id,
            COALESCE(NULLIF(name, ''), title) AS name,
            status::text AS status,
            address,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM venues
          WHERE submitted_by_user_id = $1
          ORDER BY updated_at DESC NULLS LAST, created_at DESC
          LIMIT 5
        `,
        [userId]
      );

      return {
        intent,
        requiresAuth: false,
        exists: true,
        data: {
          total: result.rows.length,
          items: result.rows
        }
      };
    }

    if (intent === 'reviews') {
      const result = await pool.query(
        `
          SELECT
            r.id,
            COALESCE(NULLIF(v.name, ''), v.title, 'Địa điểm') AS "venueName",
            r.rating,
            r.title,
            r.comment,
            r.created_at AS "createdAt"
          FROM venue_public_reviews AS r
          LEFT JOIN venues AS v ON v.id = r.venue_id
          WHERE r.user_id = $1
          ORDER BY r.created_at DESC
          LIMIT 5
        `,
        [userId]
      );

      return {
        intent,
        requiresAuth: false,
        exists: true,
        data: {
          total: result.rows.length,
          items: result.rows
        }
      };
    }
  } catch (error) {
    if (error?.code === '42P01') {
      return { intent, requiresAuth: false, exists: false, data: null };
    }
    throw error;
  }

  return { intent, requiresAuth: false, exists: false, data: null };
}

function buildConversationMemoryPrompt(chatHistory = []) {
  const history = buildChatHistory(chatHistory).slice(-6);
  if (!history.length) return '';

  const recentTurns = history.map((item) => `${item.role === 'user' ? 'User' : 'Assistant'}: ${String(item.content || '').slice(0, 160)}`);
  const recentUserModes = history
    .filter((item) => item.role === 'user')
    .slice(-3)
    .map((item) => {
      if (shouldSuggest(item.content, [])) return 'venue_recommendation';
      if (findBestFeatureGuide(item.content)) return 'system_assistant';
      if (detectUserContextIntent(item.content)) return 'user_context';
      if (detectCasualIntent(item.content)) return 'casual';
      return 'general';
    });

  return `
MEMORY NHẸ TỪ ĐOẠN CHAT GẦN ĐÂY:
- Recent turns:
${recentTurns.map((line) => `  ${line}`).join('\n')}
- Recent inferred user modes: ${recentUserModes.join(', ') || 'general'}
`.trim();
}

function buildUserContextPrompt(userContextPayload) {
  if (!userContextPayload || userContextPayload.requiresAuth || !userContextPayload.exists || !userContextPayload.data) {
    return '';
  }

  return `
USER_CONTEXT (DỮ LIỆU THẬT TỪ BACKEND, KHÔNG ĐƯỢC BỊA THÊM):
${JSON.stringify(userContextPayload.data, null, 2)}
`.trim();
}

async function generateHybridAssistantReply(client, message, chatHistory = [], options = {}) {
  const {
    runtimeContextPrompt = '',
    userContextPayload = null,
    mode = 'general'
  } = options || {};

  if (!client) {
    return 'Hiện tại mình chưa dùng được AI để trả lời câu này.';
  }

  const memoryPrompt = buildConversationMemoryPrompt(chatHistory);
  const userContextPrompt = buildUserContextPrompt(userContextPayload);
  const modeLabel = mode === 'user_context' ? 'user-context mode' : 'general GPT mode';

  const promptSections = [
    'Bạn là Smart City Discovery AI Assistant.',
    `Mode hiện tại: ${modeLabel}.`,
    'Mục tiêu: trả lời tự nhiên như ChatGPT, ngắn gọn, rõ ý, tiếng Việt hiện đại, không dùng giọng chatbot support cứng.',
    'Quy tắc bắt buộc:',
    '- Không bịa địa điểm, không tạo tên quán, không gợi ý venue ngoài dữ liệu nội bộ.',
    '- Nếu câu hỏi có xu hướng xin gợi ý quán/địa điểm/món ăn thì không tự chuyển sang sáng tác; chỉ nói ngắn rằng phần đó dùng dữ liệu nội bộ của hệ thống.',
    '- Nếu dùng USER_CONTEXT thì chỉ được nói dựa trên dữ liệu đã cung cấp. Thiếu dữ liệu thì nói là chưa có thông tin tương ứng.',
    '- Không bịa profile, review, thông báo, quán đã đăng, hay dữ liệu cá nhân.',
    '- Hạn chế emoji. Mặc định không cần emoji.',
    '- Trả lời ngắn gọn, ưu tiên 1-4 câu tùy độ phức tạp.',
    runtimeContextPrompt || '',
    memoryPrompt || '',
    userContextPrompt || ''
  ].filter(Boolean);

  const messages = [
    { role: 'system', content: promptSections.join('\n\n') },
    ...buildChatHistory(chatHistory).slice(-6),
    { role: 'user', content: String(message || '') }
  ];

  try {
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.4,
      top_p: 0.9,
      max_tokens: 500,
      messages
    });

    return cleanReplyText(response.choices?.[0]?.message?.content?.trim() || '');
  } catch (err) {
    console.error('HYBRID CHAT OPENAI ERROR:', err && err.stack ? err.stack : err);
    return 'Hiện tại mình chưa trả lời được câu này. Bạn thử lại sau nhé.';
  }
}

function findVenuesByNames(names = [], venues = []) {
  if (!Array.isArray(names) || !Array.isArray(venues)) return [];

  const normalizedVenueMap = venues.map((v) => ({
    src: v,
    key: normalizeText(v.name)
  }));

  const results = [];

  for (const rawName of names) {
    const n = normalizeText(rawName);
    if (!n) continue;

    // exact match first
    let found = normalizedVenueMap.find((item) => item.key === n);
    if (!found) {
      // substring match
      found = normalizedVenueMap.find((item) => item.key.includes(n) || n.includes(item.key));
    }

    if (found && !results.includes(found.src)) {
      results.push(found.src);
    }
  }

  return results;
}

function buildFoodIntentProfile(message = '') {
  const text = normalizeText(message);

  const dessertTerms = ['trang mieng', 'trang miệng', 'dessert', 'che', 'banh flan', 'tau hu'];
  const iceCreamTerms = ['kem', 'ice cream', 'gelato'];

  const hasDessertIntent = dessertTerms.some((t) => containsTerm(text, t));
  const hasIceCreamIntent = iceCreamTerms.some((t) => containsTerm(text, t));

  const focusTerms = [];
  const categoryTerms = [];

  if (hasDessertIntent) {
    focusTerms.push('tráng miệng', 'chè', 'flan', 'dessert');
    categoryTerms.push('tráng miệng', 'dessert');
  }

  if (hasIceCreamIntent) {
    focusTerms.push('kem', 'ice cream', 'gelato');
    categoryTerms.push('kem', 'ice cream');
  }

  return {
    focusPatterns: [...new Set(focusTerms.map((t) => `%${normalizeText(t)}%`))],
    categoryPatterns: [...new Set(categoryTerms.map((t) => `%${normalizeText(t)}%`))]
  };
}

function buildIntentExpansionTokens(message = '') {
  const text = normalizeText(message);
  const groups = [
    {
      triggers: ['mua sam', 'shopping', 'cua hang', 'shop', 'tiem'],
      expansions: ['shop', 'store', 'market', 'local market', 'cua hang', 'mua sam', 'gia dung', 'my pham']
    },
    {
      triggers: ['tre em', 'kids', 'children', 'be'],
      expansions: ['tre em', 'kids', 'children', 'playground', 'do choi', 'khu vui choi']
    },
    {
      triggers: ['the thao', 'sport', 'pickleball', 'bong da', 'gym'],
      expansions: ['sport', 'the thao', 'pickleball', 'san bong', 'football', 'soccer', 'gym', 'fitness']
    },
    {
      triggers: ['lam dep', 'beauty', 'spa', 'nail', 'toc'],
      expansions: ['beauty', 'spa', 'nail', 'salon', 'hair', 'lam dep']
    },
    {
      triggers: ['quan an', 'restaurant', 'food', 'am thuc', 'do an', 'an uong'],
      expansions: ['food', 'restaurant', 'eatery', 'am thuc', 'quan an', 'cafe', 'coffee']
    },
    {
      triggers: ['du lich', 'tham quan', 'travel', 'tour'],
      expansions: ['travel', 'tour', 'du lich', 'attraction', 'tham quan']
    }
  ];
  // Extended intent groups: time-of-day, user state, audience, location, price, and misc quick intents
  const extraGroups = [
    // Time of day groups
    {
      triggers: ['sáng','sang','ăn sáng','sáng ăn gì','buổi sáng','buoi sang','sáng uống gì','sang uong gi'],
      expansions: ['morning','breakfast','cafe','breakfast spot']
    },
    {
      triggers: ['trưa','ăn trưa','trưa ăn gì','buổi trưa','buoi trua'],
      expansions: ['lunch','dining','cơm','bun','pho','restaurant']
    },
    {
      triggers: ['chiều','chieu','chiều đi đâu','chiều chill','chieu di dau'],
      expansions: ['afternoon','cafe','chill']
    },
    {
      triggers: ['tối','toi','tối ăn gì','tối đi đâu','tối chill','toi an gi'],
      expansions: ['dinner','evening','nightlife','cafe','bar']
    },
    {
      triggers: ['đêm','dem','khuya','khuya làm gì','dem nay','dem di dau'],
      expansions: ['late night','bar','karaoke','nightlife']
    },

    // Weather / user state
    {
      triggers: ['đói','doi','đói vl','doi vl','đói quá','doi qua','muốn ăn','muon an','bung doi','bụng đói','muon an'],
      expansions: ['food','eat','restaurant','dining','ăn']
    },
    {
      triggers: ['khát','khat','khát nước','khat nuoc','uống gì','uong gi','giat nuoc'],
      expansions: ['drinks','drink','beverage','uống','trà đá','juice']
    },
    {
      triggers: ['mệt','met','mệt quá','met qua','muốn nghỉ','muon nghi'],
      expansions: ['rest','cafe','chill','quiet','yên tĩnh']
    },
    {
      triggers: ['chán','chan','chán quá','không biết làm gì','khong biet lam gi'],
      expansions: ['entertainment','fun','chill','activity']
    },

    // Audience / social context
    {
      triggers: ['gia đình','gia dinh','đi với gia đình','di voi gia dinh','dẫn con đi chơi','dan con di choi'],
      expansions: ['family friendly','kids','playground','park']
    },
    {
      triggers: ['bạn','ban','đi với bạn','di voi ban','tụ tập','tu tap','đi với bạn bè'],
      expansions: ['friends','hangout','party','bar','cafe','entertainment']
    },
    {
      triggers: ['hẹn hò','hen ho','đi date','di date'],
      expansions: ['date','romantic','view đẹp','romantic dinner','cafe đẹp']
    },
    {
      triggers: ['đi một mình','di mot minh','solo'],
      expansions: ['solo','quiet','study','work-friendly','yên tĩnh']
    },

    // Location hints
    {
      triggers: ['gần đây','gan day','gần tôi','gan toi','quanh đây','quanh day','gần trung tâm','gan trung tam','gần biển','gan bien'],
      expansions: ['nearby','near me','near center','near beach']
    },

    // Price hints
    {
      triggers: ['rẻ','re','bình dân','binh dan','giá mềm','gia mem','giá rẻ','gia re','sang xịn','sang xin','cao cấp','cao cap','đắt','dat'],
      expansions: ['cheap','affordable','budget','expensive','premium','luxury']
    },

    // Quick implicit category intents
    {
      triggers: ['xem phim','đi xem phim','di xem phim','xem rap'],
      expansions: ['cinema','movie','film']
    },
    {
      triggers: ['đi hát','di hat','hát','hat','karaoke','ktv'],
      expansions: ['karaoke','KTV','singing']
    },
    {
      triggers: ['chơi game','choi game','game','quán net','quan net'],
      expansions: ['gaming','game center','arcade']
    },
    {
      triggers: ['mua đồ','mua do','mua sắm','mua sam','đi chợ','di cho'],
      expansions: ['shopping','market','store']
    },
    {
      triggers: ['ngủ lại','ngu lai','ở lại','o lai','đặt phòng','dat phong','homestay','hotel','khách sạn'],
      expansions: ['hotel','homestay','stay','accommodation']
    },
    {
      triggers: ['sống ảo','song ao','check-in','check in','chụp hình','chup hinh','view đẹp','view dep'],
      expansions: ['scenic spot','photo spot','check-in spot']
    }
  ];

  // merge base groups + extra groups for detection
  groups.push(...extraGroups);

  const tokens = [];
  for (const group of groups) {
    const hit = group.triggers.some((t) => containsTerm(text, t));
    if (hit) tokens.push(...group.expansions.map((v) => normalizeText(v)));
  }
  return [...new Set(tokens.filter(Boolean))];
}

function buildHardIntentPatterns(message = '') {
  const text = normalizeText(message);
  const patterns = [];

  if (containsTerm(text, 'bong da') || containsTerm(text, 'san bong') || containsTerm(text, 'football') || containsTerm(text, 'soccer')) {
    patterns.push('%bong da%', '%san bong%', '%football%', '%soccer%', '%futsal%');
  }
  if (containsTerm(text, 'pickleball')) {
    patterns.push('%pickleball%');
  }
  if (containsTerm(text, 'cafe') || containsTerm(text, 'coffee')) {
    patterns.push('%cafe%', '%ca phe%', '%coffee%');
  }
  if (containsTerm(text, 'kem') || containsTerm(text, 'ice cream')) {
    patterns.push('%kem%', '%ice cream%', '%gelato%');
  }
  if (containsTerm(text, 'trang mieng') || containsTerm(text, 'dessert')) {
    patterns.push('%trang mieng%', '%dessert%', '%che%', '%flan%');
  }

  return [...new Set(patterns)];
}

function buildSafeSuggestionReply(venues = []) {
  const picked = (Array.isArray(venues) ? venues : [])
    .map((v) => String(v?.name || '').trim())
    .filter(Boolean)
    .slice(0, 2);

  if (!picked.length) {
    return 'ừm, mình chưa thấy chỗ hợp lắm, nói rõ gu hơn chút nha 😅';
  }

  if (picked.length === 1) {
    return `nè, thử ${picked[0]} nha, khá ổn á 😄`;
  }

  return `nè, thử ${picked[0]} hoặc ${picked[1]} nha 😄`;
}

function extractNormalizedSearchTerms(seedText = '') {
  const normalized = normalizeText(seedText);
  if (!normalized) {
    return { singleTerms: [], phraseTerms: [] };
  }

  const baseStopWords = [
    'tim', 'giup', 'toi', 'minh', 'cho', 'nhe', 'nha', 'di', 'voi', 'quan', 'may', 'co', 'khong',
    'nao', 'o', 'dau', 'an', 'de', 'xuat', 'goi', 'y', 'duoc', 'dc', 'kh', 'muon', 'ban', 'thu',
    'vai', 'them', 'nua', 'mot', 'so', 'cac'
  ];
  const genericWeakTokens = new Set(['tiem', 'cho', 'noi', 'dia', 'phuong']);
  const stopWords = new Set([
    ...Array.from(STOP_WORDS).map((w) => normalizeText(w)),
    ...baseStopWords.map((w) => normalizeText(w))
  ]);

  const tokens = normalized
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !stopWords.has(token) && !genericWeakTokens.has(token));

  const singleTerms = [...new Set(tokens)];
  const phraseTerms = [];

  for (let i = 0; i < tokens.length - 1; i++) {
    phraseTerms.push(`${tokens[i]} ${tokens[i + 1]}`);
  }

  for (let i = 0; i < tokens.length - 2; i++) {
    phraseTerms.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }

  return {
    singleTerms,
    phraseTerms: [...new Set(phraseTerms.filter(Boolean))]
  };
}

function filterVenuesByMessageIntent(seedText = '', venues = []) {
  if (!Array.isArray(venues) || !venues.length) return [];
  const { singleTerms, phraseTerms } = extractNormalizedSearchTerms(seedText);

  const intentTerms = buildIntentExpansionTokens(seedText);
  const foodIntent = buildFoodIntentProfile(seedText);
  const focusTerms = foodIntent.focusPatterns
    .map((p) => normalizeText(String(p).replace(/^%|%$/g, '')))
    .filter(Boolean);
  const requiredTerms = [...new Set([...intentTerms.map((term) => normalizeText(term)), ...focusTerms])];
  const hardTerms = buildHardIntentPatterns(seedText)
    .map((p) => normalizeText(String(p).replace(/^%|%$/g, '')))
    .filter(Boolean);

  if (!singleTerms.length && !phraseTerms.length && !requiredTerms.length && !hardTerms.length) {
    return venues.slice(0, RESULT_LIMIT);
  }

  const scored = venues.map((venue, index) => {
    const nameText = normalizeText(venue?.name || '');
    const categoryText = normalizeText(venue?.category || '');
    const descriptionText = normalizeText(venue?.description || '');
    const wardText = normalizeText(venue?.ward_name || '');
    const venueText = `${nameText} ${categoryText} ${descriptionText} ${wardText}`.trim();

    if (!venueText) {
      return null;
    }

    const phraseHits = phraseTerms.filter((term) => containsTerm(venueText, term)).length;
    const nameHits = singleTerms.filter((term) => containsTerm(nameText, term)).length;
    const keywordHits = singleTerms.filter((term) => containsTerm(venueText, term)).length;
    const requiredHits = requiredTerms.filter((term) => containsTerm(venueText, term)).length;
    const hardHits = hardTerms.filter((term) => containsTerm(venueText, term)).length;

    if (hardTerms.length && hardHits === 0) {
      return null;
    }

    if (!phraseHits && !nameHits && !keywordHits && !requiredHits && (singleTerms.length || phraseTerms.length || requiredTerms.length)) {
      return null;
    }

    return {
      venue,
      index,
      score: (hardHits * 100) + (phraseHits * 25) + (nameHits * 10) + (requiredHits * 5) + keywordHits
    };
  }).filter(Boolean);

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.venue)
    .slice(0, RESULT_LIMIT);
}

function buildSuggestionSeedText(message = '', chatHistory = []) {
  if (!isFollowUpSuggestionRequest(message)) {
    return String(message || '');
  }

  const historySeed = getRecentUserHistoryText(chatHistory);
  return [historySeed, String(message || '')].filter(Boolean).join(' ');
}

// ================== DB ==================
async function getVenuesByCategory(categoryKey, limit = RESULT_LIMIT) {
  const config = CATEGORY_MAP[categoryKey] || CATEGORY_MAP.general;
  const categoryPatterns = config.categoryPatterns || [];
  const keywordPatterns = config.keywordPatterns || [];

  if (!categoryPatterns.length && !keywordPatterns.length) {
    return [];
  }

  const result = await pool.query(
    `WITH scored AS (
       SELECT
         venues.id,
         COALESCE(NULLIF(venues.name, ''), venues.title) AS name,
         venues.address,
         venues.description,
         venues.latitude,
         venues.longitude,
         wards.name AS ward_name,
         place_categories.name AS category_name,
         (
           SELECT COUNT(*)
           FROM unnest($1::text[]) AS p(pattern)
           WHERE
             LOWER(COALESCE(place_categories.slug, '')) LIKE p.pattern OR
             LOWER(COALESCE(place_categories.name, '')) LIKE p.pattern OR
             LOWER(COALESCE(place_categories.description, '')) LIKE p.pattern
         ) AS category_score,
         (
           SELECT COUNT(*)
           FROM unnest($2::text[]) AS p(pattern)
           WHERE
             LOWER(COALESCE(venues.name, '')) LIKE p.pattern OR
             LOWER(COALESCE(venues.description, '')) LIKE p.pattern OR
             LOWER(COALESCE(place_categories.name, '')) LIKE p.pattern OR
             LOWER(COALESCE(place_categories.description, '')) LIKE p.pattern
         ) AS keyword_score
       FROM venues
       LEFT JOIN wards ON wards.ward_id = venues.ward_id
       LEFT JOIN place_categories ON place_categories.id = venues.category_id
       WHERE venues.status = 'approved'
     )
     SELECT *
     FROM scored
     WHERE category_score > 0 OR keyword_score > 0
     ORDER BY category_score DESC, keyword_score DESC, id DESC
     LIMIT $3`,
    [categoryPatterns, keywordPatterns, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: normalizeCoordinate(row.latitude, -90, 90),
    longitude: normalizeCoordinate(row.longitude, -180, 180),
    category: row.category_name || '',
    description: row.description || '',
    ward_name: row.ward_name || ''
  }));
}

async function getRelevantVenues(message, limit = RESULT_LIMIT) {
  const rawTokens = String(message || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (!rawTokens.length) {
    return [];
  }

  const baseStop = [
    'tim', 'tìm', 'giup', 'giúp', 'toi', 'tôi', 'minh', 'mình', 'cho', 'nhe', 'nhé',
    'nha', 'đi', 'di', 'voi', 'với', 'quan', 'quán', 'may', 'mấy', 'co', 'có', 'khong',
    'không', 'nao', 'nào', 'o', 'ở', 'dau', 'đâu', 'an', 'ăn', 'de', 'xuat', 'goi', 'y',
    'duoc', 'dc', 'kh', 'toi', 'muon', 'ban', 'minh', 'thu', 'vai'
  ];
  const genericWeakTokens = new Set(['tiem', 'quan', 'cho', 'noi', 'dia', 'phuong']);
  const stopWords = new Set([
    ...Array.from(STOP_WORDS).map((w) => normalizeText(w)),
    ...baseStop.map((w) => normalizeText(w))
  ]);

  const keywordTokens = rawTokens.filter(
    (t) => t.length >= 2 && !stopWords.has(t) && !genericWeakTokens.has(t)
  );
  const expansionTokens = buildIntentExpansionTokens(message);
  const selectedTokens = [...new Set([...(keywordTokens.length ? keywordTokens : rawTokens), ...expansionTokens])].slice(0, 12);
  const searchPatterns = selectedTokens.map((t) => `%${t}%`);
  const strongTokens = [...new Set(selectedTokens.filter((t) => t.length >= 4))].slice(0, 6);
  const strongPatterns = strongTokens.map((t) => `%${t}%`);
  const intentProfile = buildFoodIntentProfile(message);
  const focusPatterns = intentProfile.focusPatterns;
  const categoryPatterns = intentProfile.categoryPatterns;
  const intentPatterns = [...new Set(expansionTokens.map((t) => `%${t}%`))];
  const hardIntentPatterns = buildHardIntentPatterns(message);

  if (!searchPatterns.length) {
    return [];
  }

  const result = await pool.query(
    `SELECT
       venues.id,
       COALESCE(NULLIF(venues.name, ''), venues.title) AS name,
       venues.address,
       venues.description,
       wards.name AS ward_name,
       place_categories.name AS category_name,
       place_categories.description AS category_description,
       (
         SELECT COUNT(*)
         FROM unnest($1::text[]) AS p(pattern)
         WHERE
           COALESCE(venues.name, '') ILIKE p.pattern OR
           COALESCE(venues.address, '') ILIKE p.pattern OR
           COALESCE(venues.description, '') ILIKE p.pattern OR
           COALESCE(place_categories.name, '') ILIKE p.pattern OR
           COALESCE(place_categories.description, '') ILIKE p.pattern
       ) AS match_score
       ,
       (
         SELECT COUNT(*)
         FROM unnest($4::text[]) AS p(pattern)
         WHERE
           COALESCE(venues.name, '') ILIKE p.pattern OR
           COALESCE(venues.description, '') ILIKE p.pattern OR
           COALESCE(place_categories.name, '') ILIKE p.pattern
       ) AS focus_score
       ,
       (
         SELECT COUNT(*)
         FROM unnest($5::text[]) AS p(pattern)
         WHERE COALESCE(place_categories.name, '') ILIKE p.pattern
       ) AS category_focus_score
     FROM venues
     LEFT JOIN wards ON wards.ward_id = venues.ward_id
     LEFT JOIN place_categories ON place_categories.id = venues.category_id
      WHERE venues.status = 'approved'
       AND (
         SELECT COUNT(*)
         FROM unnest($1::text[]) AS p(pattern)
         WHERE
           COALESCE(venues.name, '') ILIKE p.pattern OR
           COALESCE(venues.address, '') ILIKE p.pattern OR
           COALESCE(venues.description, '') ILIKE p.pattern OR
           COALESCE(place_categories.name, '') ILIKE p.pattern
       ) > 0
       AND (
         cardinality($3::text[]) = 0 OR
         (
           SELECT COUNT(*)
           FROM unnest($3::text[]) AS p(pattern)
           WHERE
             COALESCE(venues.name, '') ILIKE p.pattern OR
             COALESCE(venues.address, '') ILIKE p.pattern OR
             COALESCE(venues.description, '') ILIKE p.pattern OR
             COALESCE(place_categories.name, '') ILIKE p.pattern
         ) > 0
       )
       AND (
         cardinality($4::text[]) = 0 OR
         (
           (
             SELECT COUNT(*)
             FROM unnest($4::text[]) AS p(pattern)
             WHERE
             COALESCE(venues.name, '') ILIKE p.pattern OR
             COALESCE(venues.description, '') ILIKE p.pattern OR
             COALESCE(place_categories.name, '') ILIKE p.pattern OR
             COALESCE(place_categories.description, '') ILIKE p.pattern
         ) > 0
           OR
           (
             SELECT COUNT(*)
             FROM unnest($5::text[]) AS p(pattern)
             WHERE COALESCE(place_categories.name, '') ILIKE p.pattern
           ) > 0
         )
       )
        AND (
          cardinality($6::text[]) = 0 OR
          (
           SELECT COUNT(*)
           FROM unnest($6::text[]) AS p(pattern)
           WHERE
             COALESCE(venues.name, '') ILIKE p.pattern OR
             COALESCE(venues.description, '') ILIKE p.pattern OR
             COALESCE(place_categories.name, '') ILIKE p.pattern OR
             COALESCE(place_categories.description, '') ILIKE p.pattern
          ) > 0
        )
       AND (
         cardinality($7::text[]) = 0 OR
         (
           SELECT COUNT(*)
           FROM unnest($7::text[]) AS p(pattern)
           WHERE
             COALESCE(venues.name, '') ILIKE p.pattern OR
             COALESCE(venues.description, '') ILIKE p.pattern OR
             COALESCE(place_categories.name, '') ILIKE p.pattern OR
             COALESCE(place_categories.description, '') ILIKE p.pattern
         ) > 0
       )
     ORDER BY category_focus_score DESC, focus_score DESC, match_score DESC, random()
     LIMIT $2`,
    [searchPatterns, limit, strongPatterns, focusPatterns, categoryPatterns, intentPatterns, hardIntentPatterns]
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    address: row.address,
    category: row.category_name || '',
    description: row.description || '',
    ward_name: row.ward_name || ''
  }));
}

async function getRandomVenues(limit = RESULT_LIMIT) {
  const result = await pool.query(
    `SELECT
       venues.id,
       COALESCE(NULLIF(venues.name, ''), venues.title) AS name,
       venues.address,
       venues.description,
       wards.name AS ward_name,
       place_categories.name AS category_name
     FROM venues
     LEFT JOIN wards ON wards.ward_id = venues.ward_id
     LEFT JOIN place_categories ON place_categories.id = venues.category_id
     WHERE venues.status = 'approved'
     ORDER BY random()
     LIMIT $1`,
    [limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    address: row.address,
    category: row.category_name || '',
    description: row.description || '',
    ward_name: row.ward_name || ''
  }));
}

// ================== 🔥 CHAT CORE ==================
async function generateReply(client, message, venues = [], chatHistory = [], runtimeContextPrompt = '') {
  if (!client) return { reply: 'ừ nói mình nghe thử 😄', suggestedVenueNames: [] };

  const noVenueNameRule = venues && venues.length
    ? ''
    : '\n- KHÔNG nêu tên quán cụ thể nếu không có danh sách VENUES trong context.';

  const systemPrompt = `
Bạn KHÔNG phải AI. Bạn là một người bạn thân, nói chuyện thân mật, ngắn gọn và tự nhiên.

QUY TẮC NGẮN (BẮT BUỘC):
- Trả lời 1-2 câu, KHÔNG xuống dòng, TỐI ĐA 120 ký tự.
- Bắt đầu bằng 1 opener ngắn (chọn NGẪU NHIÊN): "ừ", "nè", "ok", "hmm", "ừm", "nè nè".
- Dùng từ thân mật: ừ, nè, nha, á, haha; có thể dùng emoji.
- KHÔNG dùng cụm: "bạn có thể", "dưới đây", "gợi ý cho bạn", "Dưới đây là".
- KHÔNG liệt kê bullet hoặc nhiều dòng.
- TRÁNH lặp câu hoặc cấu trúc giống nhau giữa các lần trả lời; hãy biến tấu ngôn ngữ (ví dụ thay đổi vị trí câu, dùng biểu cảm khác, rút gọn hoặc chuyển đổi câu).
- Nếu danh sách địa điểm không phù hợp thì KHÔNG gợi ý.
${noVenueNameRule}
${runtimeContextPrompt}

OUTPUT FORMAT (BẮT BUỘC):
Trả lời PHẢI LÀ MỘT CHUỖI JSON duy nhất (KHÔNG kèm giải thích) với 2 trường:
1) "reply": chuỗi văn bản tự nhiên (1-2 câu) — nội dung hiển thị cho user, thân mật và đa dạng.
2) "suggested_venues": mảng tên quán (tối đa 2 tên) — CHỈ dùng tên từ VENUES được cung cấp trong context.

Ví dụ OUTPUT JSON (các mẫu khác nhau để giảm dập khuôn):
{"reply":"ừm, nóng quá, ghé ăn kem cho mát nha 😄","suggested_venues":["Tiệm Kem Mát"]}
{"reply":"nè, muốn cafe chill thì ghé Quán X nha","suggested_venues":["Quán X"]}
{"reply":"ok, tối nay hải sản thì thử Quán Nhậu 88 đi","suggested_venues":["Quán Nhậu 88"]}

Lưu ý: nếu không muốn gợi ý quán thì trả về "suggested_venues": [].
`;

  const venueContext = venues && venues.length
    ? { role: 'assistant', content: `VENUES: ${venues.map(v => v.name).slice(0, 10).join(', ')}` }
    : null;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(venueContext ? [venueContext] : []),
    ...buildChatHistory(chatHistory).slice(-6),
    { role: 'user', content: String(message) }
  ];

  let response;
  try {
    response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 1,
      top_p: 0.9,
      presence_penalty: 0.6,
      frequency_penalty: 0.4,
      max_tokens: 300,
      messages
    });
  } catch (err) {
    console.error('CHAT OPENAI ERROR:', err && err.stack ? err.stack : err);
    // Graceful fallback when OpenAI API fails (quota, network, etc.)
    return { reply: 'ừm, hiện tại mình chưa trả lời được, thử lại sau nha 😅', suggestedVenueNames: [] };
  }

  const content = response.choices?.[0]?.message?.content?.trim() || '';

  const parsed = parseJsonFromString(content);
  const parsedSuggested = parsed
    ? Array.isArray(parsed.suggested_venues)
      ? parsed.suggested_venues
      : Array.isArray(parsed.suggestedVenues)
      ? parsed.suggestedVenues
      : []
    : [];

  if (parsed && typeof parsed.reply === 'string') {
    return { reply: cleanReplyText(parsed.reply), suggestedVenueNames: parsedSuggested };
  }

  // Fallback: keep any extracted suggestions and clean visible text
  return { reply: cleanReplyText(content), suggestedVenueNames: parsedSuggested };
}

// ================== ROUTE ==================
router.post('/', async (req, res) => {
  try {
    const { message, chatHistory = [], latitude, longitude } = req.body;
    const requestLatitude = normalizeCoordinate(latitude, -90, 90);
    const requestLongitude = normalizeCoordinate(longitude, -180, 180);

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('CHAT: incoming message ->', String(message).slice(0,200));
    const client = getOpenAIClient();
    console.log('CHAT: OpenAI client present?', !!client);

    // Assistant detection removed from here — will run after suggestion-detection

    const runtimeContext = await resolveProjectRuntimeContext(req);
    const runtimeContextPrompt = buildRuntimeContextPromptFromProject(runtimeContext);
    const allowSuggest = shouldSuggest(message, chatHistory);
    const matchedFeatureGuide = findBestFeatureGuide(message);
    console.log('CHAT: allowSuggest =', allowSuggest);

    // --------- Assistant / Casual detection (runs only when NOT recommendation) ---------
    try {
      // Casual greeting quick replies (local only). Only match short greetings to avoid hijacking suggestion queries.
      const msgLen = String(message || '').trim().split(/\s+/).filter(Boolean).length;
      if (isCasualMessage(message) && msgLen <= 3) {
        return res.json({
          reply: buildCasualReply(message),
          venueResults: [],
          aiSuggestedNames: [],
          detectedCategory: null
        });
      }

      if (shouldReplyWithFeatureGuide(message, matchedFeatureGuide, allowSuggest)) {
        return res.json({
          reply: String(matchedFeatureGuide.guide),
          venueResults: [],
          aiSuggestedNames: [],
          detectedCategory: null
        });
      }

      // Only use deterministic system fallback when the message looks like a system-help request.
      if (!allowSuggest && looksLikeSystemAssistantRequest(message) && isAssistantQuestionMessage(message)) {
        // Generic assistant fallback (deterministic, local)
        return res.json({
          reply: 'Mình chưa hiểu rõ chức năng bạn muốn hỏi. Bạn nói cụ thể hơn như: đăng bài, merchant, map, upload ảnh, review, thông báo.',
          venueResults: [],
          aiSuggestedNames: [],
          detectedCategory: null
        });
      }
    } catch (e) {
      console.error('Assistant detection error:', e && e.stack ? e.stack : e);
      // fall through to existing behavior (do not block recommendations)
    }
    // ---------------------------------------------------------------------------

    if (allowSuggest) {
      const category = detectCategory(message, chatHistory);
      console.log('CHAT: detectedCategory =', category);

      let venueResults = [];
      if (category !== 'general') {
        let rawVenueResults = [];
        try {
          rawVenueResults = await getVenuesByCategory(category, Math.max(RESULT_LIMIT * 20, 100));
        } catch (e) {
          console.error('CHAT: getVenuesByCategory failed:', e && e.stack ? e.stack : e);
          // On DB/network errors, fallback to empty results so the route can return a friendly message instead of 500
          rawVenueResults = [];
        }
        const suggestionSeedText = buildSuggestionSeedText(message, chatHistory);
        const filteredVenueResults = filterVenuesByMessageIntent(suggestionSeedText, rawVenueResults || []);

        const desiredPrimary = 5;
        let primary = (filteredVenueResults && filteredVenueResults.length) ? filteredVenueResults.slice(0, desiredPrimary) : (rawVenueResults || []).slice(0, desiredPrimary);

        // fill primary from raw results if not enough
        if (primary.length < desiredPrimary && Array.isArray(rawVenueResults)) {
          for (const v of rawVenueResults) {
            if (primary.length >= desiredPrimary) break;
            if (!primary.find((p) => p.id === v.id)) primary.push(v);
          }
        }

        // price intent (if present in message)
        const priceRange = parsePriceRange(message);
        if (priceRange && (priceRange.min !== null || priceRange.max !== null || priceRange.tag)) {
          const primaryFilteredByPrice = filterVenuesByPrice(primary, priceRange);
          if (primaryFilteredByPrice && primaryFilteredByPrice.length) {
            primary = primaryFilteredByPrice;
          } else if (Array.isArray(rawVenueResults)) {
            const fills = filterVenuesByPrice(rawVenueResults.filter((v) => !primary.find((p) => p.id === v.id)), priceRange).slice(0, Math.max(0, desiredPrimary - primary.length));
            primary = primary.concat(fills);
          }
        }

        // weather-aware sorting/boost
        if (runtimeContext) {
          primary = sortVenuesByWeather(primary, runtimeContext);
        }

        // related venues (e.g., cafe -> dessert/kem)
        const relatedCount = 3;
        const related = findRelatedVenues(primary, rawVenueResults || [], suggestionSeedText, relatedCount);

        venueResults = [...primary.slice(0, desiredPrimary), ...related.slice(0, relatedCount)];
      }

      venueResults = prioritizeVenuesByDistance(
        venueResults,
        requestLatitude ?? runtimeContext?.latitude,
        requestLongitude ?? runtimeContext?.longitude
      ).slice(0, CHAT_SUGGESTION_LIMIT);
      console.log('CHAT: venueResults length =', (venueResults || []).length);

      if (!venueResults.length) {
        return res.json({
          reply: 'hmm cai nay minh chua co data phu hop luon, ban noi ro hon chut nha 😅',
          venueResults: [],
          aiSuggestedNames: [],
          detectedCategory: category
        });
      }

      const replyText = buildSafeSuggestionReply(venueResults.slice(0, CHAT_SUGGESTION_LIMIT));
      const suggestedNames = (venueResults || []).map((v) => v.name).slice(0, CHAT_SUGGESTION_LIMIT);

      return res.json({
        reply: replyText,
        venueResults,
        aiSuggestedNames: suggestedNames,
        detectedCategory: category
      });
    }

    const userContextIntent = detectUserContextIntent(message);
    if (userContextIntent) {
      const userContextPayload = await resolveUserContextPayload(req, userContextIntent);

      if (userContextPayload.requiresAuth) {
        return res.json({
          reply: 'Mình cần bạn đăng nhập trước để xem thông tin cá nhân này.',
          venueResults: [],
          aiSuggestedNames: [],
          detectedCategory: null
        });
      }

      const itemCount = Array.isArray(userContextPayload.data?.items)
        ? userContextPayload.data.items.length
        : 0;
      if (!userContextPayload.exists || (!userContextPayload.data && userContextIntent !== 'identity')) {
        return res.json({
          reply: 'Hiện tại mình chưa lấy được dữ liệu tương ứng trong hệ thống.',
          venueResults: [],
          aiSuggestedNames: [],
          detectedCategory: null
        });
      }

      if (['favorites', 'notifications', 'venues', 'reviews'].includes(userContextIntent) && itemCount === 0) {
        const emptyReplies = {
          favorites: 'Bạn chưa có mục yêu thích nào trong hệ thống.',
          notifications: 'Hiện tại bạn chưa có thông báo nào.',
          venues: 'Hiện tại bạn chưa có bài đăng địa điểm nào.',
          reviews: 'Hiện tại bạn chưa có review nào trong hệ thống.'
        };
        return res.json({
          reply: emptyReplies[userContextIntent] || 'Hiện tại chưa có dữ liệu tương ứng.',
          venueResults: [],
          aiSuggestedNames: [],
          detectedCategory: null
        });
      }

      const replyText = await generateHybridAssistantReply(client, message, chatHistory, {
        runtimeContextPrompt,
        userContextPayload,
        mode: 'user_context'
      });

      return res.json({
        reply: replyText,
        venueResults: [],
        aiSuggestedNames: [],
        detectedCategory: null
      });
    }

    const replyText = await generateHybridAssistantReply(client, message, chatHistory, {
      runtimeContextPrompt,
      mode: 'general'
    });
    console.log('CHAT: hybrid general reply ->', String(replyText).slice(0, 400));

    return res.json({
      reply: replyText,
      venueResults: [],
      aiSuggestedNames: []
    });
  } catch (err) {
    console.error('CHAT ROUTE ERROR:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'server lỗi 😅' });
  }
});

// Expose for local testing
router.generateReply = generateReply;

module.exports = router;
