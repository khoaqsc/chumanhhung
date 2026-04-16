import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  MapPin, 
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { cn } from '../../utils/firestore';

interface HomeScreenProps {
  onNavigate: (tab: string) => void;
}

export const HomeScreen = ({ onNavigate }: HomeScreenProps) => {
  const { 
    members, 
    graves, 
    events, 
    setSelectedEventId, 
    fontSettings,
    refreshData,
    showToast
  } = useFirebase();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData(true); // Force fetch from Firebase to check for live updates
      showToast('Đã cập nhật dữ liệu mới nhất từ Live Firebase!', 'success');
    } catch (error) {
      showToast('Lỗi khi cập nhật dữ liệu.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return events
      .filter(e => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  }, [events]);

  const getEffectClass = (effect: string) => {
    switch (effect) {
      case 'blink': return 'animate-blink';
      case 'glow': return 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]';
      case 'shadow': return 'drop-shadow-lg';
      default: return '';
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 pb-24">
      <header className="mt-8 text-center relative">
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="absolute -top-2 right-0 p-2 bg-modern-100 text-modern-600 rounded-xl hover:bg-modern-200 transition-colors disabled:opacity-50"
          title="Cập nhật dữ liệu"
        >
          <RefreshCw size={18} className={cn(isRefreshing && "animate-spin")} />
        </button>
        <h1 
          className={cn(
            "text-4xl font-extrabold text-modern-900 leading-tight",
            getEffectClass(fontSettings.effect)
          )}
          style={{ 
            fontFamily: fontSettings.family,
            fontSize: `${fontSettings.size * 2.5}px`,
            color: fontSettings.color
          }}
        >
          Gia Phả <br />
          <span 
            className="italic"
            style={{ 
              fontSize: `${fontSettings.titleSize}px`,
              color: fontSettings.titleColor
            }}
          >
            Dòng Họ Chu Bắc
          </span>
        </h1>
        <p className="text-modern-600 mt-2 font-light">Gìn giữ cội nguồn, kết nối tương lai.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <motion.div 
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate('tree')}
          className="glass-card rounded-3xl p-6 flex flex-col gap-3 aspect-square justify-between cursor-pointer group hover:bg-modern-100 transition-colors"
        >
          <div className="bg-modern-200 w-12 h-12 rounded-2xl flex items-center justify-center text-modern-700 group-hover:bg-modern-500 group-hover:text-white transition-colors">
            <Users size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold">{members.length}</h3>
            <p className="text-[10px] text-modern-500 uppercase tracking-widest font-bold">Thành viên</p>
          </div>
        </motion.div>
        
        <motion.div 
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate('grave')}
          className="glass-card rounded-3xl p-6 flex flex-col gap-3 aspect-square justify-between cursor-pointer group hover:bg-modern-100 transition-colors"
        >
          <div className="bg-modern-200 w-12 h-12 rounded-2xl flex items-center justify-center text-modern-700 group-hover:bg-modern-500 group-hover:text-white transition-colors">
            <MapPin size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold">{graves.length}</h3>
            <p className="text-[10px] text-modern-500 uppercase tracking-widest font-bold">Địa điểm</p>
          </div>
        </motion.div>
      </div>

      <div className="glass-card rounded-3xl p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-1 w-6 bg-modern-500 rounded-full" />
            <h3 className="text-lg font-bold">Sự kiện sắp tới</h3>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate('events')}
              className="text-[10px] font-bold text-modern-500 uppercase tracking-widest flex items-center gap-1 hover:text-modern-700 transition-colors"
            >
              Xem tất cả <ChevronRight size={12} />
            </button>
          </div>
        </div>
        <div className="space-y-4">
          {upcomingEvents.length === 0 && <p className="text-sm text-modern-400 italic">Chưa có sự kiện nào.</p>}
          {upcomingEvents.map((event, i) => (
            <motion.div 
              key={event.id} 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-4 group cursor-pointer"
              onClick={() => {
                setSelectedEventId(event.id);
                onNavigate('events');
              }}
            >
              <div className="bg-modern-100 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-modern-700 border border-modern-200 group-hover:bg-modern-500 group-hover:text-white transition-colors">
                <span className="text-xs font-bold">{event.date.split('-')[2]}</span>
                <span className="text-[10px] uppercase font-bold">{event.date.split('-')[1]}</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm">{event.title}</h4>
                <p className="text-xs text-modern-500">{event.type}</p>
              </div>
              <ChevronRight size={16} className="text-modern-300 group-hover:text-modern-500 transition-colors" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
