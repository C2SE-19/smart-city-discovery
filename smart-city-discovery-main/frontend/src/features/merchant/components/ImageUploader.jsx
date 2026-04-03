import { useState } from 'react';
import '../styles/ImageUploader.css';

function ImageUploader({ maxImages = 6, onImagesChange }) {
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files);
    const remainingSlots = maxImages - images.length;

    if (files.length > remainingSlots) {
      alert(`You can only upload ${remainingSlots} more image(s). Maximum is ${maxImages}.`);
      return;
    }

    const newImages = [...images, ...files];
    setImages(newImages);

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews((prev) => [...prev, e.target.result]);
      };
      reader.readAsDataURL(file);
    });

    if (onImagesChange) {
      onImagesChange(newImages);
    }
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setImages(newImages);
    setPreviews(newPreviews);

    if (onImagesChange) {
      onImagesChange(newImages);
    }
  };

  return (
    <div className="image-uploader">
      <div 
        className="uploader-upload-zone"
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => e.preventDefault()}
        onClick={() => images.length < maxImages && document.getElementById('image-input').click()}
      >
        <input
          type="file"
          id="image-input"
          multiple
          accept="image/*"
          onChange={handleImageSelect}
          disabled={images.length >= maxImages}
          className="uploader-hidden-input"
        />
        <div className="uploader-placeholder">
          <div className="uploader-text">Click or drag images here</div>
          <div className="uploader-subtext">{images.length}/{maxImages} images • PNG, JPG up to 10MB</div>
        </div>
      </div>

      {images.length >= maxImages && (
        <div className="max-images-warning">
          ⓘ You've reached the maximum of {maxImages} images
        </div>
      )}

      {previews.length > 0 && (
        <div className="preview-section">
          <div className="preview-label">Uploaded Images</div>
          <div className="preview-count">{previews.length} of {maxImages} images</div>
          <div className="preview-grid">
            {previews.map((preview, index) => (
              <div key={index} className="preview-item">
                <img src={preview} alt={`Preview ${index + 1}`} className="preview-image" />
                <div className="preview-remove">
                  <button 
                    type="button" 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }} 
                    className="preview-remove-btn"
                    aria-label="Remove image"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageUploader;
