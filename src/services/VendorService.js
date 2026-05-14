/**
 * VendorService - 廠商資料操作服務
 * 
 * 架構 (2026/05/12):
 * - Firestore 為主資料庫
 * - GAS 只做 Drive 操作
 * - vendor_id 用 Firestore transaction 產生
 */
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const GAS_WEB_APP_URL = import.meta.env.VITE_GAS_WEB_APP_URL;

// ============================================
// 7 階段定義 (跟 GAS Settings 對齊)
// ============================================

export const STAGE_DEFINITIONS = [
  { number: 1, name: "找尋廠商" },
  { number: 2, name: "郵件/社群聯繫" },
  { number: 3, name: "邀請內部會議確認" },
  { number: 4, name: "請廠商提供合約" },
  { number: 5, name: "彙整給彥鈞的報告" },
  { number: 6, name: "合約修正" },
  { number: 7, name: "合約簽署中" }
];

// ============================================
// vendor_id 產生器
// ============================================

async function generateVendorId() {
  const today = new Date();
  const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, "");
  const counterId = `vendor_${yyyymmdd}`;
  const counterRef = doc(db, "counters", counterId);
  
  const newSerial = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    
    let nextSerial = 1;
    if (counterDoc.exists()) {
      nextSerial = (counterDoc.data().count || 0) + 1;
    }
    
    transaction.set(counterRef, { count: nextSerial, date: yyyymmdd });
    return nextSerial;
  });
  
  const serialStr = String(newSerial).padStart(3, "0");
  return `V${yyyymmdd}${serialStr}`;
}

// ============================================
// 新增廠商 (主流程)
// ============================================

export async function createVendor(vendorData) {
  // 1. 前端驗證
  const validation = validateVendorData(vendorData);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  let vendorId;
  
  try {
    // 2. 產生 vendor_id
    vendorId = await generateVendorId();
    console.log(`產生 vendor_id: ${vendorId}`);
    
    // 3. 寫入 Firestore vendors collection
    const vendorDoc = {
      vendor_id: vendorId,
      vendor_code: vendorData.vendor_code.trim().toUpperCase(),
      vendor_name: vendorData.vendor_name.trim(),
      country: vendorData.country.trim(),
      city: vendorData.city?.trim() || "",
      contact_person: vendorData.contact_person?.trim() || "",
      email: vendorData.email?.trim() || "",
      phone: vendorData.phone?.trim() || "",
      stage: "找尋廠商",
      stage_number: 1,
      owner: vendorData.owner.trim(),
      priority: vendorData.priority || "中",
      notes: vendorData.notes?.trim() || "",
      drive_folder_url: "",
      drive_folder_id: "",
      is_contracted: false,
      training_generated: false,
      is_deleted: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    };
    
    await setDoc(doc(db, "vendors", vendorId), vendorDoc);
    console.log(`Firestore 寫入完成: vendors/${vendorId}`);
    
    // 4. 寫入 stage_history subcollection
    const historyRef = doc(collection(db, "vendors", vendorId, "stage_history"));
    await setDoc(historyRef, {
      vendor_id: vendorId,
      vendor_name: vendorDoc.vendor_name,
      from_stage: "",
      from_stage_number: 0,
      to_stage: "找尋廠商",
      to_stage_number: 1,
      change_type: "新建",
      changed_by: vendorData.owner,
      changed_at: serverTimestamp(),
      notes: "廠商建檔",
      days_in_stage: 0
    });
    
  // 5. 呼叫 GAS:建立 Drive 資料夾 + 寫 Sheets 備份 (即時同步)
    // 用 createVendorWithSheetsBackup action:
    //   - 建立 Drive 資料夾 (跟之前一樣)
    //   - 同時寫入 Sheets Vendors + Stage_History 表 (給彥鈞/主管看)
    const gasResult = await callGAS("createVendorWithSheetsBackup", {
      data: {
        vendor_id: vendorId,
        vendor_code: vendorDoc.vendor_code,
        vendor_name: vendorDoc.vendor_name,
        country: vendorDoc.country,
        city: vendorDoc.city,
        contact_person: vendorDoc.contact_person,
        email: vendorDoc.email,
        phone: vendorDoc.phone,
        owner: vendorDoc.owner,
        priority: vendorDoc.priority,
        notes: vendorDoc.notes
      }
    });
    
    if (gasResult.success) {
      // 6. 回寫 folder_url 到 Firestore
      await updateDoc(doc(db, "vendors", vendorId), {
        drive_folder_url: gasResult.folder_url,
        drive_folder_id: gasResult.folder_id || "",
        updated_at: serverTimestamp()
      });
      
      return {
        success: true,
        vendor_id: vendorId,
        folder_url: gasResult.folder_url,
        message: `廠商「${vendorDoc.vendor_name}」建檔成功 (Firestore + Sheets 雙寫完成)`
      };
    } else {
      // GAS 失敗,但 Firestore 已寫入 (資料不會丟)
      return {
        success: true,
        vendor_id: vendorId,
        folder_url: "",
        warning: `廠商已寫入 Firestore,但 GAS 同步失敗: ${gasResult.error}`
      };
    }
    
  } catch (error) {
    console.error("createVendor 錯誤:", error);
    return {
      success: false,
      error: error.message || String(error)
    };
  }
}

// ============================================
// 階段推進 (Y2 即時雙寫:Firestore 為主、GAS Sheets 為鏡像)
// ============================================

export async function advanceStage(vendorId, notes) {
  try {
    // 1. 讀取 Firestore vendor 文件
    const vendorRef = doc(db, "vendors", vendorId);
    const vendorSnap = await getDoc(vendorRef);

    if (!vendorSnap.exists()) {
      throw new Error("找不到廠商: " + vendorId);
    }

    const vendorDoc = vendorSnap.data();

    if (vendorDoc.is_deleted === true) {
      throw new Error("該廠商已刪除,無法推進階段");
    }

    // 2. 計算下一階段
    const currentStageNumber = vendorDoc.stage_number;
    const nextStageNumber = currentStageNumber + 1;

    if (nextStageNumber > 7) {
      throw new Error("已經是最後階段,無法再推進");
    }

    const nextStage = STAGE_DEFINITIONS.find(s => s.number === nextStageNumber);

    // 3. 計算 days_in_stage:抓 stage_history 最後一筆的 changed_at
    const historyCol = collection(db, "vendors", vendorId, "stage_history");
    const lastHistoryQuery = query(
      historyCol,
      orderBy("changed_at", "desc"),
      limit(1)
    );
    const lastHistorySnap = await getDocs(lastHistoryQuery);

    let lastChangedAt;
    if (!lastHistorySnap.empty) {
      const lastData = lastHistorySnap.docs[0].data();
      lastChangedAt = lastData.changed_at?.toDate
        ? lastData.changed_at.toDate()
        : lastData.changed_at;
    } else {
      // 理論上不會發生,createVendor 一定會寫一筆「新建」
      lastChangedAt = vendorDoc.created_at?.toDate
        ? vendorDoc.created_at.toDate()
        : vendorDoc.created_at;
    }

    const daysInStage = Math.floor(
      (Date.now() - lastChangedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 4. 準備寫入資料
    const now = new Date();
    const changedBy = "react-web"; // Phase 8 加 Auth 後改成真實使用者 email

    // 5a. 更新 vendors 主檔
    const vendorUpdate = {
      stage: nextStage.name,
      stage_number: nextStage.number,
      updated_at: serverTimestamp()
    };
    if (nextStage.name === "合約簽署中") {
      vendorUpdate.is_contracted = true;
    }
    await updateDoc(vendorRef, vendorUpdate);

    // 5b. 寫 stage_history (若失敗,主檔已更新,先吞掉錯誤;實務上極少發生)
    try {
      await addDoc(historyCol, {
        vendor_id: vendorId,
        vendor_name: vendorDoc.vendor_name,
        from_stage: vendorDoc.stage,
        from_stage_number: currentStageNumber,
        to_stage: nextStage.name,
        to_stage_number: nextStage.number,
        change_type: "前進",
        changed_by: changedBy,
        changed_at: serverTimestamp(),
        notes: notes || ("推進至「" + nextStage.name + "」"),
        days_in_stage: daysInStage
      });
    } catch (historyError) {
      console.error(
        "advanceStage: stage_history 寫入失敗 (主檔已更新成功):",
        historyError
      );
    }

    // 6. 同步呼叫 GAS Sheets 鏡像
    const payload = {
      vendor_id: vendorId,
      vendor_name: vendorDoc.vendor_name,
      from_stage: vendorDoc.stage,
      from_stage_number: currentStageNumber,
      to_stage: nextStage.name,
      to_stage_number: nextStage.number,
      changed_by: changedBy,
      changed_at: now.toISOString(),
      notes: notes || ("推進至「" + nextStage.name + "」"),
      days_in_stage: daysInStage
    };

    const gasResult = await callGAS("advanceStage", { payload });

    if (gasResult.success === false) {
      console.warn("GAS Sheets 同步失敗:" + gasResult.error);
    }

    // 7. 回傳結果
    return {
      success: true,
      vendor_id: vendorId,
      from_stage: vendorDoc.stage,
      to_stage: nextStage.name,
      days_in_stage: daysInStage,
      gas_synced: gasResult.success
    };

  } catch (error) {
    console.error("advanceStage 錯誤:", error);
    throw error;
  }
}

// ============================================
// 查詢廠商
// ============================================

export async function getVendor(vendorId) {
  try {
    const docSnap = await getDoc(doc(db, "vendors", vendorId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error("getVendor 錯誤:", error);
    return null;
  }
}

export async function getAllVendors() {
  try {
    const q = query(
      collection(db, "vendors"),
      where("is_deleted", "==", false),
      orderBy("created_at", "desc")
    );
    const querySnap = await getDocs(q);
    return querySnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("getAllVendors 錯誤:", error);
    return [];
  }
}

// ============================================
// 工具函式
// ============================================

function validateVendorData(data) {
  if (!data.vendor_name?.trim()) {
    return { valid: false, error: "廠商名稱為必填" };
  }
  if (!data.vendor_code?.trim()) {
    return { valid: false, error: "廠商代號為必填" };
  }
  if (!/^[A-Z0-9]{2,6}$/.test(data.vendor_code)) {
    return { valid: false, error: "廠商代號必須是 2-6 個英文字母或數字(自動轉大寫)" };
  }
  if (!data.country?.trim()) {
    return { valid: false, error: "國家/地區為必填" };
  }
  if (!data.owner?.trim()) {
    return { valid: false, error: "負責 PM 為必填" };
  }
  if (data.email && !isValidEmail(data.email)) {
    return { valid: false, error: "Email 格式不正確" };
  }
  return { valid: true };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function callGAS(action, payload) {
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload })
    });
    
    if (!response.ok) {
      throw new Error(`GAS 回應狀態 ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`callGAS(${action}) 錯誤:`, error);
    return { success: false, error: error.message };
  }
}