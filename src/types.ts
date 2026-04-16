import { User as FirebaseUser } from 'firebase/auth';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  }
}

export interface FontSettings {
  family: string;
  size: number;
  effect: 'none' | 'glow' | 'shadow' | 'blink';
  color: string;
  titleSize: number;
  titleColor: string;
}

export interface FirebaseContextType {
  user: FirebaseUser | null;
  loading: boolean;
  members: any[];
  graves: any[];
  events: any[];
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  selectedMemberId: string | null;
  setSelectedMemberId: (id: string | null) => void;
  selectedSpouseIndex: number | null;
  setSelectedSpouseIndex: (index: number | null) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  fontSettings: FontSettings;
  setFontSettings: (settings: FontSettings) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  hiddenGenerations: number[];
  setHiddenGenerations: (gens: number[]) => void;
  hiddenMemberIds: string[];
  setHiddenMemberIds: (ids: string[]) => void;
  isAdmin: boolean;
  refreshData: (forceLive?: boolean) => Promise<void>;
  addMembers: (newMembers: any[]) => void;
}
