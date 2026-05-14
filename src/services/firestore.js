import { db } from './firebase';
import {
  collection, doc, getDocs, getDoc,
  addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from 'firebase/firestore';

const VENDORS_COL = 'vendors';
const HISTORY_COL = 'stage_history';
const DOCS_COL = 'documents';
const REPORTS_COL = 'reports_yenchun';
const TRAINING_COL = 'training_materials';

// ============================================
// 廠商 CRUD
// ============================================

export async function getVendorsForBoard() {
  try {
    const q = query(
      collection(db, VENDORS_COL),
      where('is_deleted', '==', false)
    );
    const snapshot = await getDocs(q);
    const vendors = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return { success: true, vendors };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

export async function getVendorById(vendorId) {
  try {
    const docRef = doc(db, VENDORS_COL, vendorId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() };
  } catch(e) {
    return null;
  }
}

export async function createVendor(vendorData) {
  try {
    const docRef = await addDoc(collection(db, VENDORS_COL), {
      ...vendorData,
      stage: '找尋廠商',
      stage_number: 1,
      is_contracted: false,
      training_generated: false,
      is_deleted: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    return { success: true, vendor_id: docRef.id };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

export async function updateVendor(vendorId, updateData) {
  try {
    const docRef = doc(db, VENDORS_COL, vendorId);
    await updateDoc(docRef, {
      ...updateData,
      updated_at: serverTimestamp(),
    });
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

export async function deleteVendor(vendorId) {
  try {
    await updateDoc(doc(db, VENDORS_COL, vendorId), {
      is_deleted: true,
      deleted_at: serverTimestamp(),
    });
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ============================================
// 階段推進
// ============================================

export async function advanceStage(vendorId, stages, notes = '') {
  try {
    const vendor = await getVendorById(vendorId);
    if (!vendor) throw new Error('找不到廠商');

    const currentStageNum = vendor.stage_number;
    const nextStageNum = currentStageNum + 1;

    if (nextStageNum > stages.length) {
      throw new Error('已經是最後階段，無法再推進');
    }

    const nextStage = stages.find(s => s.number === nextStageNum);

    // 更新廠商階段
    await updateVendor(vendorId, {
      stage: nextStage.name,
      stage_number: nextStageNum,
    });

    // 寫入歷程
    await addDoc(collection(db, HISTORY_COL), {
      vendor_id: vendorId,
      vendor_name: vendor.vendor_name,
      from_stage: vendor.stage,
      from_stage_number: currentStageNum,
      to_stage: nextStage.name,
      to_stage_number: nextStageNum,
      change_type: '前進',
      notes: notes || `推進至「${nextStage.name}」`,
      changed_at: serverTimestamp(),
    });

    return {
      success: true,
      message: `已從「${vendor.stage}」推進到「${nextStage.name}」`
    };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ============================================
// 文件列表
// ============================================

export async function getVendorDocuments(vendorId) {
  try {
    const q = query(
      collection(db, DOCS_COL),
      where('vendor_id', '==', vendorId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {
    return [];
  }
}

// ============================================
// 報告列表
// ============================================

export async function getVendorReports(vendorId) {
  try {
    const q = query(
      collection(db, REPORTS_COL),
      where('vendor_id', '==', vendorId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {
    return [];
  }
}

export async function updateReportStatus(reportId, status, comments = '') {
  try {
    await updateDoc(doc(db, REPORTS_COL, reportId), {
      review_status: status,
      comments,
      reviewed_at: serverTimestamp(),
    });
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ============================================
// 歷程
// ============================================

export async function getVendorHistory(vendorId) {
  try {
    const q = query(
      collection(db, HISTORY_COL),
      where('vendor_id', '==', vendorId),
      orderBy('changed_at', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {
    return [];
  }
}