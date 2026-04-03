import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { fetchVenues } from '../../services/api/venuesApi';
import { APP_ROUTES } from '../../constants/routes';
import { useAuth } from '../../contexts/AuthContext';
import './WardPage.css';

function WardPage() {
  const { wardName } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const apiUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
    []
  );
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [favoriteKeys, setFavoriteKeys] = useState(new Set());

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchVenues();
        if (!mounted) return;
        const filtered = Array.isArray(data)
          ? data.filter((item) => (item.ward_name || item.wardName) === wardName)
          : [];
        setVenues(filtered);
      } catch {
        if (mounted) setVenues([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [wardName]);

  useEffect(() => {
    if (!token) {
      setFavoriteKeys(new Set());
      return;
    }

    let cancelled = false;
    async function loadFavorites() {
      try {
        const response = await axios.get(`${apiUrl}/users/favorites`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (cancelled) return;
        const next = new Set(
          (response.data?.favorites || []).map((item) => `${item.itemType}:${item.itemId}`)
        );
        setFavoriteKeys(next);
      } catch {
        if (!cancelled) setFavoriteKeys(new Set());
      }
    }

    loadFavorites();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, token]);

  const isFavorite = (id) => favoriteKeys.has(`place:${id}`);

  const handleToggleFavorite = async (event, venue) => {
    event.stopPropagation();
    event.preventDefault();
    if (!token) {
      navigate('/login');
      return;
    }

    const key = `place:${venue.id}`;
    setFavoriteKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

    try {
      const response = await axios.post(
        `${apiUrl}/users/favorites/toggle`,
        {
          itemId: venue.id,
          itemType: 'place',
          name: venue.name,
          image: venue.cover_image_url || venue.coverImageUrl,
          price: venue.metadata?.priceLabel,
          description: venue.address
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setFavoriteKeys((prev) => {
        const next = new Set(prev);
        if (response.data?.favorited) next.add(key);
        else next.delete(key);
        return next;
      });
    } catch (err) {
      console.error('Toggle favorite failed', err);
      setFavoriteKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const categories = useMemo(() => {
    const set = new Set();
    venues.forEach((v) => {
      const c = v.category_name || v.categoryName || v.metadata?.category_name;
      if (c) set.add(c);
    });
    return Array.from(set);
  }, [venues]);

  const visible = useMemo(() => {
    if (categoryFilter === 'all') return venues;
    return venues.filter((v) => (v.category_name || v.categoryName || v.metadata?.category_name) === categoryFilter);
  }, [categoryFilter, venues]);

  return (
    <div className="ward-page">
      <div className="ward-breadcrumb">
        <Link to={APP_ROUTES.HOME}>Home</Link>
        <span>/</span>
        <span>{wardName}</span>
      </div>

      <div className="ward-header">
        <div>
          <p className="ward-count">{venues.length} địa điểm trong</p>
          <h1>{wardName}</h1>
        </div>
        <div className="ward-filter">
          <label htmlFor="categoryFilter">Danh mục</label>
          <select
            id="categoryFilter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">- Danh mục -</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="ward-status">Loading...</p>
      ) : !visible.length ? (
        <p className="ward-status">Chưa có địa điểm trong phường này.</p>
      ) : (
        <div className="ward-grid">
          {visible.map((item) => (
            <article key={item.id} className="ward-card" onClick={() => navigate(`/venues/${item.id}`, { state: { venue: item } })}>
              <div className="ward-card-media">
                <img src={item.cover_image_url || item.coverImageUrl || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80'} alt={item.name} />
                <button
                  type="button"
                  className={`ward-card-heart ${isFavorite(item.id) ? 'is-active' : ''}`}
                  aria-pressed={isFavorite(item.id)}
                  aria-label={isFavorite(item.id) ? 'Unfavorite' : 'Favorite'}
                  onClick={(e) => handleToggleFavorite(e, item)}
                >
                  {isFavorite(item.id) ? '♥' : '♡'}
                </button>
              </div>
              <div className="ward-card-body">
                <h3>{item.name}</h3>
                <p className="ward-card-address">{item.address}</p>
                <div className="ward-card-row">
                  <span className="ward-chip">{item.ward_name || item.wardName}</span>
                  <span className="ward-chip muted">{item.category_name || item.categoryName || 'Food'}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default WardPage;
