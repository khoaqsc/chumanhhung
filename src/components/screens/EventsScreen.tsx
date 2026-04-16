import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Plus, 
  X, 
  Save, 
  ArrowLeft, 
  Info,
  ChevronRight,
  Search
} from 'lucide-react';
import { doc, collection, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { FAMILY_TREE_ID } from '../../constants';
import { useFirebase } from '../../context/FirebaseContext';
import { cn, handleFirestoreError } from '../../utils/firestore';
import { OperationType } from '../../types';

const getEventTypeColor = (type: string) => {
  switch (type) {
    case 'Lễ': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Giỗ': return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'Hội': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    default: return 'bg-blue-100 text-blue-700 border-blue-200';
  }
};

export const EventsScreen = () => {
  const { 
    events, 
    members, 
    selectedEventId, 
    setSelectedEventId, 
    selectedMemberId, 
    setSelectedMemberId, 
    selectedSpouseIndex,
    setSelectedSpouseIndex,
    setActiveTab, 
    showToast, 
    isAdmin, 
    user,
    refreshData
  } = useFirebase();
  const [isAdding, setIsAdding] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [search, setSearch] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', type: 'Lễ', description: '' });

  // Helper to parse DD/MM/YYYY or YYYY-MM-DD
  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/').map(Number);
      return new Date(y || new Date().getFullYear(), m - 1, d);
    }
    return new Date(dateStr);
  };

  // Derived events from member death dates (Ngày giỗ)
  const deathAnniversaries = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const currentYear = now.getFullYear();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    const anniversaries: any[] = [];

    members.forEach(m => {
      // 1. Check member themselves
      if (m.deathDate) {
        const dDate = parseDate(m.deathDate);
        if (dDate) {
          const anniversary = new Date(currentYear, dDate.getMonth(), dDate.getDate());
          let targetAnniversary = anniversary;
          const diff = anniversary.getTime() - now.getTime();
          if (diff < -oneWeek) {
            targetAnniversary = new Date(currentYear + 1, dDate.getMonth(), dDate.getDate());
          } else if (diff > 365 * 24 * 60 * 60 * 1000 - oneWeek) {
            targetAnniversary = new Date(currentYear - 1, dDate.getMonth(), dDate.getDate());
          }

          if (Math.abs(targetAnniversary.getTime() - now.getTime()) <= oneWeek) {
            let relationship = '';
            if (m.gender === 'Nữ' && m.spouse) {
              relationship = ` (Vợ ông ${m.spouse})`;
            } else if (m.fatherName) {
              relationship = ` (Con ông ${m.fatherName})`;
            }

            anniversaries.push({
              id: `giỗ-${m.id}`,
              memberId: m.id,
              title: `Ngày giỗ: ${m.name}${relationship}`,
              date: `${targetAnniversary.getFullYear()}-${String(targetAnniversary.getMonth() + 1).padStart(2, '0')}-${String(targetAnniversary.getDate()).padStart(2, '0')}`,
              type: 'Giỗ',
              description: `Ngày giỗ của ${m.name}. Mất ngày ${m.deathDate}.`,
              isAuto: true
            });
          }
        }
      }

      // 2. Check extraSpouses
      if (m.extraSpouses && Array.isArray(m.extraSpouses)) {
        m.extraSpouses.forEach((spouse, idx) => {
          if (spouse.deathDate) {
            const dDate = parseDate(spouse.deathDate);
            if (dDate) {
              const anniversary = new Date(currentYear, dDate.getMonth(), dDate.getDate());
              let targetAnniversary = anniversary;
              const diff = anniversary.getTime() - now.getTime();
              if (diff < -oneWeek) {
                targetAnniversary = new Date(currentYear + 1, dDate.getMonth(), dDate.getDate());
              } else if (diff > 365 * 24 * 60 * 60 * 1000 - oneWeek) {
                targetAnniversary = new Date(currentYear - 1, dDate.getMonth(), dDate.getDate());
              }

              if (Math.abs(targetAnniversary.getTime() - now.getTime()) <= oneWeek) {
                const rel = m.gender === 'Nam' ? 'Vợ' : 'Chồng';
                const honorific = m.gender === 'Nam' ? 'ông' : 'bà';
                
                anniversaries.push({
                  id: `giỗ-spouse-${m.id}-${idx}`,
                  memberId: m.id,
                  spouseIndex: idx,
                  title: `Ngày giỗ: ${spouse.name} (${rel} ${honorific} ${m.name})`,
                  date: `${targetAnniversary.getFullYear()}-${String(targetAnniversary.getMonth() + 1).padStart(2, '0')}-${String(targetAnniversary.getDate()).padStart(2, '0')}`,
                  type: 'Giỗ',
                  description: `Ngày giỗ của ${spouse.name}. Mất ngày ${spouse.deathDate}.`,
                  isAuto: true
                });
              }
            }
          }
        });
      }
    });

    return anniversaries;
  }, [members]);

  const handleEventClick = (event: any) => {
    if (event.isAuto && event.memberId) {
      setSelectedMemberId(event.memberId);
      if (event.spouseIndex !== undefined) {
        setSelectedSpouseIndex(event.spouseIndex);
      } else {
        setSelectedSpouseIndex(null);
      }
      setActiveTab('tree');
    } else {
      setSelectedEventId(event.id);
    }
  };

  const allEvents = useMemo(() => [...events, ...deathAnniversaries], [events, deathAnniversaries]);

  const filteredEvents = useMemo(() => {
    if (!search) return allEvents;
    const s = search.toLowerCase();
    return allEvents.filter(e => 
      e.title.toLowerCase().includes(s) || 
      e.type.toLowerCase().includes(s) ||
      (e.description && e.description.toLowerCase().includes(s))
    );
  }, [allEvents, search]);

  const getEventStatus = (dateStr: string) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Parse YYYY-MM-DD as local date to avoid timezone shifts
    const [y, m, d] = dateStr.split('-').map(Number);
    const eventDate = new Date(y, m - 1, d);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate.getTime() === now.getTime()) return 'ongoing';
    if (eventDate.getTime() > now.getTime()) return 'upcoming';
    return 'past';
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'ongoing': return 'bg-red-50 border-red-200 text-red-700 shadow-red-100';
      case 'upcoming': return 'bg-blue-50 border-blue-200 text-blue-700 shadow-blue-100';
      case 'past': return 'bg-gray-50 border-gray-200 text-gray-500 shadow-gray-50';
      default: return 'bg-white border-modern-100 text-modern-900';
    }
  };

  const sortedEvents = useMemo(() => 
    [...filteredEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [filteredEvents]
  );

  const ongoingEvents = useMemo(() => 
    sortedEvents.filter(e => getEventStatus(e.date) === 'ongoing'),
    [sortedEvents]
  );

  const upcomingEvents = useMemo(() => 
    sortedEvents.filter(e => getEventStatus(e.date) === 'upcoming'),
    [sortedEvents]
  );

  const pastEvents = useMemo(() => 
    sortedEvents.filter(e => getEventStatus(e.date) === 'past').reverse(),
    [sortedEvents]
  );

  const selectedEvent = useMemo(() => 
    events.find(e => e.id === selectedEventId),
    [events, selectedEventId]
  );

  useEffect(() => {
    if (selectedEventId && selectedEvent) {
      setNewEvent({ title: selectedEvent.title, date: selectedEvent.date, type: selectedEvent.type, description: selectedEvent.description || '' });
      setIsAdding(true);
    } else if (!selectedEventId) {
      setIsAdding(false);
      setIsViewing(false);
      setNewEvent({ title: '', date: '', type: 'Lễ', description: '' });
    }
  }, [selectedEventId, selectedEvent]);

  const handleSave = async () => {
    if (!user) {
      showToast('Vui lòng đăng nhập để thực hiện chức năng này.', 'error');
      return;
    }
    try {
      const eventData = {
        ...newEvent,
        familyTreeId: FAMILY_TREE_ID
      };
      if (selectedEventId) {
        await updateDoc(doc(db, 'events', selectedEventId), eventData);
      } else {
        await addDoc(collection(db, 'events'), eventData);
      }
      setIsAdding(false);
      await refreshData(true);
      setSelectedEventId(null);
      setNewEvent({ title: '', date: '', type: 'Lễ', description: '' });
      showToast('Đã lưu sự kiện thành công!', 'success');
    } catch (error) {
      handleFirestoreError(error, selectedEventId ? OperationType.UPDATE : OperationType.CREATE, 'events', showToast);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) {
      showToast('Vui lòng đăng nhập để thực hiện chức năng này.', 'error');
      return;
    }
    try {
      await deleteDoc(doc(db, 'events', id));
      await refreshData(true);
      setSelectedEventId(null);
      showToast('Đã xóa sự kiện thành công!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${id}`, showToast);
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
          <button onClick={() => { setIsAdding(false); setSelectedEventId(null); }} className="p-2 bg-modern-200 rounded-xl text-modern-700">
            <X size={20} />
          </button>
          <h1 className="text-2xl font-bold text-modern-900">{selectedEventId ? 'Sửa sự kiện' : 'Thêm sự kiện'}</h1>
        </header>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-modern-400 uppercase ml-1">Tiêu đề</label>
            <input 
              type="text" 
              className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
              value={newEvent.title}
              onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-modern-400 uppercase ml-1">Ngày</label>
              <input 
                type="date" 
                className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
                value={newEvent.date}
                onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-modern-400 uppercase ml-1">Loại</label>
              <select 
                className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none"
                value={newEvent.type}
                onChange={(e) => setNewEvent({...newEvent, type: e.target.value})}
              >
                <option>Lễ</option>
                <option>Giỗ</option>
                <option>Hội</option>
                <option>Khác</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-modern-400 uppercase ml-1">Mô tả</label>
            <textarea 
              className="w-full bg-white border border-modern-200 rounded-2xl p-4 focus:ring-2 focus:ring-modern-400 outline-none min-h-[100px]"
              value={newEvent.description}
              onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
            />
          </div>
          <button 
            onClick={handleSave}
            className="w-full blue-gradient text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            <Save size={18} /> Lưu & Thoát
          </button>
        </div>
      </motion.div>
    );
  }

  if (isViewing && selectedEvent) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col gap-6 p-6 pb-24"
      >
        <header className="mt-8 flex items-center justify-between">
          <button onClick={() => { setIsViewing(false); setSelectedEventId(null); }} className="p-2 bg-modern-200 rounded-xl text-modern-700">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-modern-900">Chi tiết sự kiện</h1>
          <div className="w-10" />
        </header>

        <div className="glass-card rounded-[2rem] overflow-hidden shadow-2xl shadow-modern-900/10">
          <div className="blue-gradient p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-10 transform translate-x-1/4 -translate-y-1/4">
              <Calendar size={120} />
            </div>
            <div className="relative z-10">
              <span className={cn(
                "inline-block text-[10px] font-bold px-3 py-1 rounded-full border border-white/30 bg-white/10 mb-4",
              )}>
                {selectedEvent.type}
              </span>
              <h2 className="text-3xl font-bold leading-tight mb-2">{selectedEvent.title}</h2>
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Calendar size={16} />
                <span>{selectedEvent.date}</span>
              </div>
            </div>
          </div>
          
          <div className="p-8 space-y-6 bg-white">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-modern-400">
                <Info size={16} />
                <h3 className="text-xs font-bold uppercase tracking-widest">Nội dung sự kiện</h3>
              </div>
              <p className="text-modern-700 leading-relaxed text-lg whitespace-pre-wrap">
                {selectedEvent.description || 'Không có mô tả chi tiết cho sự kiện này.'}
              </p>
            </div>

            <div className="pt-6 border-t border-modern-100">
              <button 
                onClick={() => { setIsViewing(false); setSelectedEventId(null); }}
                className="w-full py-4 bg-modern-900 text-white rounded-2xl font-bold active:scale-95 transition-transform"
              >
                Quay lại danh sách
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 pb-24 bg-modern-50 min-h-screen">
      <header className="mt-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-modern-900">Sự Kiện</h1>
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
              onClick={() => { setSelectedEventId(null); setIsAdding(true); }}
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
                placeholder="Tìm kiếm sự kiện..."
                className="w-full bg-modern-100 border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-modern-400 transition-all outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-8">
        {allEvents.length === 0 && (
          <div className="glass-card rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-modern-100 rounded-full flex items-center justify-center mx-auto text-modern-300">
              <Calendar size={32} />
            </div>
            <p className="text-modern-400 font-medium">Chưa có sự kiện nào được thiết lập.</p>
            {isAdmin && (
              <button 
                onClick={() => setIsAdding(true)}
                className="text-modern-600 font-bold text-sm underline"
              >
                Thêm sự kiện ngay
              </button>
            )}
          </div>
        )}

        {allEvents.length > 0 && filteredEvents.length === 0 && (
          <div className="glass-card rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-modern-100 rounded-full flex items-center justify-center mx-auto text-modern-300">
              <Search size={32} />
            </div>
            <p className="text-modern-400 font-medium">Không tìm thấy sự kiện nào phù hợp.</p>
          </div>
        )}

        {ongoingEvents.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between ml-1">
              <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest">Đang diễn ra</h3>
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
            </div>
            <div className="space-y-4">
              {ongoingEvents.map((event) => (
                <motion.div 
                  key={event.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleEventClick(event)}
                  className={cn(
                    "glass-card rounded-3xl p-5 flex items-center gap-5 cursor-pointer transition-all border shadow-lg",
                    getStatusStyle('ongoing')
                  )}
                >
                  <div className="bg-red-100 w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-red-700 border border-red-200">
                    <span className="text-lg font-bold leading-none">{event.date.split('-')[2]}</span>
                    <span className="text-[10px] uppercase font-bold mt-1">Hôm nay</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold leading-tight mb-1">{event.title}</h4>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                      getEventTypeColor(event.type)
                    )}>
                      {event.type}
                    </span>
                  </div>
                  <ChevronRight size={20} className="text-red-300" />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {upcomingEvents.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-blue-500 uppercase tracking-widest ml-1">Sắp tới</h3>
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <motion.div 
                  key={event.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleEventClick(event)}
                  className={cn(
                    "glass-card rounded-3xl p-5 flex items-center gap-5 cursor-pointer transition-all border shadow-sm",
                    getStatusStyle('upcoming')
                  )}
                >
                  <div className="bg-blue-100 w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-blue-700 border border-blue-200">
                    <span className="text-lg font-bold leading-none">{event.date.split('-')[2]}</span>
                    <span className="text-[10px] uppercase font-bold mt-1">Tháng {event.date.split('-')[1]}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold leading-tight mb-1">{event.title}</h4>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                      getEventTypeColor(event.type)
                    )}>
                      {event.type}
                    </span>
                  </div>
                  <ChevronRight size={20} className="text-blue-300" />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {pastEvents.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest ml-1">Đã qua</h3>
            <div className="space-y-3">
              {pastEvents.map((event) => (
                <div 
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className={cn(
                    "rounded-2xl p-4 flex items-center gap-4 cursor-pointer border transition-all",
                    getStatusStyle('past')
                  )}
                >
                  <div className="text-gray-400 text-center min-w-[40px]">
                    <p className="text-xs font-bold">{event.date.split('-')[2]}/{event.date.split('-')[1]}</p>
                    <p className="text-[10px] font-medium">{event.date.split('-')[0]}</p>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm">{event.title}</h4>
                  </div>
                  {!event.isAuto && isAdmin && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                      className="text-red-400 p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
