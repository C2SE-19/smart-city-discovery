/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CompareContext = createContext(null);
const COMPARE_STORAGE_KEY = 'smartcity_compare_venues';
const MAX_COMPARE_ITEMS = 2;

function loadInitialCompareItems() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        const venueId = String(item?.id || item?.venueId || '').trim();
        if (!venueId) {
          return null;
        }

        return {
          id: venueId,
          name: String(item?.name || item?.title || 'Venue').trim() || 'Venue',
          address: String(item?.address || '').trim(),
          category: String(item?.category || item?.category_name || '').trim(),
          image: String(item?.image || item?.cover_image_url || item?.coverImageUrl || '').trim(),
          description: String(item?.description || '').trim(),
        };
      })
      .filter(Boolean)
      .slice(0, MAX_COMPARE_ITEMS);
  } catch {
    return [];
  }
}

function normalizeCompareVenue(venue) {
  const venueId = String(venue?.id || venue?.venueId || venue?.venue_id || '').trim();
  if (!venueId) {
    return null;
  }

  return {
    id: venueId,
    name: String(venue?.name || venue?.title || 'Venue').trim() || 'Venue',
    address: String(venue?.address || '').trim(),
    category: String(venue?.category_name || venue?.category || '').trim(),
    image: String(
      venue?.cover_image_url
      || venue?.coverImageUrl
      || venue?.venue_primary_image_url
      || venue?.image
      || ''
    ).trim(),
    description: String(venue?.description || '').trim(),
  };
}

export function CompareProvider({ children }) {
  const [compareVenues, setCompareVenues] = useState(loadInitialCompareItems);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(compareVenues));
  }, [compareVenues]);

  const api = useMemo(() => {
    const isCompared = (venueId) => compareVenues.some((item) => item.id === String(venueId || '').trim());

    const canAddMore = compareVenues.length < MAX_COMPARE_ITEMS;

    const addVenue = (venue) => {
      const normalized = normalizeCompareVenue(venue);
      if (!normalized) {
        return false;
      }

      let added = false;

      setCompareVenues((current) => {
        if (current.some((item) => item.id === normalized.id) || current.length >= MAX_COMPARE_ITEMS) {
          return current;
        }

        added = true;
        return [...current, normalized];
      });

      return added;
    };

    const removeVenue = (venueId) => {
      const normalizedId = String(venueId || '').trim();
      setCompareVenues((current) => current.filter((item) => item.id !== normalizedId));
    };

    const toggleVenue = (venue) => {
      const normalized = normalizeCompareVenue(venue);
      if (!normalized) {
        return { changed: false, active: false };
      }

      if (isCompared(normalized.id)) {
        removeVenue(normalized.id);
        return { changed: true, active: false };
      }

      if (!canAddMore) {
        return { changed: false, active: false };
      }

      const changed = addVenue(normalized);
      return { changed, active: changed };
    };

    const clearAll = () => {
      setCompareVenues([]);
    };

    return {
      compareVenues,
      maxItems: MAX_COMPARE_ITEMS,
      canAddMore,
      isCompared,
      addVenue,
      removeVenue,
      toggleVenue,
      clearAll,
    };
  }, [compareVenues]);

  return <CompareContext.Provider value={api}>{children}</CompareContext.Provider>;
}

export function useCompareVenues() {
  const context = useContext(CompareContext);
  if (!context) {
    throw new Error('useCompareVenues must be used within CompareProvider');
  }

  return context;
}
