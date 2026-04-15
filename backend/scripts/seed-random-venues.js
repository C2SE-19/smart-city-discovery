require('dotenv').config();
const { Pool } = require('pg');

const DEFAULT_CENTER = { latitude: 16.0471, longitude: 108.2068 };
const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const NAME_PREFIXES = [
  'Urban', 'Golden', 'River', 'Coastal', 'Hidden', 'Sunrise', 'Moonlight', 'Lotus', 'Bamboo', 'Signature',
  'Heritage', 'Garden', 'Skyline', 'Corner', 'Harbor', 'Starlight', 'Blue', 'Green', 'Amber', 'Harmony'
];

const NAME_SUFFIXES = [
  'House', 'Hub', 'Spot', 'Garden', 'Station', 'Point', 'Place', 'District', 'Studio', 'Lounge',
  'Kitchen', 'Center', 'Market', 'Lane', 'Bar', 'Bistro', 'Nook', 'Depot', 'Terrace', 'Hall'
];

const STREET_NAMES = [
  'Tran Phu', 'Le Duan', 'Nguyen Van Linh', 'Vo Nguyen Giap', 'Pham Van Dong',
  'Bach Dang', 'Hai Phong', 'Hoang Dieu', 'Ngo Quyen', '2 Thang 9',
  'Ton Duc Thang', 'Dien Bien Phu', 'Le Loi', 'Nguyen Chi Thanh', 'Trieu Nu Vuong'
];

const CONTACT_DOMAINS = ['smartcity-demo.local', 'cityvenue-demo.local', 'explorecity.local'];

const BASE_SERVICES = [
  'WiFi', 'Parking', 'Card Payment', 'Family Friendly', 'Outdoor Seating',
  'Delivery', 'Takeaway', 'Reservations', 'Air Conditioning', 'Pet Friendly'
];

const CATEGORY_SERVICES = {
  restaurant: ['Dine-in', 'Set Menu', 'Group Booking', 'Private Room'],
  cafe: ['Specialty Coffee', 'Work-friendly Seating', 'All-day Drinks'],
  'street-food': ['Quick Service', 'Late Night', 'Budget-friendly'],
  bakery: ['Fresh Bakes', 'Custom Cakes', 'Morning Delivery'],
  bar: ['Signature Cocktails', 'Live Music', 'Happy Hour'],
  dessert: ['Seasonal Desserts', 'Ice Cream', 'Takeaway Box'],
  'local-market': ['Fresh Produce', 'Daily Deals', 'Local Goods']
};

const CATEGORY_KEYWORDS = {
  restaurant: ['meal', 'dinner', 'lunch', 'chef', 'menu'],
  cafe: ['coffee', 'espresso', 'tea', 'workspace', 'brunch'],
  'street-food': ['street', 'local', 'quick', 'snack', 'budget'],
  bakery: ['bread', 'pastry', 'cake', 'oven', 'sweet'],
  bar: ['cocktail', 'music', 'nightlife', 'drinks', 'social'],
  dessert: ['sweet', 'ice cream', 'pudding', 'cake', 'dessert'],
  'local-market': ['market', 'fresh', 'traditional', 'vendors', 'daily']
};

const CATEGORY_PRICE_PROFILES = {
  restaurant: { min: 80000, max: 280000 },
  cafe: { min: 35000, max: 120000 },
  'street-food': { min: 25000, max: 90000 },
  bakery: { min: 30000, max: 150000 },
  bar: { min: 120000, max: 420000 },
  dessert: { min: 35000, max: 180000 },
  'local-market': { min: 20000, max: 110000 },
  default: { min: 40000, max: 200000 }
};

const CATEGORY_IMAGE_LIBRARY = {
  restaurant: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80'
  ],
  cafe: [
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1459755486867-b55449bb39ff?auto=format&fit=crop&w=1200&q=80'
  ],
  'street-food': [
    'https://images.unsplash.com/photo-1559847844-d721426d6edc?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1532635241-17e820acc59f?auto=format&fit=crop&w=1200&q=80'
  ],
  bakery: [
    'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=80'
  ],
  bar: [
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1525268771113-32d9e9021a97?auto=format&fit=crop&w=1200&q=80'
  ],
  dessert: [
    'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=1200&q=80'
  ],
  'local-market': [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516594915697-87eb3b1c14ea?auto=format&fit=crop&w=1200&q=80'
  ],
  default: [
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1200&q=80'
  ]
};

function parseArgs(argv) {
  const args = {
    count: 120,
    perCategory: 0,
    imageCount: 4,
    dryRun: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();

    if ((token === '--count' || token === '-c') && argv[index + 1]) {
      args.count = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }

    if ((token === '--per-category' || token === '--perCategory') && argv[index + 1]) {
      args.perCategory = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }

    if ((token === '--image-count' || token === '--imageCount') && argv[index + 1]) {
      args.imageCount = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }

    if (token === '--dry-run' || token === '--dryRun') {
      args.dryRun = true;
    }
  }

  if (!Number.isInteger(args.count) || args.count <= 0) {
    args.count = 120;
  }

  if (!Number.isInteger(args.perCategory) || args.perCategory < 0) {
    args.perCategory = 0;
  }

  if (!Number.isInteger(args.imageCount) || args.imageCount < 2 || args.imageCount > 8) {
    args.imageCount = 4;
  }

  return args;
}

function shouldUseDatabaseSsl() {
  const sslValue = String(process.env.DB_SSL || process.env.PGSSLMODE || '').trim().toLowerCase();

  if (['false', '0', 'disable', 'off', 'no'].includes(sslValue)) {
    return false;
  }

  if (['true', '1', 'require', 'on', 'yes'].includes(sslValue)) {
    return true;
  }

  return false;
}

function buildDatabasePoolConfig() {
  const connectionString = String(process.env.DATABASE_URL || '').trim();
  const config = connectionString
    ? {
        connectionString,
      }
    : {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: String(process.env.DB_PASSWORD ?? ''),
        database: process.env.DB_NAME || 'postgres',
      };

  if (shouldUseDatabaseSsl()) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

function pickRandom(items) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

function sampleList(items, count) {
  if (!Array.isArray(items) || !items.length || count <= 0) {
    return [];
  }

  const copy = [...items];
  const sampled = [];

  while (copy.length && sampled.length < count) {
    const index = Math.floor(Math.random() * copy.length);
    sampled.push(copy.splice(index, 1)[0]);
  }

  return sampled;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, fixed = 6) {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(fixed));
}

function resolvePriceProfile(categorySlug) {
  return CATEGORY_PRICE_PROFILES[categorySlug] || CATEGORY_PRICE_PROFILES.default;
}

function extractCoordinates(value, collector) {
  if (!Array.isArray(value)) {
    return;
  }

  if (
    value.length >= 2
    && typeof value[0] === 'number'
    && Number.isFinite(value[0])
    && typeof value[1] === 'number'
    && Number.isFinite(value[1])
  ) {
    collector.push({ longitude: value[0], latitude: value[1] });
    return;
  }

  value.forEach((item) => extractCoordinates(item, collector));
}

function resolveWardCenter(wardRow) {
  if (!wardRow || typeof wardRow !== 'object') {
    return DEFAULT_CENTER;
  }

  const boundary = wardRow.boundary;
  const coordinates = [];

  if (boundary && typeof boundary === 'object') {
    if (boundary.type === 'FeatureCollection' && Array.isArray(boundary.features)) {
      boundary.features.forEach((feature) => extractCoordinates(feature?.geometry?.coordinates, coordinates));
    } else if (boundary.type === 'Feature') {
      extractCoordinates(boundary?.geometry?.coordinates, coordinates);
    } else if (boundary.coordinates) {
      extractCoordinates(boundary.coordinates, coordinates);
    }
  }

  if (!coordinates.length) {
    return DEFAULT_CENTER;
  }

  const sum = coordinates.reduce(
    (accumulator, item) => {
      accumulator.latitude += item.latitude;
      accumulator.longitude += item.longitude;
      return accumulator;
    },
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: Number((sum.latitude / coordinates.length).toFixed(6)),
    longitude: Number((sum.longitude / coordinates.length).toFixed(6)),
  };
}

function resolveVenueCoordinates(wardRow) {
  const center = resolveWardCenter(wardRow);
  return {
    latitude: randomFloat(center.latitude - 0.004, center.latitude + 0.004),
    longitude: randomFloat(center.longitude - 0.004, center.longitude + 0.004),
  };
}

function buildWeeklySchedule(openTime, closeTime) {
  const dayOff = pickRandom(['sunday', null]);

  return WEEK_DAYS.reduce((accumulator, dayKey) => {
    const isOff = dayOff && dayOff === dayKey;
    accumulator[dayKey] = {
      start: isOff ? 'OFF' : openTime,
      end: isOff ? 'OFF' : closeTime,
      off: Boolean(isOff),
    };
    return accumulator;
  }, {});
}

function resolveCategoryImages(categorySlug) {
  return CATEGORY_IMAGE_LIBRARY[categorySlug] || CATEGORY_IMAGE_LIBRARY.default;
}

function resolveCategoryServices(categorySlug) {
  return CATEGORY_SERVICES[categorySlug] || [];
}

function resolveCategoryKeywords(categorySlug) {
  return CATEGORY_KEYWORDS[categorySlug] || ['local', 'popular', 'community'];
}

function buildVenueRow({ category, ward, ownerUserId, index }) {
  const categorySlug = String(category.slug || '').trim().toLowerCase() || 'default';
  const categoryName = String(category.name || 'Place').trim();
  const wardName = String(ward?.name || 'City Center').trim();
  const wardId = String(ward?.ward_id || '').trim() || null;
  const prefix = pickRandom(NAME_PREFIXES) || 'Urban';
  const suffix = pickRandom(NAME_SUFFIXES) || 'Spot';
  const branchNo = randomInt(1, 99);
  const streetNo = randomInt(8, 199);
  const streetName = pickRandom(STREET_NAMES) || 'Main Street';

  const name = `${prefix} ${categoryName} ${suffix} ${branchNo}`.replace(/\s+/g, ' ').trim();
  const title = `${name} - ${wardName}`;
  const description = [
    `${name} is a seeded demo venue for ${categoryName} in ${wardName}.`,
    'It includes complete business details, operating hours, service tags and media links.',
    'This record was generated for testing recommendation, moderation and map discovery workflows.'
  ].join(' ');

  const profile = resolvePriceProfile(categorySlug);
  const minPrice = randomInt(profile.min, profile.max - Math.max(15000, Math.floor((profile.max - profile.min) * 0.3)));
  const maxPrice = randomInt(minPrice + 20000, profile.max);
  const openTime = pickRandom(['06:30', '07:00', '07:30', '08:00', '09:00']) || '08:00';
  const closeTime = pickRandom(['20:00', '21:00', '22:00', '23:00']) || '22:00';

  const imagePool = resolveCategoryImages(categorySlug);
  const selectedImages = sampleList(imagePool, Math.min(imagePool.length, 6));
  const coverImage = selectedImages[0] || pickRandom(CATEGORY_IMAGE_LIBRARY.default);
  const galleryImages = selectedImages.slice(1, 1 + 4);

  const categoryServices = resolveCategoryServices(categorySlug);
  const serviceCandidates = [...BASE_SERVICES, ...categoryServices];
  const selectedServices = sampleList(serviceCandidates, randomInt(4, 7));
  const selectedAmenities = sampleList([...BASE_SERVICES, 'Restroom', 'Motorbike Parking', 'Family Tables'], randomInt(3, 5));
  const selectedKeywords = sampleList(resolveCategoryKeywords(categorySlug), 4);
  const selectedHighlights = sampleList([
    'Popular with locals',
    'Convenient location',
    'Friendly staff',
    'Stable quality',
    'Fast service',
    'Good for groups',
    'Easy parking',
    'Worth trying'
  ], 3);

  const { latitude, longitude } = resolveVenueCoordinates(ward);
  const now = new Date();

  const metadata = {
    summary: `${categoryName} venue in ${wardName} with practical services and complete data profile.`,
    overview: description,
    introduction: description,
    minPrice,
    maxPrice,
    priceRange: `${minPrice.toLocaleString('en-US')} VND - ${maxPrice.toLocaleString('en-US')} VND`,
    startTime: openTime,
    endTime: closeTime,
    weeklySchedule: buildWeeklySchedule(openTime, closeTime),
    servicesOffered: selectedServices,
    selectedServiceNames: selectedServices,
    services: selectedServices,
    amenities: selectedAmenities,
    tags: selectedKeywords,
    keywords: selectedKeywords,
    features: selectedHighlights,
    highlights: selectedHighlights,
    galleryImages,
    imageUrls: galleryImages,
    coverImageUrl: coverImage,
    contactPhone: `+84 23${randomInt(1000, 9999)}${randomInt(1000, 9999)}`,
    website: `https://${slugify(name)}.${pickRandom(CONTACT_DOMAINS) || CONTACT_DOMAINS[0]}`,
    averageVisitMinutes: randomInt(45, 150),
    familyFriendly: true,
    parkingAvailable: true,
    petFriendly: Math.random() >= 0.5,
  };

  const slug = `${slugify(name)}-${String(now.getTime())}-${index}-${randomInt(1000, 9999)}`;
  const submittedByUserId = ownerUserId ? String(ownerUserId) : null;

  return {
    row: {
      name,
      title,
      slug,
      address: `${streetNo} ${streetName}, ${wardName}`,
      description,
      latitude,
      longitude,
      ward_id: wardId,
      category_id: Number(category.id),
      phone: metadata.contactPhone,
      cover_image_url: coverImage,
      business_license_image_url: null,
      metadata,
      status: 'approved',
      submitted_at: now,
      approved_at: now,
      updated_at: now,
      submitted_by_user_id: submittedByUserId,
    },
    images: [coverImage, ...galleryImages].filter(Boolean),
    categoryName,
    wardName,
  };
}

async function loadTableColumns(client, tableName) {
  const result = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `,
    [tableName]
  );

  return new Set(result.rows.map((row) => String(row.column_name)));
}

function buildInsertStatement(tableName, row, columns) {
  const keys = Object.keys(row).filter((key) => columns.has(key));

  if (!keys.length) {
    throw new Error(`No compatible columns found for table ${tableName}.`);
  }

  const placeholders = keys.map((_key, index) => `$${index + 1}`);
  const values = keys.map((key) => row[key]);

  const sql = `
    INSERT INTO ${tableName} (${keys.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING id
  `;

  return { sql, values };
}

async function tableExists(client, tableName) {
  const result = await client.query(`SELECT to_regclass($1) AS name`, [`public.${tableName}`]);
  return Boolean(result.rows[0]?.name);
}

function buildDistribution(categories, options) {
  const queue = [];

  if (options.perCategory > 0) {
    categories.forEach((category) => {
      for (let index = 0; index < options.perCategory; index += 1) {
        queue.push(category);
      }
    });
    return queue;
  }

  const total = Math.max(options.count, categories.length);
  const baseCount = Math.floor(total / categories.length);
  let remainder = total % categories.length;

  categories.forEach((category) => {
    const count = baseCount + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);

    for (let index = 0; index < count; index += 1) {
      queue.push(category);
    }
  });

  return queue;
}

async function main() {
  const options = parseArgs(process.argv);
  const pool = new Pool(buildDatabasePoolConfig());
  const client = await pool.connect();

  try {
    const categoriesResult = await client.query(
      `
        SELECT id, name, slug
        FROM place_categories
        WHERE COALESCE(is_active, true) = true
        ORDER BY COALESCE(sort_order, 0) ASC, id ASC
      `
    );

    const categories = categoriesResult.rows;
    if (!categories.length) {
      throw new Error('No active place categories found. Seed categories first, then re-run this script.');
    }

    const wardsResult = await client.query(
      `
        SELECT ward_id, name, boundary
        FROM wards
        WHERE COALESCE(is_active, true) = true
        ORDER BY name ASC
      `
    );

    const wards = wardsResult.rows;

    let ownerUsers = [];
    try {
      const usersResult = await client.query(
        `
          SELECT id
          FROM users
          WHERE COALESCE(status, 'active') = 'active'
          ORDER BY id ASC
          LIMIT 200
        `
      );
      ownerUsers = usersResult.rows.map((row) => row.id).filter(Boolean);
    } catch (_error) {
      ownerUsers = [];
    }

    const venueColumns = await loadTableColumns(client, 'venues');
    const hasVenueImagesTable = await tableExists(client, 'venue_images');
    const venueImageColumns = hasVenueImagesTable ? await loadTableColumns(client, 'venue_images') : new Set();

    const categoryQueue = buildDistribution(categories, options);
    const createdVenueIds = [];
    const createdByCategory = new Map();

    if (options.dryRun) {
      const preview = categoryQueue.slice(0, 3).map((category, index) => {
        const ward = wards.length ? pickRandom(wards) : null;
        const ownerUserId = ownerUsers.length ? pickRandom(ownerUsers) : null;
        return buildVenueRow({ category, ward, ownerUserId, index });
      });

      console.log('Dry run mode. No rows were inserted. Preview payloads:');
      console.log(JSON.stringify(preview, null, 2));
      return;
    }

    await client.query('BEGIN');

    for (let index = 0; index < categoryQueue.length; index += 1) {
      const category = categoryQueue[index];
      const ward = wards.length ? pickRandom(wards) : null;
      const ownerUserId = ownerUsers.length ? pickRandom(ownerUsers) : null;

      const venuePayload = buildVenueRow({ category, ward, ownerUserId, index });
      const venueInsert = buildInsertStatement('venues', venuePayload.row, venueColumns);
      const venueResult = await client.query(venueInsert.sql, venueInsert.values);

      const venueId = Number(venueResult.rows[0]?.id);
      if (!Number.isFinite(venueId) || venueId <= 0) {
        continue;
      }

      createdVenueIds.push(venueId);
      const categoryKey = String(category.name || 'Uncategorized');
      createdByCategory.set(categoryKey, (createdByCategory.get(categoryKey) || 0) + 1);

      if (hasVenueImagesTable && venueImageColumns.has('venue_id') && venueImageColumns.has('image_url')) {
        const imageRows = venuePayload.images.slice(0, Math.max(2, options.imageCount));

        for (let imageIndex = 0; imageIndex < imageRows.length; imageIndex += 1) {
          const imageRow = {
            venue_id: venueId,
            image_url: imageRows[imageIndex],
            image_type: imageIndex === 0 ? 'cover' : 'gallery',
            display_order: imageIndex,
            created_at: new Date(),
          };

          const imageInsert = buildInsertStatement('venue_images', imageRow, venueImageColumns);
          await client.query(imageInsert.sql, imageInsert.values);
        }
      }
    }

    await client.query('COMMIT');

    const summary = {
      insertedVenueCount: createdVenueIds.length,
      firstInsertedVenueId: createdVenueIds[0] || null,
      lastInsertedVenueId: createdVenueIds.length ? createdVenueIds[createdVenueIds.length - 1] : null,
      categoriesUsed: [...createdByCategory.entries()].map(([name, count]) => ({ name, count })),
      wardsAvailable: wards.length,
      ownersAvailable: ownerUsers.length,
    };

    console.log('Random venue seeding completed successfully.');
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackError) {
      // no-op
    }

    console.error('Random venue seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
