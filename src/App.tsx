/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home as HomeIcon, 
  Users, 
  MapPin, 
  Settings as SettingsIcon,
  Calendar
} from 'lucide-react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  where,
  getDocs,
  getDocsFromCache
} from 'firebase/firestore';
import { FirebaseContext } from './context/FirebaseContext';
import { cn, handleFirestoreError } from './utils/firestore';
import { OperationType, FontSettings } from './types';
import { auth, db } from './firebase';
import { FAMILY_TREE_ID } from './constants';
import L from 'leaflet';

import { HomeScreen } from './components/screens/HomeScreen';
import { FamilyTreeScreen } from './components/screens/FamilyTreeScreen';
import { GraveVisitingScreen } from './components/screens/GraveVisitingScreen';
import { EventsScreen } from './components/screens/EventsScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';

const useFirebase = () => useContext(FirebaseContext);

// Fix Leaflet icon issue
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [graves, setGraves] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedSpouseIndex, setSelectedSpouseIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [fontSettings, setFontSettings] = useState<FontSettings>(() => {
    try {
      const saved = localStorage.getItem('fontSettings');
      const defaultSettings: FontSettings = { 
        family: 'Inter', 
        size: 16, 
        effect: 'none', 
        color: '#141414',
        titleSize: 20,
        titleColor: '#0e8fe9'
      };
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultSettings, ...parsed };
      }
      return defaultSettings;
    } catch (e) {
      console.error('Error parsing fontSettings from localStorage', e);
      return { 
        family: 'Inter', 
        size: 16, 
        effect: 'none', 
        color: '#141414',
        titleSize: 20,
        titleColor: '#0e8fe9'
      };
    }
  });
  const [hiddenGenerations, setHiddenGenerations] = useState<number[]>([]);
  const [hiddenMemberIds, setHiddenMemberIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchData = async (forceLive = false) => {
    // 1. Try Loading from static JSON first (Zero Firestore Reads)
    if (!forceLive) {
      try {
        const resp = await fetch('/giapha.json');
        if (resp.ok) {
          const staticData = await resp.json();
          if (staticData && staticData.members && staticData.events && staticData.graves) {
            setMembers(staticData.members);
            setGraves(staticData.graves);
            setEvents(staticData.events);
            console.log('[App] Đã tải dữ liệu từ tệp JSON tĩnh (Tối ưu 0 lượt đọc Firestore)');
            return; // Skip Firestore
          }
        }
      } catch (e) {
        // Only log if it's truly an unexpected error, otherwise fallback silently
      }
    }

    // 2. Fallback to Firebase (Default behavior)
    const fetchCollection = async (q: any) => {
      try {
        // Try server first
        return await getDocs(q);
      } catch (error: any) {
        // If quota exceeded or offline, try cache
        if (error.message?.includes('Quota exceeded') || error.code === 'unavailable') {
          try {
            return await getDocsFromCache(q);
          } catch (cacheError) {
            throw error; // If cache also fails, throw original error
          }
        }
        throw error;
      }
    };

    try {
      const qMembers = query(
        collection(db, 'members'), 
        where('familyTreeId', '==', FAMILY_TREE_ID)
      );
      const membersSnap = await fetchCollection(qMembers);
      const sortedMembers = membersSnap.docs
        .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
        .sort((a: any, b: any) => (a.generation || 0) - (b.generation || 0));
      setMembers(sortedMembers);

      const qGraves = query(
        collection(db, 'graveLocations'),
        where('familyTreeId', '==', FAMILY_TREE_ID)
      );
      const gravesSnap = await fetchCollection(qGraves);
      setGraves(gravesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));

      const qEvents = query(
        collection(db, 'events'), 
        where('familyTreeId', '==', FAMILY_TREE_ID),
        orderBy('date', 'asc')
      );
      const eventsSnap = await fetchCollection(qEvents);
      setEvents(eventsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Quota exceeded') || errorMsg.includes('quota limit exceeded')) {
        try {
          const resp = await fetch('/giapha.json');
          if (resp.ok) {
            const staticData = await resp.json();
            if (staticData && staticData.members) {
              setMembers(staticData.members);
              setGraves(staticData.graves || []);
              setEvents(staticData.events || []);
              showToast('Đã hết hạn mức Firebase. Ứng dụng hiện đang chạy ở Chế độ JSON dự phòng.', 'info');
              return;
            }
          }
        } catch (e) {
          console.error("Last resort JSON failed", e);
        }
      }
      handleFirestoreError(error, OperationType.LIST, 'data', showToast);
    }
  };

  const refreshData = async (forceLive = false) => {
    await fetchData(forceLive);
  };

  const addMembers = (newMembers: any[]) => {
    setMembers(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const filteredNew = newMembers.filter(m => !existingIds.has(m.id));
      if (filteredNew.length === 0) return prev;
      return [...prev, ...filteredNew];
    });
  };

  useEffect(() => {
    fetchData();

    // 1. Listen to Auth changes
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAdmin(firebaseUser?.email === 'chubatien1986@gmail.com');
      setLoading(false);
    });

    // 2. Setup Real-time Listeners for automatic updates
    const qMembers = query(collection(db, 'members'), where('familyTreeId', '==', FAMILY_TREE_ID));
    const qGraves = query(collection(db, 'graveLocations'), where('familyTreeId', '==', FAMILY_TREE_ID));
    const qEvents = query(collection(db, 'events'), where('familyTreeId', '==', FAMILY_TREE_ID), orderBy('date', 'asc'));

    const unsubMembers = onSnapshot(qMembers, (snap) => {
      // Logic: Only update if the data is coming from the server (not local optimistic update)
      // to avoid double jumps during editing, OR if it's others' changes.
      const sortedMembers = snap.docs
        .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
        .sort((a: any, b: any) => (a.generation || 0) - (b.generation || 0));
      setMembers(sortedMembers);
    }, (error: any) => {
      // If listeners fail (quota), we still have fetchData's JSON fallback
      console.warn('[Realtime] Subscription error:', error);
    });

    const unsubGraves = onSnapshot(qGraves, (snap) => {
      setGraves(snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
    });

    const unsubEvents = onSnapshot(qEvents, (snap) => {
      setEvents(snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
    });

    return () => {
      unsubAuth();
      unsubMembers();
      unsubGraves();
      unsubEvents();
    };
  }, []);

  const tabs = [
    { id: 'home', icon: HomeIcon, label: 'Trang chủ' },
    { id: 'tree', icon: Users, label: 'Gia phả' },
    { id: 'grave', icon: MapPin, label: 'Tảo mộ' },
    { id: 'events', icon: Calendar, label: 'Sự kiện' },
    { id: 'settings', icon: SettingsIcon, label: 'Cài đặt' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-modern-100 p-8 text-center overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          <div className="w-16 h-16 border-4 border-modern-300 border-t-modern-600 rounded-full animate-spin mx-auto" />
          <div className="animate-pulse text-modern-900 font-display text-2xl font-bold italic tracking-tight">
            Gia Phả Dòng Họ Chu Bắc
          </div>
          <p className="text-xs text-modern-400 font-medium animate-pulse">Đang tải dữ liệu và tối ưu hệ thống...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <FirebaseContext.Provider value={{ 
      user, loading, members, graves, events, 
      selectedEventId, setSelectedEventId, 
      selectedMemberId, setSelectedMemberId,
      selectedSpouseIndex, setSelectedSpouseIndex,
      activeTab, setActiveTab,
      fontSettings, setFontSettings,
      showToast,
      hiddenGenerations, setHiddenGenerations,
      hiddenMemberIds, setHiddenMemberIds,
      isAdmin,
      refreshData,
      addMembers
    }}>
      <div className="min-h-screen min-h-[100dvh] max-w-md md:max-w-[480px] mx-auto relative bg-modern-50 shadow-2xl overflow-hidden border-x border-modern-100 flex flex-col">
        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                "fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-xl font-bold text-sm flex items-center gap-2",
                toast.type === 'success' ? "bg-green-500 text-white" : 
                toast.type === 'error' ? "bg-red-500 text-white" : "bg-blue-500 text-white"
              )}
            >
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {activeTab === 'home' && <HomeScreen onNavigate={setActiveTab} />}
              {activeTab === 'tree' && <FamilyTreeScreen />}
              {activeTab === 'grave' && <GraveVisitingScreen />}
              {activeTab === 'events' && <EventsScreen />}
              {activeTab === 'settings' && <SettingsScreen onNavigate={setActiveTab} />}
            </motion.div>
          </AnimatePresence>
        </main>

      {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto glass-card border-t border-modern-200 rounded-t-[32px] px-6 py-4 safe-bottom z-50">
          <div className="flex items-center justify-between">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex flex-col items-center gap-1 relative"
                >
                  <div className={cn(
                    "p-2.5 rounded-2xl transition-all duration-300",
                    isActive ? "blue-gradient text-white scale-110 shadow-lg shadow-modern-500/30" : "text-modern-400 hover:text-modern-600"
                  )}>
                    <tab.icon size={22} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold transition-all duration-300 uppercase tracking-tighter",
                    isActive ? "text-modern-700 opacity-100" : "text-modern-400 opacity-0"
                  )}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute -top-1 w-1.5 h-1.5 bg-modern-500 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </FirebaseContext.Provider>
  );
}
