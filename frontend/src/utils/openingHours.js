const DAY_ORDER = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const DAY_ALIASES = {
  mon: 'monday',
  monday: 'monday',
  tue: 'tuesday',
  tues: 'tuesday',
  tuesday: 'tuesday',
  wed: 'wednesday',
  wednesday: 'wednesday',
  thu: 'thursday',
  thur: 'thursday',
  thurs: 'thursday',
  thursday: 'thursday',
  fri: 'friday',
  friday: 'friday',
  sat: 'saturday',
  saturday: 'saturday',
  sun: 'sunday',
  sunday: 'sunday',
};

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

function normalizeDayKey(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return DAY_ALIASES[normalized] || '';
}

function parseTimeValue(value) {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function toMinutes(timeText) {
  const normalized = parseTimeValue(timeText);
  if (!normalized) {
    return null;
  }

  const [hourText, minuteText] = normalized.split(':');
  return Number(hourText) * 60 + Number(minuteText);
}

function parseRangeText(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  const upper = normalized.toUpperCase();
  if (upper === 'OFF' || upper === 'CLOSED') {
    return { off: true, open: '', close: '' };
  }

  const parts = normalized.split(/\s*-\s*/);
  if (parts.length !== 2) {
    return null;
  }

  const open = parseTimeValue(parts[0]);
  const close = parseTimeValue(parts[1]);
  if (!open || !close) {
    return null;
  }

  return { off: false, open, close };
}

function resolveRawScheduleSource(source) {
  if (!source) {
    return null;
  }

  if (Array.isArray(source?.weeklySchedule)) {
    return source.weeklySchedule;
  }

  if (source?.weeklySchedule && typeof source.weeklySchedule === 'object') {
    return source.weeklySchedule;
  }

  if (source?.opening_hours && typeof source.opening_hours === 'object') {
    return source.opening_hours;
  }

  if (source?.openingHours && typeof source.openingHours === 'object') {
    return source.openingHours;
  }

  if (source?.metadata && typeof source.metadata === 'object') {
    return resolveRawScheduleSource(source.metadata);
  }

  if (source?.weeklyOpenHours && typeof source.weeklyOpenHours === 'object') {
    return source.weeklyOpenHours;
  }

  if (Array.isArray(source)) {
    return source;
  }

  if (typeof source === 'object') {
    return source;
  }

  return null;
}

function resolveFallbackRange(source) {
  const directStart = parseTimeValue(source?.startTime);
  const directEnd = parseTimeValue(source?.endTime);
  if (directStart && directEnd && directStart < directEnd) {
    return { open: directStart, close: directEnd };
  }

  if (source?.metadata && typeof source.metadata === 'object') {
    return resolveFallbackRange(source.metadata);
  }

  return null;
}

function normalizeScheduleEntry(day, rawValue, fallbackRange = null) {
  if (typeof rawValue === 'string') {
    const parsedRange = parseRangeText(rawValue);
    if (parsedRange) {
      return {
        key: day.key,
        label: day.label,
        open: parsedRange.off ? 'OFF' : parsedRange.open,
        close: parsedRange.off ? 'OFF' : parsedRange.close,
        off: Boolean(parsedRange.off),
      };
    }
  }

  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    const off = Boolean(rawValue.off || rawValue.isClosed || rawValue.closed);
    const open = parseTimeValue(rawValue.start || rawValue.open || rawValue.openTime || rawValue.from);
    const close = parseTimeValue(rawValue.end || rawValue.close || rawValue.closeTime || rawValue.to);

    if (off || rawValue.start === 'OFF' || rawValue.end === 'OFF' || rawValue.open === 'OFF' || rawValue.close === 'OFF') {
      return {
        key: day.key,
        label: day.label,
        open: 'OFF',
        close: 'OFF',
        off: true,
      };
    }

    if (open && close) {
      return {
        key: day.key,
        label: day.label,
        open,
        close,
        off: false,
      };
    }
  }

  if (fallbackRange?.open && fallbackRange?.close) {
    return {
      key: day.key,
      label: day.label,
      open: fallbackRange.open,
      close: fallbackRange.close,
      off: false,
    };
  }

  return {
    key: day.key,
    label: day.label,
    open: 'OFF',
    close: 'OFF',
    off: true,
  };
}

function normalizeWeeklySchedule(source) {
  const rawSource = resolveRawScheduleSource(source);
  const fallbackRange = resolveFallbackRange(source && typeof source === 'object' ? source : {});

  if (!rawSource && !fallbackRange) {
    return [];
  }

  if (Array.isArray(rawSource)) {
    const byDayKey = rawSource.reduce((result, item) => {
      const dayKey = normalizeDayKey(item?.key || item?.day || item?.label);
      if (!dayKey) {
        return result;
      }

      result[dayKey] = item;
      return result;
    }, {});

    return DAY_ORDER.map((day) => normalizeScheduleEntry(day, byDayKey[day.key], fallbackRange));
  }

  if (rawSource && typeof rawSource === 'object') {
    return DAY_ORDER.map((day) => {
      const rawValue = rawSource[day.key] || rawSource[day.key.slice(0, 3)] || rawSource[day.label] || rawSource[day.label.toLowerCase()];
      return normalizeScheduleEntry(day, rawValue, fallbackRange);
    });
  }

  return [];
}

function buildWindow(scheduleItem) {
  const startMinutes = toMinutes(scheduleItem?.open);
  const endMinutes = toMinutes(scheduleItem?.close);
  const isValid = !scheduleItem?.off && startMinutes !== null && endMinutes !== null;

  return {
    ...scheduleItem,
    startMinutes,
    endMinutes,
    isValid,
    isOvernight: isValid && endMinutes <= startMinutes,
  };
}

function getZonedNowSnapshot(now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const partMap = new Map(parts.map((part) => [part.type, part.value]));
  const todayKey = normalizeDayKey(partMap.get('weekday'));
  const hour = Number(partMap.get('hour'));
  const minute = Number(partMap.get('minute'));

  return {
    todayKey,
    nowMinutes: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0),
  };
}

function resolveMinutesUntilClose(nowMinutes, window) {
  if (!window?.isValid) {
    return null;
  }

  if (!window.isOvernight) {
    return window.endMinutes - nowMinutes;
  }

  if (nowMinutes < window.endMinutes) {
    return window.endMinutes - nowMinutes;
  }

  return (MINUTES_PER_DAY - nowMinutes) + window.endMinutes;
}

function isWindowOpen(nowMinutes, window) {
  if (!window?.isValid) {
    return false;
  }

  if (!window.isOvernight) {
    return nowMinutes >= window.startMinutes && nowMinutes < window.endMinutes;
  }

  return nowMinutes >= window.startMinutes || nowMinutes < window.endMinutes;
}

function formatCompactDuration(totalMinutes) {
  const normalized = Math.max(1, Math.floor(totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }

  if (hours) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

function formatWordDuration(totalMinutes) {
  const normalized = Math.max(1, Math.floor(totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const parts = [];

  if (hours) {
    parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  }

  if (minutes) {
    parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  }

  return parts.join(' ');
}

function findNextOpen(windows, todayIndex, nowMinutes) {
  for (let offset = 0; offset < windows.length; offset += 1) {
    const index = (todayIndex + offset) % windows.length;
    const window = windows[index];

    if (!window?.isValid) {
      continue;
    }

    if (offset === 0) {
      if (nowMinutes < window.startMinutes) {
        return {
          ...window,
          daysAway: 0,
          relativeDay: 'today',
          totalMinutesAway: window.startMinutes - nowMinutes,
        };
      }

      if (window.isOvernight && nowMinutes >= window.endMinutes && nowMinutes < window.startMinutes) {
        return {
          ...window,
          daysAway: 0,
          relativeDay: 'today',
          totalMinutesAway: window.startMinutes - nowMinutes,
        };
      }

      continue;
    }

    return {
      ...window,
      daysAway: offset,
      relativeDay: offset === 1 ? 'tomorrow' : 'later',
      totalMinutesAway: (MINUTES_PER_DAY - nowMinutes) + ((offset - 1) * MINUTES_PER_DAY) + window.startMinutes,
    };
  }

  return null;
}

function formatNextOpenPrimary(nextOpen) {
  if (!nextOpen) {
    return 'Closed';
  }

  if (nextOpen.daysAway === 0) {
    return `Closed · Opens at ${nextOpen.open}`;
  }

  if (nextOpen.daysAway === 1) {
    return `Closed · Opens at ${nextOpen.open} tomorrow`;
  }

  return `Closed · Opens ${nextOpen.label} at ${nextOpen.open}`;
}

function formatNextOpenSublabel(nextOpen) {
  if (!nextOpen) {
    return '';
  }

  if (nextOpen.daysAway === 0 && Number.isFinite(nextOpen.totalMinutesAway)) {
    return `Opens in ${formatWordDuration(nextOpen.totalMinutesAway)}`;
  }

  if (nextOpen.daysAway === 1) {
    return `Opens at ${nextOpen.open} tomorrow`;
  }

  return `Opens ${nextOpen.label} at ${nextOpen.open}`;
}

export function hasVenueOpeningHours(source) {
  return normalizeWeeklySchedule(source).some((item) => buildWindow(item).isValid);
}

export function getVenueOpenStatus(source, options = {}) {
  const timeZone = String(options.timeZone || source?.timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
  const showWhenUnknown = Boolean(options.showWhenUnknown);
  const weeklySchedule = normalizeWeeklySchedule(source);

  if (!weeklySchedule.length) {
    return {
      available: false,
      shouldRender: showWhenUnknown,
      isOpen: null,
      state: 'no_data',
      tone: 'unknown',
      primaryLabel: 'Hours unavailable',
      secondaryLabel: '',
      pulse: 'none',
    };
  }

  const zonedNow = getZonedNowSnapshot(new Date(), timeZone);
  const todayIndex = DAY_ORDER.findIndex((day) => day.key === zonedNow.todayKey);
  const effectiveTodayIndex = todayIndex >= 0 ? todayIndex : 0;
  const previousIndex = (effectiveTodayIndex - 1 + DAY_ORDER.length) % DAY_ORDER.length;
  const windows = weeklySchedule.map((item, index) => ({
    ...buildWindow(item),
    isToday: index === effectiveTodayIndex,
  }));
  const todayWindow = windows[effectiveTodayIndex];
  const previousWindow = windows[previousIndex];

  let activeWindow = null;
  if (previousWindow?.isValid && previousWindow.isOvernight && zonedNow.nowMinutes < previousWindow.endMinutes) {
    activeWindow = previousWindow;
  } else if (isWindowOpen(zonedNow.nowMinutes, todayWindow)) {
    activeWindow = todayWindow;
  }

  if (activeWindow) {
    const minutesUntilClose = resolveMinutesUntilClose(zonedNow.nowMinutes, activeWindow);
    const isClosingSoon = Number.isFinite(minutesUntilClose) && minutesUntilClose <= 30;

    return {
      available: true,
      shouldRender: true,
      isOpen: true,
      state: isClosingSoon ? 'closing_soon' : 'open',
      tone: isClosingSoon ? 'closing-soon' : 'open',
      primaryLabel: isClosingSoon
        ? `Closing soon · ${Math.max(1, Math.floor(minutesUntilClose))} minutes left`
        : `Open · Closes at ${activeWindow.close}`,
      secondaryLabel: isClosingSoon
        ? `Closes at ${activeWindow.close}`
        : `${formatCompactDuration(minutesUntilClose)} left`,
      pulse: isClosingSoon ? 'fast' : 'slow',
      currentDayKey: activeWindow.key,
      currentDayLabel: activeWindow.label,
      opensAt: activeWindow.open,
      closesAt: activeWindow.close,
      minutesUntilClose,
    };
  }

  const nextOpen = findNextOpen(windows, effectiveTodayIndex, zonedNow.nowMinutes);

  if (todayWindow?.isValid && zonedNow.nowMinutes < todayWindow.startMinutes) {
    return {
      available: true,
      shouldRender: true,
      isOpen: false,
      state: 'opens_later_today',
      tone: 'closed',
      primaryLabel: `Closed · Opens at ${todayWindow.open}`,
      secondaryLabel: `Opens in ${formatWordDuration(todayWindow.startMinutes - zonedNow.nowMinutes)}`,
      pulse: 'none',
      currentDayKey: todayWindow.key,
      currentDayLabel: todayWindow.label,
      opensAt: todayWindow.open,
      closesAt: todayWindow.close,
      minutesUntilOpen: todayWindow.startMinutes - zonedNow.nowMinutes,
      nextOpen,
    };
  }

  if (!todayWindow?.isValid) {
    return {
      available: true,
      shouldRender: true,
      isOpen: false,
      state: 'closed_today',
      tone: 'closed',
      primaryLabel: 'Closed today',
      secondaryLabel: formatNextOpenSublabel(nextOpen),
      pulse: 'none',
      currentDayKey: todayWindow?.key || null,
      currentDayLabel: todayWindow?.label || null,
      opensAt: '',
      closesAt: '',
      minutesUntilOpen: nextOpen?.totalMinutesAway ?? null,
      nextOpen,
    };
  }

  return {
    available: true,
    shouldRender: true,
    isOpen: false,
    state: 'closed',
    tone: 'closed',
    primaryLabel: formatNextOpenPrimary(nextOpen),
    secondaryLabel: formatNextOpenSublabel(nextOpen),
    pulse: 'none',
    currentDayKey: todayWindow.key,
    currentDayLabel: todayWindow.label,
    opensAt: todayWindow.open,
    closesAt: todayWindow.close,
    minutesUntilOpen: nextOpen?.totalMinutesAway ?? null,
    nextOpen,
  };
}
