
import SectionCard from '../../components/common/SectionCard';
import TagPill from '../../components/common/TagPill';
import useWardMapData from '../../hooks/useWardMapData';

function AdminBoundaryPage() {
  const { wards, venues, loading, saving, error, lastCreatedVenue, createVenue } = useWardMapData();

  return (
    <div className="page page-with-panels">
      <SectionCard
        eyebrow="Admin GIS"
        title="Boundary control and venue approval workspace"
        description="Core demo GIS duoc giu o day: click map, tao venue, backend tu gan phuong bang Turf point-in-polygon."
      >
        <InteractiveWardMap
          wards={wards}
          venues={venues}
          loading={loading}
          saving={saving}
          allowPinCreation
          onCreateVenue={createVenue}
          lastCreatedVenue={lastCreatedVenue}
          emptyLabel="Can seed ward GeoJSON vao database de admin workspace hoat dong day du."
        />
      </SectionCard>

      <div className="two-column-grid">
        <SectionCard
          eyebrow="Admin module split"
          title="Sub-features for admin members"
          description="Moi card co the giao cho mot member frontend hoac backend tiep tuc chi tiet hoa."
        >
          <div className="assignment-points">
            <TagPill>GeoJSON import UI</TagPill>
            <TagPill>Boundary editor</TagPill>
            <TagPill>Pending venues queue</TagPill>
            <TagPill>Reports and moderation</TagPill>
            <TagPill muted>Revenue analytics</TagPill>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Current backend state"
          title="What is already connected"
          description={error || 'Backend da co wards list, venues list va create venue + detect ward.'}
        >
          <div className="assignment-points">
            <TagPill muted>GET /api/v1/wards</TagPill>
            <TagPill muted>GET /api/v1/venues</TagPill>
            <TagPill muted>POST /api/v1/venues</TagPill>
            <TagPill muted>POST /api/v1/gis/detect-ward</TagPill>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default AdminBoundaryPage;
