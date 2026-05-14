/**
 * VendorCreateForm - 新增廠商表單
 */
import { useState } from "react";
import { createVendor } from "../services/VendorService";

const COUNTRIES = ["美國", "英國", "加拿大", "澳洲", "紐西蘭", "愛爾蘭", "菲律賓", "馬爾他", "日本", "韓國", "德國", "法國", "其他"];
const PRIORITIES = ["高", "中", "低"];

const INITIAL_FORM = {
  vendor_name: "",
  vendor_code: "",
  country: "",
  city: "",
  contact_person: "",
  email: "",
  phone: "",
  owner: "JoJo",
  priority: "中",
  notes: ""
};

export default function VendorCreateForm({ onSuccess, onCancel }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    
    const result = await createVendor(form);
    setSubmitting(false);
    
    if (result.success) {
      if (result.warning) {
        setMessage({ type: "warning", text: result.warning });
      } else {
        setMessage({ type: "success", text: `✅ ${result.message} (vendor_id: ${result.vendor_id})` });
      }
      setForm(INITIAL_FORM);
      if (onSuccess) setTimeout(() => onSuccess(result), 1500);
    } else {
      setMessage({ type: "error", text: `❌ ${result.error}` });
    }
  };
  
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>新增廠商</h2>
      
      {message && (
        <div style={{
          ...styles.message,
          ...(message.type === "success" ? styles.messageSuccess :
              message.type === "warning" ? styles.messageWarning :
              styles.messageError)
        }}>
          {message.text}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div style={styles.row}>
          <Field label="廠商名稱" required>
            <input type="text" name="vendor_name" value={form.vendor_name}
              onChange={handleChange} required style={styles.input}
              placeholder="例: ABC遊學中心" />
          </Field>
          <Field label="廠商代號" required>
            <input type="text" name="vendor_code" value={form.vendor_code}
              onChange={(e) => {
                // 自動轉大寫,只允許英文字母與數字
                const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                setForm(prev => ({ ...prev, vendor_code: cleaned }));
              }}
              required maxLength={6} style={styles.input}
              placeholder="2-6 字母,例: EP / WIN / KAP" />
          </Field>
        </div>
        
        <div style={styles.row}>
          <Field label="負責 PM" required>
            <input type="text" name="owner" value={form.owner}
              onChange={handleChange} required style={styles.input} />
          </Field>
          <Field label="優先順序">
            <select name="priority" value={form.priority} onChange={handleChange} style={styles.input}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>
        
        <div style={styles.row}>
          <Field label="國家/地區" required>
            <select name="country" value={form.country} onChange={handleChange} required style={styles.input}>
              <option value="">請選擇</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="城市">
            <input type="text" name="city" value={form.city}
              onChange={handleChange} style={styles.input}
              placeholder="例: 紐約" />
          </Field>
        </div>
        
        <div style={styles.row}>
          <Field label="聯絡人">
            <input type="text" name="contact_person" value={form.contact_person}
              onChange={handleChange} style={styles.input}
              placeholder="例: John Smith" />
          </Field>
          <Field label="Email">
            <input type="email" name="email" value={form.email}
              onChange={handleChange} style={styles.input}
              placeholder="例: contact@example.com" />
          </Field>
        </div>
        
        <div style={styles.row}>
          <Field label="電話">
            <input type="text" name="phone" value={form.phone}
              onChange={handleChange} style={styles.input}
              placeholder="例: +1-212-555-0123" />
          </Field>
          <div style={styles.field}></div>
        </div>
        
        <Field label="備註">
          <textarea name="notes" value={form.notes} onChange={handleChange}
            style={{ ...styles.input, minHeight: 80, resize: "vertical" }}
            placeholder="其他補充說明..." />
        </Field>
        
        <div style={styles.actions}>
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={submitting} style={styles.btnCancel}>
              取消
            </button>
          )}
          <button type="submit" disabled={submitting} style={styles.btnSubmit}>
            {submitting ? "新增中..." : "確認新增"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>
        {label} {required && <span style={{ color: "#d32f2f" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const styles = {
  container: { maxWidth: 800, margin: "20px auto", padding: 24, background: "#fff",
               borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" },
  title: { margin: "0 0 24px", color: "#5B5F97", fontSize: 24 },
  row: { display: "flex", gap: 16, marginBottom: 16 },
  field: { flex: 1, marginBottom: 16 },
  label: { display: "block", marginBottom: 6, fontWeight: 600, color: "#333" },
  input: { width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #ddd",
           borderRadius: 4, boxSizing: "border-box", fontFamily: "inherit" },
  actions: { display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 },
  btnSubmit: { padding: "10px 24px", background: "#5B5F97", color: "#fff", border: "none",
               borderRadius: 4, cursor: "pointer", fontSize: 14, fontWeight: 600 },
  btnCancel: { padding: "10px 24px", background: "#fff", color: "#666", border: "1px solid #ddd",
               borderRadius: 4, cursor: "pointer", fontSize: 14 },
  message: { padding: 12, marginBottom: 16, borderRadius: 4, fontSize: 14 },
  messageSuccess: { background: "#E8F5E9", color: "#2E7D32", border: "1px solid #A5D6A7" },
  messageError: { background: "#FFEBEE", color: "#C62828", border: "1px solid #EF9A9A" },
  messageWarning: { background: "#FFF3E0", color: "#E65100", border: "1px solid #FFB74D" }
};