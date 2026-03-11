import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Tooltip, Marker, Popup, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Sửa lỗi mất icon mặc định của thư viện React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

function MapClickHandler({ onMapClick }) {
  useMapEvents({

    },
  });
  return null;
}

function App() {
  const [wards, setWards] = useState([]);
  const [venues, setVenues] = useState([]); // Danh sách các quán ăn đã lưu
  const [newPin, setNewPin] = useState(null); // Tọa độ cái ghim mới đang chuẩn bị thả
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');

  // Lấy dữ liệu Phường và Quán ăn từ Backend khi mở trang
  useEffect(() => {
    // Lấy ranh giới phường
    axios.get('http://localhost:5000/api/wards').then(res => setWards(res.data));
    // Lấy danh sách quán ăn cũ (nếu có)
    axios.get('http://localhost:5000/api/venues').then(res => setVenues(res.data));
  }, []);

  // Hàm xử lý khi Admin bấm nút "Lưu" trên bản đồ
  const handleSaveVenue = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/venues', {
        name: venueName || 'Địa điểm chưa đặt tên',
        address: venueAddress || 'Chưa có địa chỉ',
        latitude: newPin.lat,
        longitude: newPin.lng
      });
      
      alert(`🎉 BINGO! Đã lưu thành công.\n🤖 Trí tuệ nhân tạo (AI) nhận diện địa điểm này nằm ở: ${response.data.thuật_toán_nhận_diện}`);
      
      // Cập nhật lại danh sách điểm ghim trên bản đồ
      setVenues([...venues, response.data.dữ_liệu]);
      setNewPin(null); // Cất cái ghim tạm đi
      setVenueName('');
      setVenueAddress('');
    } catch (error) {
      alert('Lỗi khi lưu: ' + error.message);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>🗺️ Hệ Thống Quản Lý Bản Đồ (Admin Panel)</h2>
      <p>Click vào bất kỳ đâu trên bản đồ để thả ghim và thêm địa điểm mới</p>
      
      <div style={{ height: '70vh', width: '100%', border: '2px solid #ccc', borderRadius: '8px' }}>
        <MapContainer center={[16.035, 108.218]} zoom={14} style={{ height: '100%', width: '100%' }}>
          
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {/* Lắng nghe cú click chuột của Admin */}
          <MapClickHandler onMapClick={(latlng) => setNewPin(latlng)} />

          {/* Vẽ ranh giới Phường */}
          {wards.map((ward) => (
            <GeoJSON key={ward.ward_id} data={ward.boundary} style={{ color: 'blue', weight: 2, fillOpacity: 0.1 }}>
              <Tooltip permanent direction="center">
                <span style={{ fontWeight: 'bold', color: 'blue' }}>{ward.name}</span>
              </Tooltip>
            </GeoJSON>
          ))}

          {/* Vẽ các quán ăn đã có trong Database */}
          {venues.map((v) => (
            <Marker key={v.id} position={[v.latitude, v.longitude]}>
              <Popup>
                <strong>{v.name}</strong> <br/> 
                {v.address}
              </Popup>
            </Marker>
          ))}

          {/* Hộp thoại thả ghim điểm mới */}
          {newPin && (
            <Marker position={[newPin.lat, newPin.lng]}>
              <Popup>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <strong>📍 Thêm địa điểm mới</strong>
                  <input 
                    type="text" placeholder="Tên quán (VD: Cơm tấm Bà X)" 
                    value={venueName} onChange={(e) => setVenueName(e.target.value)}
                  />
                  <input 
                    type="text" placeholder="Địa chỉ" 
                    value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)}
                  />
                  <button onClick={handleSaveVenue} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '5px', cursor: 'pointer' }}>
                    Lưu vào Hệ thống
                  </button>
                </div>
              </Popup>
            </Marker>
          )}

        </MapContainer>
      </div>
    </div>
  );
}

export default App;