import { useDeferredValue, useEffect, useState } from 'react';

import SectionCard from '../../components/common/SectionCard';
import TagPill from '../../components/common/TagPill';
import useWardMapData from '../../hooks/useWardMapData';
import InteractiveWardMap from '../../components/map/InteractiveWardMap';
import { fetchPlaceCategories } from '../../services/api/placeCategoriesApi';

function DiscoveryPage() {
  const { wards, venues, loading, error } = useWardMapData();
  const [selectedWardName, setSelectedWardName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [placeCategories, setPlaceCategories] = useState([]);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    async function loadPlaceCategories() {
      try {
        const categories = await fetchPlaceCategories();
        setPlaceCategories(categories.filter((category) => category.is_active !== false));
      } catch {
        setPlaceCategories([]);
      }
    }

    loadPlaceCategories();
  }, []);

  const visibleVenues = venues.filter((venue) => {
    const wardName = venue.ward_name || venue.wardName || '';
    const venueCategoryId = venue.category_id ?? venue.categoryId ?? null;
    const matchesWard = selectedWardName ? wardName === selectedWardName : true;
    const matchesCategory = selectedCategoryId ? String(venueCategoryId) === selectedCategoryId : true;
    const haystack = `${venue.name || ''} ${venue.address || ''} ${wardName}`.toLowerCase();

    return matchesWard && matchesCategory && haystack.includes(deferredSearchTerm.trim().toLowerCase());
  });

  return (
    <div className="page page-with-panels">
      <SectionCard
        eyebrow="User flow"
        title="Discovery workspace"
        description="Explore wards, filter by place categories, and browse approved venues on the map."
      >
        <div className="filter-bar">
          <input
            className="search-input"
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search venue name, address, or ward"
          />

          <select
            className="search-input"
            value={selectedCategoryId}
            onChange={(event) => setSelectedCategoryId(event.target.value)}
          >
            <option value="">All categories</option>
            {placeCategories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>

          <div className="filter-pills">
            <button
              className={`filter-pill ${selectedWardName ? '' : 'is-active'}`.trim()}
              onClick={() => setSelectedWardName('')}
              type="button"
            >
              All wards
            </button>

            {wards.map((ward) => (
              <button
                key={ward.ward_id}
                className={`filter-pill ${selectedWardName === ward.name ? 'is-active' : ''}`.trim()}
                onClick={() => setSelectedWardName(ward.name)}
                type="button"
              >
                {ward.name}
              </button>
            ))}
          </div>
        </div>

        <InteractiveWardMap
          wards={wards}
          venues={visibleVenues}
          loading={loading}
          selectedWardName={selectedWardName}
          emptyLabel="Wards and approved venues will appear here once map data is available."
        />
      </SectionCard>

      <div className="two-column-grid">
        <SectionCard
          eyebrow="Recommendation slot"
          title="Cho AI recommendation team"
          description="Frontend member co the lap tuc ghep card goi y vao khung nay khi backend contextual recommendation san sang."
        >
          <div className="assignment-points">
            <TagPill muted>Weather chip</TagPill>
            <TagPill muted>Time-of-day context</TagPill>
            <TagPill muted>User preference tags</TagPill>
            <TagPill muted>Reason to recommend</TagPill>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Visible venue list"
          title={`${visibleVenues.length} venues in the current view`}
          description={error || 'This list is filtered by ward, category, and search keyword.'}
        >
          <div className="venue-list">
            {visibleVenues.slice(0, 8).map((venue) => (
              <article key={venue.id || `${venue.name}-${venue.latitude}`} className="venue-row">
                <div>
                  <h3 className="venue-title">{venue.name}</h3>
                  <p className="venue-meta">{venue.address}</p>
                </div>
                <TagPill muted>
                  {venue.category_name || venue.categoryName || venue.ward_name || venue.wardName || 'Uncategorized'}
                </TagPill>
              </article>
            ))}

            {!visibleVenues.length ? <p className="empty-copy">No venues match the current filters.</p> : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default DiscoveryPage;
