
import MerchantVenueForm from '../../features/merchant/components/MerchantVenueForm';
import anh1 from '../../assets/images/anh1.png';
import './MerchantWorkbench.css';

function MerchantWorkbenchPage() {
  return (
    <div className="merchant-workbench-container">
      {/* Background layer with image */}
      <div className="merchant-bg-container">
        <div 
          className="merchant-bg-image"
          style={{ backgroundImage: `url(${anh1})` }}
        />
        <div className="merchant-bg-overlay" />
      </div>

      {/* Form container */}
      <div className="merchant-form-wrapper">
        <MerchantVenueForm />
      </div>
    </div>
  );
}

export default MerchantWorkbenchPage;
