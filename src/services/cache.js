import { db } from './firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';

const CACHE_KEY = 'tkb_vendors_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘

// LocalStorage 快取
export const localCache = {
  get(key) {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      const { data, timestamp } = JSON.parse(item);
      if (Date.now() - timestamp > CACHE_TTL) {
        localStorage.removeItem(key);
        return null;
      }
      return data;
    } catch { return null; }
  },
  set(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch(e) { console.warn('LocalStorage 寫入失敗', e); }
  },
  clear(key) {
    localStorage.removeItem(key);
  }
};

// 備份到 Firestore
export async function backupVendorsToFirestore(vendors) {
  try {
    const batch = [];
    for (const vendor of vendors) {
      const ref = doc(db, 'vendors_backup', vendor.vendor_id);
      batch.push(setDoc(ref, {
        ...vendor,
        backed_up_at: serverTimestamp()
      }, { merge: true }));
    }
    await Promise.all(batch);
    console.log(`✅ 已備份 ${vendors.length} 筆廠商資料到 Firestore`);
    return true;
  } catch(e) {
    console.error('Firestore 備份失敗', e);
    return false;
  }
}

// 從 Firestore 讀取備份（GAS 掛掉時的備援）
export async function getVendorsFromFirestore() {
  try {
    const snapshot = await getDocs(collection(db, 'vendors_backup'));
    return snapshot.docs.map(doc => doc.data());
  } catch(e) {
    console.error('Firestore 讀取失敗', e);
    return [];
  }
}
