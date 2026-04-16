import { createContext, useContext } from 'react';
import { FirebaseContextType } from '../types';

export const FirebaseContext = createContext<FirebaseContextType>({ 
  user: null, 
  loading: true, 
  members: [],
  graves: [],
  events: [],
  selectedEventId: null,
  setSelectedEventId: () => {},
  selectedMemberId: null,
  setSelectedMemberId: () => {},
  selectedSpouseIndex: null,
  setSelectedSpouseIndex: () => {},
  activeTab: 'home',
  setActiveTab: () => {},
  fontSettings: { 
    family: 'Inter', 
    size: 16, 
    effect: 'none', 
    color: '#141414',
    titleSize: 20,
    titleColor: '#0e8fe9'
  },
  setFontSettings: () => {},
  showToast: () => {},
  hiddenGenerations: [],
  setHiddenGenerations: () => {},
  hiddenMemberIds: [],
  setHiddenMemberIds: () => {},
  isAdmin: false,
  refreshData: async (forceLive?: boolean) => {},
  addMembers: () => {}
});

export const useFirebase = () => useContext(FirebaseContext);
