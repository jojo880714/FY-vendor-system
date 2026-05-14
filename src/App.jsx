/**
 * App.jsx - TKB 放洋廠商管理系統 主頁
 */
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import VendorCreateForm from "./components/VendorCreateForm";

export default function App() {
  const [vendors, setVendors] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Firestore 即時監聽
  useEffect(() => {
    const q = query(
      collection(db, "vendors"),
      where("is_deleted", "==", false)
    );
    
    const unsubscribe = onSnapshot(q,
      (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const aTime = a.created_at?.toMillis?.() || 0;
            const bTime = b.created_at?.toMillis?.() || 0;
            return bTime - aTime;
          });
        setVendors(list);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore 監聽錯誤:", error);
        setLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, []);
  
  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.h1}>TKB 放洋廠商管理系統</h1>
        <button onClick={() => setShowCreateForm(true)} style={styles.btnPrimary}>
          + 新增廠商
        </button>
      </header>
      
      {showCreateForm && (
        <div style={styles.modalBackdrop} onClick={() => setShowCreateForm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={styles.modalContent}>
            <VendorCreateForm
              onSuccess={() => setShowCreateForm(false)}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </div>
      )}
      
      <main style={styles.main}>
        <h2 style={styles.h2}>廠商列表 ({vendors.length})</h2>
        
        {loading ? (
          <p style={styles.loading}>載入中...</p>
        ) : vendors.length === 0 ? (
          <div style={styles.empty}>
            <p>還沒有廠商資料</p>
            <button onClick={() => setShowCreateForm(true)} style={styles.btnPrimary}>
              新增第一個廠商
            </button>
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>廠商 ID</th>
                  <th style={styles.th}>代號</th>
                  <th style={styles.th}>廠商名稱</th>
                  <th style={styles.th}>國家</th>
                  <th style={styles.th}>階段</th>
                  <th style={styles.th}>負責 PM</th>
                  <th style={styles.th}>優先順序</th>
                  <th style={styles.th}>Drive</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map(v => (
                  <tr key={v.id}>
                    <td style={styles.td}><code style={styles.code}>{v.vendor_id}</code></td>
                    <td style={styles.td}><code style={styles.code}>{v.vendor_code || ""}</code></td>
                    <td style={styles.td}><strong>{v.vendor_name}</strong></td>
                    <td style={styles.td}>{v.country}{v.city && ` / ${v.city}`}</td>
                    <td style={styles.td}>
                      <span style={styles.stageBadge}>{v.stage}</span>
                    </td>
                    <td style={styles.td}>{v.owner}</td>
                    <td style={styles.td}>{v.priority}</td>
                    <td style={styles.td}>
                      {v.drive_folder_url ? (
                        <a href={v.drive_folder_url} target="_blank" rel="noreferrer" style={styles.link}>
                          📁 開啟
                        </a>
                      ) : (
                        <span style={{ color: "#bbb" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  app: { minHeight: "100vh", background: "#F5F5F7",
         fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  header: { background: "#5B5F97", color: "#fff", padding: "16px 32px",
            display: "flex", justifyContent: "space-between", alignItems: "center" },
  h1: { margin: 0, fontSize: 22 },
  h2: { fontSize: 18, color: "#333", margin: "0 0 16px" },
  main: { padding: 32, maxWidth: 1400, margin: "0 auto" },
  btnPrimary: { padding: "10px 20px", background: "#fff", color: "#5B5F97",
                border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600,
                fontSize: 14 },
  modalBackdrop: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                   background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start",
                   justifyContent: "center", zIndex: 1000, padding: 20, overflow: "auto" },
  modalContent: { width: "100%", maxWidth: 800, marginTop: 40 },
  tableWrap: { background: "#fff", borderRadius: 8, overflow: "hidden",
               boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: 12, background: "#F8F9FA", textAlign: "left",
        borderBottom: "2px solid #E0E0E0", fontSize: 13, color: "#666",
        fontWeight: 600 },
  td: { padding: 12, borderBottom: "1px solid #F0F0F0", fontSize: 14 },
  code: { fontFamily: "Monaco, Consolas, monospace", fontSize: 12,
          background: "#F4F4F8", padding: "2px 6px", borderRadius: 3 },
  stageBadge: { padding: "4px 10px", background: "#E3F2FD", color: "#1565C0",
                borderRadius: 12, fontSize: 12, fontWeight: 600 },
  link: { color: "#5B5F97", textDecoration: "none" },
  empty: { textAlign: "center", padding: 60, background: "#fff",
           borderRadius: 8, color: "#999" },
  loading: { color: "#999" }
};