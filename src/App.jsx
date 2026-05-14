/**
 * App.jsx - TKB 放洋廠商管理系統 主頁 (Phase 3: 看板 + 表格雙視圖)
 */
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import VendorCreateForm from "./components/VendorCreateForm";
import { advanceStage, STAGE_DEFINITIONS } from "./services/VendorService";

const COLORS = {
  primary: "#5B5F97",
  primaryDark: "#4C5087",
  success: "#48BB78",
  successDark: "#38A169",
  bg: "#F0F2F5",
  text: "#2D3748",
  textMuted: "#718096",
  border: "#E2E8F0",
  cardBg: "#F7FAFC"
};

const STAGE_COLORS = {
  1: { bg: "#EBF8FF", color: "#2C7A7B" },
  2: { bg: "#FFFAF0", color: "#C05621" },
  3: { bg: "#FAF5FF", color: "#6B46C1" },
  4: { bg: "#FFF5F5", color: "#C53030" },
  5: { bg: "#FFFFF0", color: "#744210" },
  6: { bg: "#FFFBEB", color: "#92400E" },
  7: { bg: "#F0FFF4", color: "#276749" }
};

const PRIORITY_COLORS = {
  "高": { color: "#E53E3E", weight: 600 },
  "中": { color: "#DD6B20", weight: 500 },
  "低": { color: "#38A169", weight: 500 }
};

const tdStyle = { padding: "12px 16px", fontSize: 13, borderBottom: "1px solid #F0F2F5" };

export default function App() {
  const [vendors, setVendors] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "table"
  const [advanceModalVendor, setAdvanceModalVendor] = useState(null);
  const [advanceNotes, setAdvanceNotes] = useState("");
  const [isAdvancing, setIsAdvancing] = useState(false);

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

  function openAdvanceModal(vendor) {
    setAdvanceModalVendor(vendor);
    setAdvanceNotes("");
  }

  function closeAdvanceModal() {
    if (isAdvancing) return;
    setAdvanceModalVendor(null);
    setAdvanceNotes("");
  }

  async function handleConfirmAdvance() {
    if (!advanceModalVendor) return;
    setIsAdvancing(true);
    try {
      const result = await advanceStage(advanceModalVendor.vendor_id, advanceNotes);
      console.log("階段推進成功:", result);
      if (!result.gas_synced) {
        alert("✅ 階段已推進,但 Sheets 同步失敗(主資料無誤,Sheets 之後可手動補)");
      }
      setAdvanceModalVendor(null);
      setAdvanceNotes("");
    } catch (error) {
      console.error("階段推進失敗:", error);
      alert("❌ 推進失敗: " + error.message);
    } finally {
      setIsAdvancing(false);
    }
  }

  const totalVendors = vendors.length;
  const inProgress = vendors.filter(v => v.stage_number >= 1 && v.stage_number <= 6).length;
  const contracted = vendors.filter(v => v.stage_number === 7).length;

  function renderKanbanView() {
    return (
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16 }}>
        {STAGE_DEFINITIONS.map(stage => {
          const stageVendors = vendors.filter(v => v.stage_number === stage.number);
          const stageColor = STAGE_COLORS[stage.number];
          return (
            <div key={stage.number} style={{
              background: "white",
              borderRadius: 12,
              minWidth: 220,
              width: 220,
              flexShrink: 0,
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)"
            }}>
              {/* Column Header */}
              <div style={{
                padding: "12px 14px",
                borderRadius: "12px 12px 0 0",
                fontWeight: 600,
                fontSize: 13,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: stageColor.bg,
                color: stageColor.color
              }}>
                <span>{stage.number}. {stage.name}</span>
                <span style={{
                  background: "#EBF4FF",
                  color: "#2B6CB0",
                  borderRadius: 12,
                  padding: "2px 8px",
                  fontSize: 12
                }}>{stageVendors.length}</span>
              </div>
              {/* Column Body */}
              <div style={{ padding: 8, minHeight: 200, maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
                {stageVendors.map(v => {
                  const priority = PRIORITY_COLORS[v.priority] || { color: COLORS.textMuted, weight: 500 };
                  return (
                    <div key={v.vendor_id} style={{
                      background: COLORS.cardBg,
                      borderRadius: 8,
                      padding: "10px 12px",
                      marginBottom: 8,
                      border: `1px solid ${COLORS.border}`,
                      borderLeft: "3px solid transparent",
                      transition: "all 0.2s"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderLeftColor = COLORS.primary;
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderLeftColor = "transparent";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                        {v.vendor_name}
                        {v.vendor_code && <span style={{ color: COLORS.textMuted, marginLeft: 6, fontWeight: 400 }}>({v.vendor_code})</span>}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                        <span>🌍 {v.country}</span>
                        <span>👤 {v.owner}</span>
                        <span style={{ color: priority.color, fontWeight: priority.weight }}>● {v.priority}</span>
                      </div>
                      {v.stage_number === 7 ? (
                        <span style={{ fontSize: 11, color: "#276749", fontWeight: 600 }}>✓ 已完成</span>
                      ) : (
                        <button
                          onClick={() => openAdvanceModal(v)}
                          style={{
                            fontSize: 11,
                            padding: "3px 8px",
                            background: COLORS.primary,
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontWeight: 600
                          }}
                        >
                          推進 →
                        </button>
                      )}
                    </div>
                  );
                })}
                {stageVendors.length === 0 && (
                  <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 12, padding: 16 }}>
                    暫無廠商
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderTableView() {
    return (
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["廠商 ID", "代號", "廠商名", "國家", "階段", "PM", "優先", "Drive", "操作"].map(h => (
                <th key={h} style={{
                  background: "#F7FAFC",
                  padding: "12px 16px",
                  textAlign: "left",
                  fontSize: 13,
                  color: "#4A5568",
                  fontWeight: 600,
                  borderBottom: `1px solid ${COLORS.border}`
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendors.map(v => {
              const stageColor = STAGE_COLORS[v.stage_number] || { bg: "#EEE", color: "#333" };
              const priority = PRIORITY_COLORS[v.priority] || { color: COLORS.textMuted, weight: 500 };
              return (
                <tr key={v.vendor_id}>
                  <td style={tdStyle}>
                    <code style={{ fontFamily: "Monaco, Consolas, monospace", fontSize: 11,
                                   background: "#F4F4F8", padding: "2px 6px", borderRadius: 3, color: "#666" }}>
                      {v.vendor_id}
                    </code>
                  </td>
                  <td style={tdStyle}><code style={{ fontFamily: "Monaco, Consolas, monospace", fontSize: 12, background: "#F4F4F8", padding: "2px 6px", borderRadius: 3 }}>{v.vendor_code || "—"}</code></td>
                  <td style={tdStyle}><strong>{v.vendor_name}</strong></td>
                  <td style={tdStyle}>{v.country}{v.city && ` / ${v.city}`}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "3px 10px",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      background: stageColor.bg,
                      color: stageColor.color,
                      whiteSpace: "nowrap"
                    }}>
                      {v.stage_number}. {v.stage}
                    </span>
                  </td>
                  <td style={tdStyle}>{v.owner}</td>
                  <td style={{ ...tdStyle, color: priority.color, fontWeight: priority.weight }}>● {v.priority}</td>
                  <td style={tdStyle}>
                    {v.drive_folder_url ? (
                      <a href={v.drive_folder_url} target="_blank" rel="noreferrer" style={{ color: COLORS.primary, textDecoration: "none" }}>📁 開啟</a>
                    ) : <span style={{ color: "#bbb" }}>—</span>}
                  </td>
                  <td style={tdStyle}>
                    {v.stage_number === 7 ? (
                      <span style={{ color: "#276749", fontWeight: 600, fontSize: 13 }}>✓ 已完成</span>
                    ) : (
                      <button
                        onClick={() => openAdvanceModal(v)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: `1px solid ${COLORS.border}`,
                          background: "white",
                          cursor: "pointer",
                          fontSize: 12,
                          color: "#4A5568",
                          transition: "all 0.2s"
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = COLORS.primary;
                          e.currentTarget.style.color = "white";
                          e.currentTarget.style.borderColor = COLORS.primary;
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = "white";
                          e.currentTarget.style.color = "#4A5568";
                          e.currentTarget.style.borderColor = COLORS.border;
                        }}
                      >
                        推進階段
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function renderAdvanceModal() {
    const nextStage = STAGE_DEFINITIONS.find(s => s.number === advanceModalVendor.stage_number + 1);
    return (
      <div
        onClick={closeAdvanceModal}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 200
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "white",
            borderRadius: 16,
            width: 480,
            maxWidth: "95vw",
            padding: 24,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 700 }}>推進階段</h3>

          <div style={{ marginBottom: 20, fontSize: 15 }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>
              {advanceModalVendor.vendor_name}
              {advanceModalVendor.vendor_code && (
                <span style={{ color: COLORS.textMuted, marginLeft: 8, fontWeight: 400 }}>
                  ({advanceModalVendor.vendor_code})
                </span>
              )}
            </div>
            <div>
              <span style={{ color: COLORS.textMuted }}>
                {advanceModalVendor.stage_number}. {advanceModalVendor.stage}
              </span>
              <span style={{ margin: "0 12px", color: COLORS.primary, fontWeight: 600 }}>→</span>
              <span style={{ color: COLORS.primary, fontWeight: 600 }}>
                {nextStage ? `${nextStage.number}. ${nextStage.name}` : "(無)"}
              </span>
            </div>
          </div>

          <label style={{ display: "block", marginBottom: 8, fontSize: 14, color: "#4A5568", fontWeight: 600 }}>
            備註 (選填)
          </label>
          <textarea
            value={advanceNotes}
            onChange={(e) => setAdvanceNotes(e.target.value)}
            placeholder="此次推進的備註..."
            rows={3}
            disabled={isAdvancing}
            style={{
              width: "100%",
              padding: "9px 12px",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              fontSize: 14,
              fontFamily: "inherit",
              resize: "vertical",
              boxSizing: "border-box",
              marginBottom: 20,
              outline: "none"
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              onClick={closeAdvanceModal}
              disabled={isAdvancing}
              style={{
                padding: "9px 18px",
                background: "white",
                color: "#4A5568",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                cursor: isAdvancing ? "not-allowed" : "pointer",
                fontSize: 14
              }}
            >
              取消
            </button>
            <button
              onClick={handleConfirmAdvance}
              disabled={isAdvancing}
              style={{
                padding: "9px 18px",
                background: isAdvancing ? "#A0AEC0" : COLORS.primary,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: isAdvancing ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 600
              }}
            >
              {isAdvancing ? "推進中..." : "確認推進"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'Noto Sans TC', sans-serif" }}>

      {/* Navbar */}
      <nav style={{
        background: COLORS.primary,
        color: "white",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        position: "sticky",
        top: 0,
        zIndex: 100
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>
          🎓 TKB放洋 廠商管理系統
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* View Toggle */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.15)", borderRadius: 8, overflow: "hidden" }}>
            <button
              onClick={() => setViewMode("kanban")}
              style={{
                padding: "6px 16px",
                border: "none",
                background: viewMode === "kanban" ? "rgba(255,255,255,0.3)" : "transparent",
                color: "white",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: viewMode === "kanban" ? 600 : 400
              }}
            >
              📋 看板
            </button>
            <button
              onClick={() => setViewMode("table")}
              style={{
                padding: "6px 16px",
                border: "none",
                background: viewMode === "table" ? "rgba(255,255,255,0.3)" : "transparent",
                color: "white",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: viewMode === "table" ? 600 : 400
              }}
            >
              📊 表格
            </button>
          </div>
          {/* Add Button */}
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: "7px 16px",
              background: COLORS.success,
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
            onMouseOver={(e) => e.currentTarget.style.background = COLORS.successDark}
            onMouseOut={(e) => e.currentTarget.style.background = COLORS.success}
          >
            + 新增廠商
          </button>
        </div>
      </nav>

      <main style={{ padding: 24, maxWidth: 1600, margin: "0 auto" }}>

        {/* Stats Row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { num: totalVendors, label: "總廠商數" },
            { num: inProgress, label: "洽談中" },
            { num: contracted, label: "已簽約" }
          ].map((stat, i) => (
            <div key={i} style={{
              background: "white",
              borderRadius: 12,
              padding: "16px 20px",
              flex: 1,
              minWidth: 140,
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              borderLeft: `4px solid ${COLORS.primary}`
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.primary }}>{stat.num}</div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: COLORS.textMuted }}>載入中...</div>
        ) : vendors.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, background: "white", borderRadius: 12, color: COLORS.textMuted }}>
            尚無廠商,點右上「+ 新增廠商」開始
          </div>
        ) : viewMode === "kanban" ? (
          renderKanbanView()
        ) : (
          renderTableView()
        )}
      </main>

      {/* 新增廠商 Modal */}
      {showCreateForm && (
        <div
          onClick={() => setShowCreateForm(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <VendorCreateForm
              onSuccess={() => setShowCreateForm(false)}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </div>
      )}

      {/* 推進階段 Modal */}
      {advanceModalVendor && renderAdvanceModal()}

    </div>
  );
}
