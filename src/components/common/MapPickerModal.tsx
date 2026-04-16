import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Navigation, ChevronRight, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useFirebase } from '../../context/FirebaseContext';

function LocationMarker({ position, setPosition }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void }) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom());
    }
  }, [position, map]);

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

export const MapPickerModal = ({ 
  initialPos, 
  onSelect, 
  onClose 
}: { 
  initialPos: { lat: number, lng: number }, 
  onSelect: (lat: number, lng: number) => void, 
  onClose: () => void 
}) => {
  const { showToast } = useFirebase();
  const [position, setPosition] = useState<L.LatLng>(L.latLng(initialPos.lat, initialPos.lng));
  const [isLocating, setIsLocating] = useState(false);

  const handleGetCurrentLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      showToast('Trình duyệt của bạn không hỗ trợ định vị.', 'error');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = L.latLng(pos.coords.latitude, pos.coords.longitude);
        setPosition(newPos);
        setIsLocating(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        showToast('Không thể lấy vị trí hiện tại. Vui lòng kiểm tra quyền truy cập vị trí.', 'error');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[80vh]"
      >
        <div className="p-6 border-b border-modern-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-modern-900">Chọn vị trí</h3>
            <p className="text-xs text-modern-400 font-medium">Chạm vào bản đồ hoặc dùng định vị</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleGetCurrentLocation}
              disabled={isLocating}
              className="p-2 bg-modern-100 rounded-xl text-modern-500 hover:bg-modern-200 transition-colors disabled:opacity-50"
              title="Lấy vị trí hiện tại"
            >
              <Navigation size={20} className={isLocating ? "animate-pulse" : ""} />
            </button>
            <button onClick={onClose} className="p-2 bg-modern-100 rounded-xl text-modern-500">
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 relative">
          <MapContainer 
            center={[position.lat, position.lng]} 
            zoom={13} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker position={position} setPosition={setPosition} />
          </MapContainer>
          
          <div className="absolute bottom-6 left-6 right-6 z-[1000]">
            <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/40 mb-4">
              <div className="flex items-center gap-4 text-xs font-bold text-modern-600">
                <div className="flex-1">
                  <span className="text-modern-400 uppercase tracking-widest block mb-1">Vĩ độ</span>
                  {position.lat.toFixed(6)}
                </div>
                <div className="w-px h-8 bg-modern-200" />
                <div className="flex-1">
                  <span className="text-modern-400 uppercase tracking-widest block mb-1">Kinh độ</span>
                  {position.lng.toFixed(6)}
                </div>
              </div>
            </div>
            <button 
              onClick={() => onSelect(position.lat, position.lng)}
              className="w-full blue-gradient text-white py-4 rounded-2xl font-bold shadow-xl shadow-modern-500/20 active:scale-95 transition-transform"
            >
              Xác nhận vị trí này
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
