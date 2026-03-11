import InteractiveWardMap from '../../map/components/InteractiveWardMap';
import SectionCard from '../../components/common/SectionCard';
import TagPill from '../../components/common/TagPill';
import useWardMapData from '../../hooks/useWardMapData';

function MerchantWorkbenchPage() {
  const { wards, venues, loading, saving, lastCreatedVenue, createVenue } = useWardMapData();

  return (
    <div className="page page-with-panels">
      <SectionCard
        eyebrow="Merchant journey"
        title="Venue onboarding studio"
        description="Day la khung merchant de team tiep tuc them form upload anh, menu, package ads va payment flow."
      >
        <InteractiveWardMap
          wards={wards}
          venues={venues}
          loading={loading}
          saving={saving}
          allowPinCreation
          onCreateVenue={createVenue}
          lastCreatedVenue={lastCreatedVenue}
          emptyLabel="Merchant flow can cung nguon ward GeoJSON va venues tu backend."
        />
      </SectionCard>

      <div className="two-column-grid">
        <SectionCard
          eyebrow="Merchant UI backlog"
          title="Frontend tasks"
          description="Cac phan nay chua can backend xong het van co the chia giao dien lam song song."
        >
          <div className="assignment-points">
            <TagPill>Venue profile form</TagPill>
            <TagPill>Gallery upload</TagPill>
            <TagPill>Menu editor</TagPill>
            <TagPill>Ads package picker</TagPill>
            <TagPill muted>Transaction history</TagPill>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Merchant backend backlog"
          title="API contracts to implement next"
          description="Dung the hien tai lam form contract truoc khi team backend Viet endpoint that."
        >
          <div className="assignment-points">
            <TagPill muted>POST /api/v1/merchant/venues</TagPill>
            <TagPill muted>POST /api/v1/merchant/uploads</TagPill>
            <TagPill muted>POST /api/v1/merchant/ads/orders</TagPill>
            <TagPill muted>GET /api/v1/merchant/analytics</TagPill>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default MerchantWorkbenchPage;
