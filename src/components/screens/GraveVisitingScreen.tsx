import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Plus, 
  ChevronRight, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Upload, 
  Image as ImageIcon, 
  Music, 
  Mic, 
  Navigation, 
  Map as MapIcon,
  Search
} from 'lucide-react';
import { doc, collection, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
import { FAMILY_TREE_ID } from '../../constants';
import { useFirebase } from '../../context/FirebaseContext';
import { cn, handleFirestoreError, fileToBase64, compressImage } from '../../utils/firestore';
import { OperationType } from '../../types';
import { MapPickerModal } from '../common/MapPickerModal';

export const GraveVisitingScreen = () => {
  const { graves, showToast, isAdmin, user, refreshData } = useFirebase();
  const [selectedGrave, setSelectedGrave] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const filteredGraves = useMemo(() => {
    let result = graves;
    if (search) {
      const s = search.toLowerCase();
      result = graves.filter(g => 
        g.name.toLowerCase().includes(s) || 
        g.location.toLowerCase().includes(s) ||
        (g.notes && g.notes.toLowerCase().includes(s))
      );
    }
    return [...result].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [graves, search]);

  const gravesWithPreviews = useMemo(() => 
    filteredGraves.map(g => ({
      ...g,
      previewImg: g.media?.find((m: any) => m.type === 'image')?.url
    })),
    [filteredGraves]
  );

  const [newGrave, setNewGrave] = useState({ 
    name: '', 
    location: '', 
    lat: 21.0285, 
    lng: 105.8542, 
    audio: '', 
    audioUrl: '', 
    imageUrl: '', 
    notes: '',
    order: 1,
    media: [] as { type: 'image' | 'audio', url: string, name: string }[]
  });

  const handleSaveGrave = async () => {
    if (!user) {
      showToast('Vui lòng đăng nhập để thực hiện chức năng này.', 'error');
      return;
    }
    if (isSaving) return;
    setIsSaving(true);
    try {
      const graveData = {
        ...newGrave,
        familyTreeId: FAMILY_TREE_ID,
        order: parseInt(newGrave.order as any) || 1
      };
      if (isEditing && selectedGrave) {
        await updateDoc(doc(db, 'graveLocations', selectedGrave.id), graveData);
        setSelectedGrave({ ...selectedGrave, ...graveData });
      } else {
        await addDoc(collection(db, 'graveLocations'), graveData);
      }
      setIsAdding(false);
      setIsEditing(false);
      await refreshData(true);
      setNewGrave({ 
        name: '', 
        location: '', 
        lat: 21.0285, 
        lng: 105.8542, 
        audio: '', 
        audioUrl: '', 
        imageUrl: '', 
        notes: '',
        order: 1,
        media: []
      });
      showToast('Đã lưu thông tin tảo mộ thành công!', 'success');
      setSelectedGrave(null); // Exit to list after save
    } catch (error) {
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, 'graveLocations', showToast);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditGrave = () => {
    setNewGrave({
      name: selectedGrave.name || '',
      location: selectedGrave.location || '',
      lat: selectedGrave.lat || 21.0285,
      lng: selectedGrave.lng || 105.8542,
      audio: selectedGrave.audio || '',
      audioUrl: selectedGrave.audioUrl || '',
      imageUrl: selectedGrave.imageUrl || '',
      notes: selectedGrave.notes || '',
      order: selectedGrave.order || 1,
      media: selectedGrave.media || []
    });
    setIsEditing(true);
    setIsAdding(true);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'audio') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newMedia = [...newGrave.media];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Use 5MB as requested for audio, higher for images since we use Storage now
        const limitSize = type === 'audio' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
        const limitLabel = type === 'audio' ? '5MB' : '10MB';

        if (file.size > limitSize) {
          showToast(`Tệp "${file.name}" quá lớn (>${limitLabel}). Vui lòng chọn tệp nhỏ hơn.`, 'error');
          continue;
        }

        try {
          // Upload to Firebase Storage instead of storing as Base64 in Firestore
          // This allows files up to 5MB (Firestore document limit is 1MB)
          const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
          const storageRef = ref(storage, `graves/${FAMILY_TREE_ID}/${fileName}`);
          
          await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(storageRef);
          
          newMedia.push({ type, url: downloadURL, name: file.name });
        } catch (error) {
          console.error(`Error uploading file to storage:`, error);
          showToast(`Không thể tải tệp "${file.name}" lên. Vui lòng thử lại.`, 'error');
        }
      }
      setNewGrave({ ...newGrave, media: newMedia });
    } finally {
      setIsUploading(false);
    }
  };

  const removeMedia = (index: number) => {
    const newMedia = [...newGrave.media];
    newMedia.splice(index, 1);
    setNewGrave({ ...newGrave, media: newMedia });
  };

  const handleDeleteGrave = async (id: string) => {
    if (!user) {
      showToast('Vui lòng đăng nhập để thực hiện chức năng này.', 'error');
      return;
    }
    try {
      await deleteDoc(doc(db, 'graveLocations', id));
      await refreshData(true);
      setSelectedGrave(null);
      showToast('Đã xóa thông tin mộ thành công!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `graveLocations/${id}`, showToast);
    }
  };

  if (isAdding) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6 p-6 pb-24"
      >
        <header className="mt-8 flex items-center gap-4">
          <button onClick={() => { setIsAdding(false); setIsEditing(false); }} className="p-2 bg-modern-200 rounded-xl text-modern-700">
            <X size={20} />
          </button>
          <h1 className="text-2xl font-bold text-modern-900">{isEditing ? 'Sửa địa điểm' : 'Thêm địa điểm'}</h1>
        </header>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-modern-400 uppercase ml-1">Tên địa điểm</label>
              <input 
                type="text" 
                className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
                value={newGrave.name}
                onChange={(e) => setNewGrave({...newGrave, name: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-modern-400 uppercase ml-1">Thứ tự (Sắp xếp)</label>
              <input 
                type="number" 
                className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
                placeholder="Ví dụ: 1, 2, 3..."
                value={newGrave.order}
                onChange={(e) => setNewGrave({...newGrave, order: parseInt(e.target.value)})}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-modern-400 uppercase ml-1">Địa chỉ</label>
            <input 
              type="text" 
              className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
              value={newGrave.location}
              onChange={(e) => setNewGrave({...newGrave, location: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-modern-400 uppercase ml-1">Vị trí tọa độ</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowMapPicker(true)}
                className="flex-1 bg-white border border-modern-200 rounded-2xl p-4 flex items-center justify-between hover:bg-modern-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-modern-100 rounded-lg text-modern-500">
                    <MapPin size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-modern-900">Chọn trên bản đồ</p>
                    <p className="text-[10px] text-modern-400">
                      {newGrave.lat.toFixed(4)}, {newGrave.lng.toFixed(4)}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-modern-300" />
              </button>
              <button 
                onClick={() => {
                  if (!navigator.geolocation) {
                    showToast('Trình duyệt không hỗ trợ định vị.', 'error');
                    return;
                  }
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setNewGrave({ ...newGrave, lat: pos.coords.latitude, lng: pos.coords.longitude });
                      showToast('Đã cập nhật vị trí hiện tại!', 'success');
                    },
                    (err) => {
                      console.error(err);
                      showToast('Không thể lấy vị trí. Vui lòng kiểm tra quyền truy cập vị trí.', 'error');
                    },
                    { enableHighAccuracy: true }
                  );
                }}
                className="p-4 bg-modern-100 border border-modern-200 rounded-2xl text-modern-600 hover:bg-modern-200 transition-colors"
                title="Lấy vị trí hiện tại"
              >
                <Navigation size={20} />
              </button>
            </div>
          </div>

          {showMapPicker && (
            <MapPickerModal 
              initialPos={{ lat: newGrave.lat, lng: newGrave.lng }}
              onSelect={(lat, lng) => {
                setNewGrave({ ...newGrave, lat, lng });
                setShowMapPicker(false);
              }}
              onClose={() => setShowMapPicker(false)}
            />
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-modern-400 uppercase ml-1">Tải lên hình ảnh/âm thanh</label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-modern-200 rounded-2xl cursor-pointer hover:bg-modern-50 transition-colors">
                <ImageIcon size={24} className="text-modern-400" />
                <span className="text-[10px] font-bold uppercase text-modern-500">Thêm ảnh</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleMediaUpload(e, 'image')} />
              </label>
              <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-modern-200 rounded-2xl cursor-pointer hover:bg-modern-50 transition-colors">
                <Music size={24} className="text-modern-400" />
                <span className="text-[10px] font-bold uppercase text-modern-500">Thêm nhạc/Ghi âm</span>
                <input type="file" accept="audio/*" multiple className="hidden" onChange={(e) => handleMediaUpload(e, 'audio')} />
              </label>
            </div>
            {isUploading && (
              <div className="flex items-center gap-2 text-[10px] text-modern-500 font-bold animate-pulse mt-2">
                <Upload size={12} /> Đang xử lý tệp...
              </div>
            )}
          </div>

          {newGrave.media.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-modern-400 uppercase ml-1">Danh sách tệp đã chọn</label>
              <div className="space-y-2">
                {newGrave.media.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-modern-100 rounded-xl">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {item.type === 'image' ? <ImageIcon size={16} /> : <Music size={16} />}
                      <span className="text-xs font-medium truncate">{item.name}</span>
                    </div>
                    <button onClick={() => removeMedia(idx)} className="text-red-500 p-1">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={handleSaveGrave}
            disabled={isSaving || isUploading}
            className="w-full blue-gradient text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isSaving || isUploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {isSaving ? 'Đang lưu...' : isUploading ? 'Đang xử lý tệp...' : (isEditing ? 'Cập nhật & Thoát' : 'Lưu & Thoát')}
          </button>
        </div>
      </motion.div>
    );
  }

  if (selectedGrave) {
    const firstImage = selectedGrave.media?.find((m: any) => m.type === 'image')?.url;

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col pb-24 min-h-screen bg-white"
      >
        <div className="relative h-[40vh] w-full overflow-hidden">
          {firstImage ? (
            <img src={firstImage} alt={selectedGrave.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full blue-gradient" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/30" />
          
          <div className="absolute top-8 left-6 right-6 flex items-center justify-between">
            <button onClick={() => setSelectedGrave(null)} className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white border border-white/30 active:scale-95 transition-all">
              <X size={24} />
            </button>
            <div className="flex gap-2">
              {isAdmin && (
                <button 
                  onClick={handleEditGrave}
                  className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white border border-white/30 active:scale-95 transition-all"
                >
                  <Edit2 size={24} />
                </button>
              )}
              {isAdmin && (
                <button 
                  onClick={() => {
                    if (window.confirm('Bạn có chắc chắn muốn xóa địa điểm này?')) {
                      handleDeleteGrave(selectedGrave.id);
                    }
                  }}
                  className="p-3 bg-red-500/20 backdrop-blur-md rounded-2xl text-white border border-red-500/30 active:scale-95 transition-all"
                >
                  <Trash2 size={24} />
                </button>
              )}
            </div>
          </div>

          <div className="absolute bottom-8 left-6 right-6">
            <div className="mb-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-modern-900/90 backdrop-blur-md text-white rounded-full border border-white/20 shadow-xl shadow-black/20">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">Vị trí {selectedGrave.order || 1}</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-modern-900 mb-1">{selectedGrave.name}</h1>
            <p className="text-modern-600 flex items-center gap-2 font-medium">
              <MapPin size={18} className="text-modern-400" /> {selectedGrave.location}
            </p>
          </div>
        </div>

        <div className="px-6 space-y-8 -mt-4 relative z-10">
          <div className="flex flex-col gap-3">
            <a 
              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedGrave.lat},${selectedGrave.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full blue-gradient text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-modern-500/20 active:scale-95 transition-transform"
            >
              <MapIcon size={20} /> Chỉ đường Google Maps
            </a>
            <a 
              href={`geo:${selectedGrave.lat},${selectedGrave.lng}?q=${selectedGrave.lat},${selectedGrave.lng}(${encodeURIComponent(selectedGrave.name)})`}
              className="w-full bg-modern-100 text-modern-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 border border-modern-200 active:scale-95 transition-transform"
            >
              <Navigation size={20} /> Mở trong Bản đồ điện thoại
            </a>
          </div>

          {selectedGrave.media && selectedGrave.media.length > 0 && (
            <div className="space-y-8">
              {selectedGrave.media.some((m: any) => m.type === 'image') && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-modern-900">
                    <ImageIcon size={20} className="text-modern-500" />
                    Hình ảnh kỷ niệm
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedGrave.media.filter((m: any) => m.type === 'image').map((m: any, idx: number) => (
                      <motion.div 
                        key={idx} 
                        whileHover={{ scale: 1.02 }}
                        className="aspect-square rounded-[24px] overflow-hidden shadow-lg border-2 border-modern-50"
                      >
                        <img src={m.url} alt={m.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {selectedGrave.media.some((m: any) => m.type === 'audio') && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-modern-900">
                    <Music size={20} className="text-modern-500" />
                    Âm thanh kỷ niệm
                  </h3>
                  <div className="space-y-3">
                    {selectedGrave.media.filter((m: any) => m.type === 'audio').map((m: any, idx: number) => (
                      <div key={idx} className="glass-card rounded-2xl p-4 border border-modern-100">
                        <p className="text-xs font-bold text-modern-600 mb-3 truncate flex items-center gap-2">
                          <Mic size={14} /> {m.name}
                        </p>
                        <audio controls className="w-full h-10 custom-audio">
                          <source src={m.url} />
                        </audio>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="glass-card rounded-3xl overflow-hidden aspect-video relative shadow-inner border border-modern-100">
            <iframe 
              width="100%" 
              height="100%" 
              frameBorder="0" 
              style={{ border: 0 }}
              src={`https://www.google.com/maps?q=${selectedGrave.lat},${selectedGrave.lng}&z=15&output=embed`}
              allowFullScreen
            ></iframe>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 pb-24 bg-modern-50 min-h-screen">
      <header className="mt-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-modern-900">Tảo Mộ</h1>
        <div className="flex items-center gap-2">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsSearchVisible(!isSearchVisible)}
            className={cn(
              "p-3 rounded-2xl shadow-lg transition-all",
              isSearchVisible ? "bg-modern-200 text-modern-600" : "bg-white text-modern-400 shadow-modern-500/5"
            )}
          >
            <Search size={20} />
          </motion.button>
          {isAdmin && (
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsAdding(true)}
              className="blue-gradient text-white p-3 rounded-2xl shadow-lg shadow-modern-500/20"
            >
              <Plus size={20} />
            </motion.button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {isSearchVisible && (
          <motion.div 
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: 'auto', opacity: 1, marginBottom: 24 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            className="relative overflow-hidden"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-modern-400" size={18} />
              <input 
                type="text" 
                placeholder="Tìm kiếm địa điểm..."
                className="w-full bg-modern-100 border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-modern-400 transition-all outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5">
          {graves.length === 0 && (
            <div className="glass-card rounded-3xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-modern-100 rounded-full flex items-center justify-center mx-auto text-modern-300">
                <MapPin size={32} />
              </div>
              <p className="text-modern-400 font-medium">Chưa có địa điểm nào được thiết lập.</p>
              <button 
                onClick={() => setIsAdding(true)}
                className="text-modern-600 font-bold text-sm underline"
              >
                Thêm địa điểm ngay
              </button>
            </div>
          )}

          {graves.length > 0 && filteredGraves.length === 0 && (
            <div className="glass-card rounded-3xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-modern-100 rounded-full flex items-center justify-center mx-auto text-modern-300">
                <Search size={32} />
              </div>
              <p className="text-modern-400 font-medium">Không tìm thấy địa điểm nào phù hợp.</p>
            </div>
          )}
          {gravesWithPreviews.map((place) => {
            return (
              <motion.div 
                key={place.id} 
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedGrave(place)}
                className="relative h-56 rounded-[32px] overflow-hidden shadow-xl cursor-pointer group border-4 border-white"
              >
                {place.previewImg ? (
                  <img src={place.previewImg} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full blue-gradient opacity-90" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                
                <div className="absolute top-6 left-6 z-10">
                  <div className="bg-modern-900/80 backdrop-blur-xl text-white px-4 py-1.5 rounded-full text-[10px] font-black shadow-2xl border border-white/10 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                    Vị trí {place.order || 1}
                  </div>
                </div>

                <div className="absolute top-6 right-6 flex flex-col items-end gap-2">
                  <div className="flex gap-2">
                    {place.media?.some((m: any) => m.type === 'audio') && (
                      <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl text-white border border-white/20">
                        <Music size={16} />
                      </div>
                    )}
                    <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl text-white border border-white/20">
                      <ImageIcon size={16} />
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-6 left-6 right-6">
                  <h4 className="text-2xl font-bold text-white mb-1">{place.name}</h4>
                  <div className="flex items-center gap-2 text-white/70 text-sm font-medium">
                    <MapPin size={14} />
                    <span className="truncate">{place.location}</span>
                  </div>
                </div>
                
                <div className="absolute bottom-6 right-6 bg-white text-modern-900 p-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                  <ChevronRight size={20} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
