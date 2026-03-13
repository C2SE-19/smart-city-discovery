import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import translations from '../../constants/translations';
import './OverviewPage.css';

const foodItems = [
  {
    id: 1,
    name: 'Shrimp Fried Rice',
    description:
      'Shrimp fried rice, with sliced carrots, peas, corn, and bell peppers.',
    price: 2.3,
    image:
      'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 2,
    name: 'Pork Satay, Grilled Pork',
    description:
      'Skewers of marinated pork grilled to perfection, resting in a peanut dip.',
    price: 2.23,
    image:
      'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 3,
    name: 'Papaya Salad',
    description:
      'A fresh combination of lime juice, fish sauce, palm sugar, and green papaya.',
    price: 2.32,
    image:
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 4,
    name: 'Pork Satay, Grilled Pork',
    description:
      'Tender skewers with roasted peanuts, cucumber, and a savory dipping sauce.',
    price: 2.23,
    image:
      'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80'
  }
];

const landscapeColumns = {
  left: [
    {
      id: 1,
      name: 'The Marble Mountains',
      description:
        'Five limestone peaks known for caves, pagodas, and panoramic views.',
      price: '1.50 USD',
      image:
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80'
    },
    {
      id: 2,
      name: 'Cham Sculpture Museum',
      description:
        'The largest collection of Cham sandstone sculpture in the world.',
      price: '2.30 USD',
      image:
        'https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=900&q=80'
    }
  ],
  featured: {
    id: 3,
    name: 'Dragon Bridge (Cau Rong)',
    description:
      'Iconic bridge in Da Nang, loved for its fire and water show every weekend.',
    price: '0.00 USD',
    image:
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=900&q=80'
  },
  right: [
    {
      id: 4,
      name: 'Golden Bridge (Ba Na Hills)',
      description:
        'A breathtaking bridge supported by giant hands at Sun World Ba Na Hills.',
      price: '37.00 USD',
      image:
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80'
    },
    {
      id: 5,
      name: 'Linh Ung Pagoda (Son Tra)',
      description:
        'A massive Lady Buddha statue offering stunning coastal views from the peninsula.',
      price: '0.00 USD',
      image:
        'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?auto=format&fit=crop&w=900&q=80'
    }
  ]
};

function FoodCard({ item, index }) {
  return (
    <article className={`overview-food-card overview-food-card-animate overview-food-card-${index}`}>
      <button type="button" className="overview-favorite" aria-label={`Save ${item.name}`} />

      <div className="overview-food-media">
        <img src={item.image} alt={item.name} className="overview-food-image" />
      </div>

      <div className="overview-food-body">
        <h3>{item.name}</h3>
        <p>{item.description}</p>

        <div className="overview-card-footer">
          <span>{item.price.toFixed(2)} USD</span>
          <button type="button" className="overview-add-button" aria-label={`Add ${item.name}`} />
        </div>
      </div>
    </article>
  );
}

function PlaceCard({ item }) {
  return (
    <article className="overview-place-card">
      <img src={item.image} alt={item.name} className="overview-place-image" />

      <div className="overview-place-body">
        <button type="button" className="overview-favorite" aria-label={`Save ${item.name}`} />
        <h3>{item.name}</h3>
        <p>{item.description}</p>

        <div className="overview-card-footer">
          <span>{item.price}</span>
          <button type="button" className="overview-add-button" aria-label={`Add ${item.name}`} />
        </div>
      </div>
    </article>
  );
}

function OverviewPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language];
  const [deliveryType, setDeliveryType] = useState('delivery');
  const [address, setAddress] = useState('');
  const [currentFoodIndex, setCurrentFoodIndex] = useState(0);
  const [direction, setDirection] = useState('right');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentWeather, setCurrentWeather] = useState(null);

  const handleNextFood = () => {
    setDirection('right');
    setCurrentFoodIndex((prev) => (prev + 1) % foodItems.length);
  };

  const handlePrevFood = () => {
    setDirection('left');
    setCurrentFoodIndex((prev) => (prev - 1 + foodItems.length) % foodItems.length);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setDirection('right');
      setCurrentFoodIndex((prev) => (prev + 1) % foodItems.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // retrieve user's location and (dummy) weather
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      // reverse geocode - replace with real service if available
      // here we'll just mock as Da Nang, Sơn Trà for demo
      setCurrentLocation('Da Nang, Sơn Trà');
      // weather fetch placeholder; you can call OpenWeatherMap or similar
      // const resp = await fetch(`https://api.weather.com/...${latitude},${longitude}`);
      // const data = await resp.json();
      // Use translated weather condition
      const weatherCondition = t.weather.sunny; // 'Sunny' or 'Năng' depending on language
      setCurrentWeather(`29°C, ${weatherCondition}`);
    });
  }, [language]);

  return (
    <div className="overview-page">
      <section className="overview-hero">
        <div className="overview-hero-visual">
          <div className="overview-hero-plate">
            <img
              src="https://media.discordapp.net/attachments/1480399002565349536/1481206693173137470/anh_myquang.png?ex=69b3ca3b&is=69b278bb&hm=106ee06cafe406d8b99a675fea25f705d570ea648443a19d7c29fba2b87ec3f6&=&format=webp&quality=lossless&width=988&height=859"
              alt="Asian food bowl"
              className="overview-hero-image"
            />
          </div>

          <div className="overview-hero-float overview-hero-float-top">
            <img
              src="https://images.unsplash.com/photo-1523906630133-f6934a1ab2b9?auto=format&fit=crop&w=400&q=80"
              alt="Dragon Bridge"
            />
          </div>

          <div className="overview-hero-float overview-hero-float-bottom-left">
            <img
              src="https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80"
              alt="Food side dish"
            />
          </div>

          <div className="overview-hero-float overview-hero-float-bottom-right">
            <img
              src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=80"
              alt="Ba Na Hills"
            />
          </div>
        </div>

        <button type="button" className="overview-hero-arrow" aria-label="Explore more" />

        <div className="overview-hero-copy">
          <p className="overview-hero-kicker">{t.hero.kicker}</p>
          <h1>
            {t.hero.title.split('<span>')[0]}
            <span>{t.hero.title.split('<span>')[1].split('</span>')[0]}</span>
            {t.hero.title.split('</span>')[1]}
          </h1>
          <p>
            {t.hero.description}
          </p>

          <div className="overview-hero-actions">
            <button 
              type="button" 
              className="overview-hero-button overview-hero-button-primary"
              onClick={() => navigate('/discovery')}
            >
              {t.hero.findByPictures}
            </button>
            <button 
              type="button" 
              className="overview-hero-button overview-hero-button-secondary"
              onClick={() => navigate('/merchant')}
            >
              {t.hero.merchant}
            </button>
          </div>
        </div>
      </section>

      <section className="overview-search">
        <div className="overview-search-top">
          <div className="overview-search-tabs" role="tablist" aria-label="Delivery type">
            <button
              type="button"
              className={`overview-search-tab ${deliveryType === 'delivery' ? 'is-active' : ''}`}
              onClick={() => setDeliveryType('delivery')}
            >
              {t.search.food}
            </button>
            <button
              type="button"
              className={`overview-search-tab ${deliveryType === 'pickup' ? 'is-active' : ''}`}
              onClick={() => setDeliveryType('pickup')}
            >
              {t.search.landscape}
            </button>
          </div>

          {currentLocation && currentWeather && (
            <div className="overview-location-info overview-location-inline">
              <span className="overview-location-text">{currentLocation}</span>
              <span className="overview-weather">
                {(currentWeather.includes(t.weather.sunny) || currentWeather.includes(t.weather.clear)) && '☀️'}
                {currentWeather.includes(t.weather.rainy) && '🌧️'}
                {currentWeather.includes(t.weather.cloudy) && '☁️'}
                {!(currentWeather.includes(t.weather.sunny) || currentWeather.includes(t.weather.clear) || currentWeather.includes(t.weather.rainy) || currentWeather.includes(t.weather.cloudy)) && '🌡️'}
                {currentWeather}
              </span>
            </div>
          )}
        </div>

        <div className="overview-search-row">
          <label className="overview-address-field">
            <span className="overview-address-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder=" "
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </label>

          <button type="button" className="overview-search-submit">
            {t.search.findFood}
          </button>
          {/* AI suggestion button */}
          <button
            type="button"
            className="overview-search-ai"
            aria-label={t.search.aiSuggest}
            onClick={() => alert('AI suggestion not implemented yet')}
          >
            {t.search.aiSuggest}
          </button>
        </div>
      </section>

      <section className="overview-section">
        <div className="overview-section-heading">
          <h2>{t.sections.food}</h2>
          <span />
        </div>

        <div className="overview-food-carousel">
          <button
            type="button"
            className="overview-carousel-nav overview-carousel-nav-prev"
            onClick={handlePrevFood}
            aria-label="Previous food items"
          >
            &#8249;
          </button>

          <div className={`overview-food-grid overview-food-grid-${direction}`}>
            {[0, 1, 2, 3].map((i) => {
              const itemIndex = (currentFoodIndex + i) % foodItems.length;
              return <FoodCard key={i} item={foodItems[itemIndex]} index={i} />;
            })}
          </div>

          <button
            type="button"
            className="overview-carousel-nav overview-carousel-nav-next"
            onClick={handleNextFood}
            aria-label="Next food items"
          >
            &#8250;
          </button>
        </div>

        <div className="overview-food-carousel-indicator">
          <div className="overview-food-progress-track">
            <div className="overview-food-progress-bar" />
          </div>
        </div>
      </section>

      <section className="overview-section">
        <div className="overview-section-heading">
          <h2>{t.sections.landscape}</h2>
          <span />
        </div>

        <div className="overview-places-layout">
          <div className="overview-places-column">
            {landscapeColumns.left.map((item) => (
              <PlaceCard key={item.id} item={item} />
            ))}
          </div>

          <article className="overview-featured-place">
            <div className="overview-featured-ring" />

            <button
              type="button"
              className="overview-favorite"
              aria-label={`Save ${landscapeColumns.featured.name}`}
            />

            <img
              src={landscapeColumns.featured.image}
              alt={landscapeColumns.featured.name}
              className="overview-featured-image"
            />

            <div className="overview-featured-body">
              <h3>{landscapeColumns.featured.name}</h3>
              <p>{landscapeColumns.featured.description}</p>

              <div className="overview-card-footer">
                <span>{landscapeColumns.featured.price}</span>
                <button
                  type="button"
                  className="overview-add-button"
                  aria-label={`Add ${landscapeColumns.featured.name}`}
                />
              </div>
            </div>
          </article>

          <div className="overview-places-column">
            {landscapeColumns.right.map((item) => (
              <PlaceCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="overview-section overview-map-section">
        <div className="overview-section-heading">
          <h2>{t.sections.maps}</h2>
          <span />
        </div>

        <div className="overview-map-frame">
          <iframe
            title="Da Nang map"
            src="https://www.google.com/maps?q=Da%20Nang%20Vietnam&z=12&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <a
          className="overview-map-link"
          href="https://www.google.com/maps/place/Da+Nang,+Vietnam/"
          target="_blank"
          rel="noreferrer"
        >
          View larger map
        </a>
      </section>
    </div>
  );
}

export default OverviewPage;
