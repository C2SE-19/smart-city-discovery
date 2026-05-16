import { useState } from 'react';
import useUserI18n from '../../../hooks/useUserI18n';
import '../styles/BusinessLicenseUploader.css';

function BusinessLicenseUploader({ onLicenseChange }) {
  const { tx } = useUserI18n();
  const [preview, setPreview] = useState(null);

  const handleLicenseSelect = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(tx('Please upload an image file'));
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert(tx('File size must be less than 15MB'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setPreview(loadEvent.target.result);
    };
    reader.readAsDataURL(file);

    if (onLicenseChange) {
      onLicenseChange(file);
    }
  };

  const removeLicense = () => {
    setPreview(null);

    if (onLicenseChange) {
      onLicenseChange(null);
    }
  };

  return (
    <div className="license-uploader">
      <div className="uploader-header">
        <h3>{tx('Business License')}</h3>
        <span className="required-badge">{tx('Required')}</span>
      </div>

      <div className="upload-area">
        <input
          type="file"
          id="license-input"
          accept="image/*"
          onChange={handleLicenseSelect}
          className="file-input"
        />
        <label htmlFor="license-input" className="upload-label">
          <div className="upload-icon">ðŸ“„</div>
          <p className="upload-text">{tx('Upload your business license')}</p>
          <p className="upload-hint">{tx('PNG, JPG up to 15MB • This field is required')}</p>
        </label>
      </div>

      {preview && (
        <div className="license-preview">
          <img src={preview} alt={tx('License preview')} className="preview-image" />
          <button type="button" onClick={removeLicense} className="remove-btn">
            {tx('✕ Remove')}
          </button>
        </div>
      )}
    </div>
  );
}

export default BusinessLicenseUploader;
