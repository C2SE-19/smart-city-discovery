import { useDeferredValue, useState } from 'react';
import InteractiveWardMap from '../../map/components/InteractiveWardMap';
import SectionCard from '../../components/common/SectionCard';
import TagPill from '../../components/common/TagPill';
import useWardMapData from '../../hooks/useWardMapData';

function DiscoveryPage() {
  const { wards, venues, loading, error } = useWardMapData();
  const [selectedWardName, setSelectedWardName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const visibleVenues = venues.filter((venue) => {
    const wardName = venue.ward_name || venue.wardName || '';
    const matchesWard = selectedWardName ? wardName === selectedWardName : true;
    const haystack = `${venue.name || ''} ${venue.address || ''} ${wardName}`.toLowerCase();

    return matchesWard && haystack.includes(deferredSearchTerm.trim().toLowerCase());
  });

  return (
    <div className="page page-with-panels">
      <SectionCard
        eyebrow="User flow"
        title="Discovery workspace"
        description="Trang nay la khung cho user module: map, ward filter, search, venue list va khu vuc recommendation."
      >
        <div className="filter-bar">
          <input
            className="search-input"
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tim theo ten quan, dia chi, ward"
          />

          <div className="filter-pills">
            <button
              className={`filter-pill ${selectedWardName ? '' : 'is-active'}`.trim()}
              onClick={() => setSelectedWardName('')}
              type="button"
            >
              Tat ca phuong
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
          emptyLabel="Can backend /api/v1/wards de hien polygon va /api/v1/venues de hien marker."
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
          description={error || 'Danh sach nay dung de frontend user team tiep tuc boc details, bookmark, review va report.'}
        >
          <div className="venue-list">
            {visibleVenues.slice(0, 8).map((venue) => (
              <article key={venue.id || `${venue.name}-${venue.latitude}`} className="venue-row">
                <div>
                  <h3 className="venue-title">{venue.name}</h3>
                  <p className="venue-meta">{venue.address}</p>
                </div>
                <TagPill muted>{venue.ward_name || venue.wardName || 'Ward pending'}</TagPill>
              </article>
            ))}

            {!visibleVenues.length ? <p className="empty-copy">Khong co venue khop bo loc hien tai.</p> : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default DiscoveryPage;
