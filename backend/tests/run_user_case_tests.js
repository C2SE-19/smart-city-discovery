const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const MANIFEST = path.join(__dirname, 'user_case_manifest.json');
const OUT = path.join(__dirname, 'user_case_test_results.json');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function normalizeCat(c) {
  if (c === null || c === undefined) return null;
  return String(c || '').trim().toLowerCase();
}

function matchesExpected(expected, detected) {
  const e = normalizeCat(expected);
  const d = normalizeCat(detected);
  if (!e) return false;
  if (!d) return false;
  if (e === d) return true;

  const map = {
    dining: ['food','dining','restaurant','ăn','ăn gì','food'],
    snack: ['snack','street food','street_food','ăn vặt','snack','streetfood'],
    cafe: ['cafe','coffee','milk tea','tea','coffee shop','coffee shop','milk tea','milk_tea'],
    accommodation: ['accommodation','homestay','hotel','resort'],
    entertainment: ['entertainment','nightlife','market','place','fun','giải trí','vui chơi','entertainment'],
    travel: ['travel','scenic spot','check-in spot','check-in','checkin','view','scenic','travel'],
    shopping: ['shopping','shop','store','mua sắm','shop'],
    market: ['market','marketplace','chợ','cho','street food','street_food'],
    cinema: ['cinema','movie','rạp','rạp phim'],
    karaoke: ['karaoke'],
    gaming: ['gaming','net','quán net','quán net','game']
  };

  if (map[e] && map[e].includes(d)) return true;
  return false;
}

async function run() {
  if (!fs.existsSync(MANIFEST)) {
    console.error('Manifest not found:', MANIFEST);
    process.exit(2);
  }

  const items = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const results = [];

  for (const it of items) {
    const payload = { message: it.message, chatHistory: [] };
    const record = { id: it.id, message: it.message, expectedCategory: it.expectedCategory, startedAt: new Date().toISOString() };
    try {
      const res = await axios.post(`${BASE}/api/chat-v2`, payload, { timeout: 20000 });
      record.status = 'ok';
      record.responseStatus = res.status;
      record.reply = res.data && res.data.reply ? res.data.reply : null;
      record.detectedCategory = res.data && res.data.detectedCategory ? res.data.detectedCategory : null;
      record.venueCount = Array.isArray(res.data && res.data.venueResults) ? res.data.venueResults.length : null;
      record.match = matchesExpected(it.expectedCategory, record.detectedCategory);
    } catch (err) {
      record.status = 'error';
      record.error = err && err.message ? err.message : String(err);
      if (err.response && err.response.data) record.responseData = err.response.data;
    }

    record.endedAt = new Date().toISOString();
    results.push(record);
    await sleep(200);
  }

  fs.writeFileSync(OUT, JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, results }, null, 2), 'utf8');
  console.log('Done. Results saved to', OUT);
}

run().catch((e) => {
  console.error('Fatal runner error', e && e.stack ? e.stack : e);
  process.exit(1);
});
