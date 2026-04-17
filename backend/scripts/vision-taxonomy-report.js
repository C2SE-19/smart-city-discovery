const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    file: path.join(__dirname, '..', 'logs', 'vision-taxonomy-eval.log'),
    days: 7,
    target: 'all'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--file' && argv[i + 1]) {
      args.file = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === '--days' && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.days = parsed;
      }
      i += 1;
      continue;
    }

    if (token === '--target' && argv[i + 1]) {
      const target = String(argv[i + 1] || '').trim().toLowerCase();
      if (['all', 'food', 'place', 'any'].includes(target)) {
        args.target = target;
      }
      i += 1;
      continue;
    }

    if (token === '--help' || token === '-h') {
      printHelpAndExit();
    }
  }

  return args;
}

function printHelpAndExit() {
  console.log('Usage: node scripts/vision-taxonomy-report.js [--file <path>] [--days <n>] [--target all|food|place|any]');
  console.log('Example: node scripts/vision-taxonomy-report.js --days 3 --target place');
  process.exit(0);
}

function safeParseJson(line) {
  try {
    const parsed = JSON.parse(line);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return '0.00%';
  }

  return `${(value * 100).toFixed(2)}%`;
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function incrementCounter(map, key) {
  const normalized = String(key || '').trim();
  if (!normalized) {
    return;
  }

  map.set(normalized, (map.get(normalized) || 0) + 1);
}

function printTopMap(title, map, limit = 8) {
  console.log(`\n${title}`);
  if (!map.size) {
    console.log('- (none)');
    return;
  }

  const ranked = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  ranked.forEach(([key, count]) => {
    console.log(`- ${key}: ${count}`);
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const resolvedFile = path.isAbsolute(args.file)
    ? args.file
    : path.resolve(process.cwd(), args.file);

  if (!fs.existsSync(resolvedFile)) {
    console.log('=== Vision Taxonomy Report ===');
    console.log(`Log file: ${resolvedFile}`);
    console.log(`Window: last ${args.days} day(s)`);
    console.log(`Target filter: ${args.target}`);
    console.log('\nSummary');
    console.log('- No log file found yet.');
    console.log('- Send at least one /api/v1/vision/image-search request to generate logs.');
    process.exit(0);
  }

  const raw = fs.readFileSync(resolvedFile, 'utf8');
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const nowMs = Date.now();
  const lookbackMs = args.days * 24 * 60 * 60 * 1000;
  const minTimestampMs = nowMs - lookbackMs;

  const targetCounts = new Map();
  const labelCounts = new Map();
  const topVenueCounts = new Map();

  let totalLines = 0;
  let parsedLines = 0;
  let withinWindow = 0;
  let filteredByTarget = 0;

  let taxonomyApplied = 0;
  let taxonomyMatched = 0;
  let taxonomyUnknown = 0;
  let aiRerankApplied = 0;

  let taxonomyConfidenceSum = 0;
  let modelConfidenceSum = 0;

  lines.forEach((line) => {
    totalLines += 1;
    const entry = safeParseJson(line);
    if (!entry) {
      return;
    }

    parsedLines += 1;

    const ts = Date.parse(String(entry.timestamp || ''));
    if (!Number.isFinite(ts) || ts < minTimestampMs) {
      return;
    }

    withinWindow += 1;

    const target = String(entry.target || 'unknown').trim().toLowerCase();
    if (args.target !== 'all' && target !== args.target) {
      return;
    }

    filteredByTarget += 1;
    incrementCounter(targetCounts, target || 'unknown');

    const applied = Boolean(entry.taxonomyApplied);
    const matched = Boolean(entry.taxonomyMatched);

    if (applied) {
      taxonomyApplied += 1;
      taxonomyConfidenceSum += Number(entry.taxonomyConfidence || 0);
    }

    if (matched) {
      taxonomyMatched += 1;
      incrementCounter(labelCounts, entry.taxonomyLabelId || 'unknown');
    }

    if (applied && !matched) {
      taxonomyUnknown += 1;
    }

    if (entry.aiRerankApplied) {
      aiRerankApplied += 1;
    }

    modelConfidenceSum += Number(entry.modelConfidence || 0);
    incrementCounter(topVenueCounts, entry.firstVenueName || 'unknown');
  });

  const matchedRate = taxonomyApplied ? taxonomyMatched / taxonomyApplied : 0;
  const unknownRate = taxonomyApplied ? taxonomyUnknown / taxonomyApplied : 0;
  const rerankRate = filteredByTarget ? aiRerankApplied / filteredByTarget : 0;
  const avgTaxonomyConfidence = taxonomyApplied ? taxonomyConfidenceSum / taxonomyApplied : 0;
  const avgModelConfidence = filteredByTarget ? modelConfidenceSum / filteredByTarget : 0;

  console.log('=== Vision Taxonomy Report ===');
  console.log(`Log file: ${resolvedFile}`);
  console.log(`Window: last ${args.days} day(s)`);
  console.log(`Target filter: ${args.target}`);

  console.log('\nSummary');
  console.log(`- Total lines: ${totalLines}`);
  console.log(`- Parsed JSON lines: ${parsedLines}`);
  console.log(`- Entries in time window: ${withinWindow}`);
  console.log(`- Entries after target filter: ${filteredByTarget}`);
  console.log(`- Taxonomy applied: ${taxonomyApplied}`);
  console.log(`- Taxonomy matched: ${taxonomyMatched} (${formatPercent(matchedRate)})`);
  console.log(`- Taxonomy unknown: ${taxonomyUnknown} (${formatPercent(unknownRate)})`);
  console.log(`- AI rerank applied: ${aiRerankApplied} (${formatPercent(rerankRate)})`);
  console.log(`- Avg taxonomy confidence: ${round(avgTaxonomyConfidence, 4)}`);
  console.log(`- Avg model confidence: ${round(avgModelConfidence, 4)}`);

  printTopMap('Top targets', targetCounts, 5);
  printTopMap('Top matched taxonomy labels', labelCounts, 10);
  printTopMap('Top first venue names', topVenueCounts, 10);
}

main();
