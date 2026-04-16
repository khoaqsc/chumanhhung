import { ref, deleteObject } from 'firebase/storage';
import { storage, auth } from '../firebase';
import EXIF from 'exif-js';

/**
 * Deletes a file from Firebase Storage given its URL.
 */
export const deleteFromStorage = async (url: string) => {
  if (!url || !url.includes('firebasestorage.googleapis.com')) return;
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch (error) {
    console.error("Error deleting file from storage:", error);
  }
};

/**
 * Processes an image file: resizes, handles EXIF orientation, and compresses.
 */
export const processImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      
      const processWithOrientation = (orientation: number) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context failed');

        // Target width 800px
        const targetWidth = 800;
        const scale = targetWidth / img.width;
        let width = targetWidth;
        let height = img.height * scale;

        // Adjust canvas size and rotation based on orientation
        if (orientation >= 5 && orientation <= 8) {
          canvas.width = height;
          canvas.height = width;
        } else {
          canvas.width = width;
          canvas.height = height;
        }

        switch (orientation) {
          case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
          case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
          case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
          case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
          case 6: ctx.transform(0, 1, -1, 0, height, 0); break;
          case 7: ctx.transform(0, -1, -1, 0, height, width); break;
          case 8: ctx.transform(0, -1, 1, 0, 0, width); break;
          default: ctx.transform(1, 0, 0, 1, 0, 0);
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject('Blob creation failed');
        }, 'image/jpeg', 0.8);
      };

      try {
        // Fallback if EXIF fails or takes too long
        const timeout = setTimeout(() => {
          processWithOrientation(1);
        }, 2000);

        EXIF.getData(img as any, function(this: any) {
          clearTimeout(timeout);
          const orientation = EXIF.getTag(this, "Orientation") || 1;
          processWithOrientation(orientation);
        });
      } catch (e) {
        processWithOrientation(1);
      }
    };
    
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
  });
};

/**
 * Formats a date string to dd/mm/yyyy.
 */
export const formatDate = (dateStr: string) => {
  if (!dateStr) return "Chưa cập nhật";
  // Check if it's a simple year
  if (dateStr.length === 4 && !isNaN(parseInt(dateStr))) return dateStr;
  
  try {
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr; // Return as is if invalid date
    let day = String(d.getDate()).padStart(2, '0');
    let month = String(d.getMonth() + 1).padStart(2, '0');
    let year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr;
  }
};

/**
 * Calculates age based on birth and death dates.
 */
export const calculateAge = (birthDate: string, deathDate: string) => {
  if (!birthDate) return "N/A";
  
  // Handle simple year string
  if (birthDate.length === 4 && !isNaN(parseInt(birthDate))) {
    const birthYear = parseInt(birthDate);
    const deathYear = deathDate ? (deathDate.length === 4 ? parseInt(deathDate) : new Date(deathDate).getFullYear()) : new Date().getFullYear();
    return deathYear - birthYear;
  }

  try {
    let start = new Date(birthDate);
    let end = deathDate ? new Date(deathDate) : new Date();
    if (isNaN(start.getTime())) return "N/A";
    
    let age = end.getFullYear() - start.getFullYear();
    const m = end.getMonth() - start.getMonth();
    if (m < 0 || (m === 0 && end.getDate() < start.getDate())) {
      age--;
    }
    return age;
  } catch (e) {
    return "N/A";
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

/**
 * Handles Firestore errors by logging detailed context and throwing a JSON error.
 */
export const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};
