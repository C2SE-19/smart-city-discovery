import { useParams } from 'react-router-dom';
import MerchantVenueEditForm from '../../features/merchant/components/MerchantVenueEditForm';
import anh1 from '../../assets/images/anh1.png';
import './MerchantWorkbench.css';

function MerchantWorkbenchEditPage() {
  const { venueId } = useParams();

  return (
    <div className="merchant-workbench-container">
      <div className="merchant-bg-container">
        <div
          className="merchant-bg-image"
          style={{ backgroundImage: `url(${anh1})` }}
        />
        <div className="merchant-bg-overlay" />
      </div>

      <div className="merchant-form-wrapper">
        <MerchantVenueEditForm editVenueId={venueId || null} />
      </div>
    </div>
  );
}

export default MerchantWorkbenchEditPage;
