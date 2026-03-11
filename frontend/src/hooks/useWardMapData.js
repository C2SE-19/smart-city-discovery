import { startTransition, useEffect, useState } from 'react';
import { fetchWards } from '../services/api/wardsApi';
import { createVenueRequest, fetchVenues } from '../services/api/venuesApi';

function useWardMapData() {
  const [wards, setWards] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastCreatedVenue, setLastCreatedVenue] = useState(null);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [wardData, venueData] = await Promise.all([fetchWards(), fetchVenues()]);
      setWards(wardData);
      setVenues(venueData);
    } catch (loadError) {
      setError(loadError.response?.data?.error || loadError.message || 'Khong tai duoc du lieu ban do.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createVenue(draftVenue) {
    setSaving(true);
    setError('');

    try {
      const created = await createVenueRequest(draftVenue);

      startTransition(() => {
        setVenues((currentVenues) => [created.venue, ...currentVenues]);
        setLastCreatedVenue(created);
      });

      return created;
    } catch (saveError) {
      const nextError = saveError.response?.data?.error || saveError.message || 'Khong luu duoc venue.';
      setError(nextError);
      throw saveError;
    } finally {
      setSaving(false);
    }
  }

  return {
    wards,
    venues,
    loading,
    saving,
    error,
    lastCreatedVenue,
    createVenue,
    reload: loadData
  };
}

export default useWardMapData;