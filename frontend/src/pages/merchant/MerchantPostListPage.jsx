import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import translations from '../../constants/translations';
import './MerchantPostList.css';

// Mock data for posts
const mockPosts = [
  {
    id: 1,
    name: 'Quán Mì Quảng Bà Bình',
    price: '40,000 - 80,000',
    rating: 4.7,
    reviews: 3,
    image: 'https://via.placeholder.com/200x150?text=Mì+Quảng'
  },
  {
    id: 2,
    name: 'Quán Cơm Tấm Sài Gòn',
    price: '30,000 - 60,000',
    rating: 4.5,
    reviews: 5,
    image: 'https://via.placeholder.com/200x150?text=Cơm+Tấm'
  }
];

function MerchantPostListPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language];
  const [posts, setPosts] = useState(mockPosts);
  const [searchTerm, setSearchTerm] = useState('');

  const handlePublishClick = () => {
    navigate('/merchant/workbench');
  };

  const handleEditPost = (postId) => {
    navigate(`/merchant/workbench/${postId}`);
  };

  const handleDeletePost = (postId) => {
    if (window.confirm(t.merchant.confirmDelete)) {
      setPosts(posts.filter(p => p.id !== postId));
    }
  };

  const filteredPosts = posts.filter(post =>
    post.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="merchant-post-list-container">
      {/* Header */}
      <div className="merchant-post-header">
        <div className="merchant-post-header-left">
          <div className="merchant-profile-section">
            <div className="merchant-profile-avatar">HN</div>
            <div className="merchant-profile-info">
              <h2>Nguyễn Hữu Lộc</h2>
              <div className="merchant-rating">
                <span className="merchant-stars">⭐ 4.7</span>
                <span className="merchant-reviews">(3 đánh giá)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="merchant-post-header-actions">
          <button 
            className="merchant-post-publish-btn"
            onClick={handlePublishClick}
          >
            {t.merchant.publish}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="merchant-post-tabs">
        <button className="merchant-tab active">{t.merchant.activeAll}</button>
        <button className="merchant-tab">{t.merchant.pending} (1)</button>
        <button className="merchant-tab">{t.merchant.rejected} (1)</button>
      </div>

      {/* Search */}
      <div className="merchant-post-search">
        <input
          type="text"
          placeholder={t.merchant.searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Posts List */}
      <div className="merchant-post-list">
        {filteredPosts.length > 0 ? (
          filteredPosts.map(post => (
            <div key={post.id} className="merchant-post-card">
              <img 
                src={post.image} 
                alt={post.name}
                className="merchant-post-image"
              />
              <div className="merchant-post-info">
                <h3>{post.name}</h3>
                <p className="merchant-post-price">{post.price}</p>
                <div className="merchant-post-rating">
                  <span className="merchant-post-stars">⭐ {post.rating}</span>
                  <span className="merchant-post-review-count">({post.reviews} {t.merchant.reviews})</span>
                </div>
              </div>
              <div className="merchant-post-actions">
                <button 
                  className="merchant-post-edit-btn"
                  onClick={() => handleEditPost(post.id)}
                >
                  {t.merchant.edit}
                </button>
                <button 
                  className="merchant-post-delete-btn"
                  onClick={() => handleDeletePost(post.id)}
                >
                  {t.merchant.delete}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="merchant-post-empty">
            <p>{t.merchant.noPostsFound}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MerchantPostListPage;
