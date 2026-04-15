import { useState } from 'react';
import '../styles/ImageUploader.css';

function ImageUploader({ maxImages = 6, onImagesChange, allowSetCover = true }) {
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Failed to read file: ${file?.name || 'unknown'}`));
      reader.readAsDataURL(file);
    });

  const handleImageSelect = async (event) => {
    const files = Array.from(event.target.files);
    const remainingSlots = maxImages - images.length;

    if (files.length > remainingSlots) {
      alert(`You can only upload ${remainingSlots} more image(s). Maximum is ${maxImages}.`);
      return;
    }

    if (!files.length) {
      return;
    }

    const newImages = [...images, ...files];

    try {
      const nextPreviews = await Promise.all(files.map((file) => readFileAsDataUrl(file)));

      setImages(newImages);
      setPreviews((prev) => [...prev, ...nextPreviews]);

      if (onImagesChange) {
        onImagesChange(newImages);
      }
    } catch (error) {
      alert(error.message || 'Could not read selected images. Please try again.');
    }

    event.target.value = '';
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

  const setCoverImage = (index) => {
    if (index <= 0 || index >= images.length) {
      return;
    }

    const selectedImage = images[index];
    const reorderedImages = [selectedImage, ...images.filter((_, imageIndex) => imageIndex !== index)];

    const selectedPreview = previews[index];
    const reorderedPreviews = [selectedPreview, ...previews.filter((_, previewIndex) => previewIndex !== index)];

    setImages(reorderedImages);
    setPreviews(reorderedPreviews);

    if (onImagesChange) {
      onImagesChange(reorderedImages);
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
                {index === 0 ? <span className="preview-cover-badge">Cover</span> : null}
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

                <div className="preview-actions">
                  {index === 0 ? (
                    <span className="preview-cover-label">Cover image</span>
                  ) : !allowSetCover ? (
                    <span className="preview-cover-label preview-cover-label-locked">Cover locked</span>
                  ) : (
                    <button
                      type="button"
                      className="preview-set-cover-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        setCoverImage(index);
                      }}
                    >
                      Set Cover
                    </button>
                  )}
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
