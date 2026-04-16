import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { OperationType, FirestoreErrorInfo } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function handleFirestoreError(
  error: unknown, 
  operationType: OperationType, 
  path: string | null, 
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  if (showToast) {
    if (errInfo.error.includes('insufficient permissions') || errInfo.error.includes('permission-denied')) {
      showToast('Lỗi quyền truy cập: Vui lòng thử lại hoặc tải lại trang.', 'error');
    } else if (errInfo.error.includes('Quota exceeded') || errInfo.error.includes('quota limit exceeded')) {
      showToast('Hết hạn mức sử dụng (Quota exceeded): Vui lòng quay lại sau 24h khi hạn mức được đặt lại.', 'error');
    } else {
      showToast('Lỗi hệ thống: Vui lòng tải lại trang. (' + errInfo.error + ')', 'error');
    }
  }
  
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    } else {
      console.log("Firestore connection test (ignore if first run):", error.message);
    }
  }
}

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const compressImage = (base64: string, maxWidth = 1024, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = document.createElement('img');
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64); // Fallback to original if error
  });
};
