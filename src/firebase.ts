import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Modern Firestore Cache Configuration
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);

// Increase retry time for storage to handle potential network timeouts
// Default is 10 minutes (600,000ms), but sometimes setting it explicitly helps
// or increasing it if the network is very slow.
storage.maxUploadRetryTime = 600000; // 10 minutes
storage.maxOperationRetryTime = 600000; // 10 minutes
