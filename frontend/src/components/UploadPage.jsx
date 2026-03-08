// components/UploadPage.jsx
import { useState } from "react";
import axios from "axios";
import { C, card, btn, API } from "../constants";
import LOGO_B64 from "../logoBase64";

export default function UploadPage({ user, onUploaded, onLogout }) {
  const [files,   setFiles]   = useState({ equity: null, fno: null, holdings: null });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const allReady = files.equity && files.fno && files.holdings;

  const FileBox = ({ label, key2, icon, desc }) => (
    <label style={{
      display: "block", border: `2px dashed ${files[key2] ? C.green : C.border}`,
      borderRadius: "14px", padding: "28px", textAlign: "center", cursor: "pointer",
      background: files[key2] ? C.greenSoft : C.bg, transition: "all .2s",
    }}>
      <input type="file" accept=".csv" style={{ display: "none" }}
        onChange={e => setFiles(f => ({ ...f, [key2]: e.target.files[0] }))}/>
      <div style={{ fontSize: "32px", marginBottom: "10px" }}>{files[key2] ? "✅" : icon}</div>
      <div style={{ fontSize: "15px", fontWeight: "700", color: files[key2] ? C.green : C.text, marginBottom: "4px" }}>
        {files[key2] ? files[key2].name : label}
      </div>
      <div style={{ fontSize: "12px", color: C.textSub }}>{files[key2] ? "Click to change" : desc}</div>
    </label>
  );

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("equity",   files.equity);
      form.append("fno",      files.fno);
      form.append("holdings", files.holdings);

      // JWT is attached automatically by the axios interceptor in constants.js
      // Content-Type is set automatically by browser for FormData — do NOT set it manually
      await axios.post(`${API}/upload`, form);
      onUploaded();
    } catch (e) {
      // Show the real backend error so we can debug
      const detail = e.response?.data?.detail;
      if (detail) {
        setError(`Upload failed: ${detail}`);
      } else if (e.response?.status === 401) {
        setError("Session expired. Please log out and log in again.");
      } else if (!e.response) {
        setError("Cannot reach the API server. Make sure uvicorn is running on port 8000.");
      } else {
        setError(`Upload failed (${e.response.status}). Check the uvicorn terminal for details.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Georgia, serif" }}>
      <nav style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "18px 48px", background: C.white, borderBottom: `1px solid ${C.border}`,
      }}>
        <img src={`data:image/png;base64,${LOGO_B64}`} alt="StockSage"
          style={{ height: "44px", objectFit: "contain" }}/>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "14px", color: C.textSub }}>
            Welcome, <strong style={{ color: C.text }}>{user.name}</strong>
          </span>
          <button onClick={onLogout} style={{ ...btn("soft"), padding: "8px 18px", fontSize: "13px" }}>
            Logout
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: "680px", margin: "60px auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px", animation: "fadeUp .5s ease" }}>
          <h1 style={{ fontSize: "32px", color: C.text, marginBottom: "10px" }}>Upload Your Trading CSV Files</h1>
          <p style={{ color: C.textSub, fontSize: "15px", lineHeight: 1.6 }}>
            Download your CSVs from <strong>your trading website</strong> and upload below.
          </p>
        </div>

        <div style={{ ...card, padding: "36px", animation: "fadeUp .6s ease" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "28px" }}>
            <FileBox key2="equity"   label="Equity Tradebook CSV" icon="📈" desc="Reports → Tradebook → Equity"/>
            <FileBox key2="fno"      label="F&O Tradebook CSV"    icon="📉" desc="Reports → Tradebook → F&O"/>
            <FileBox key2="holdings" label="Holdings CSV"         icon="💼" desc="Portfolio → Holdings → Download"/>
          </div>

          {error && (
            <div style={{
              color: C.red, background: C.redSoft, padding: "12px 16px",
              borderRadius: "8px", fontSize: "13px", marginBottom: "16px",
              wordBreak: "break-word", lineHeight: 1.6,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={!allReady || loading}
            style={{
              ...btn("primary"), width: "100%", padding: "16px", fontSize: "16px",
              opacity: allReady ? 1 : 0.4,
              cursor: allReady ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "⏳ Generating your scorecard..." : "Generate My Scorecard →"}
          </button>

          {!allReady && (
            <p style={{ textAlign: "center", fontSize: "13px", color: C.textSub, marginTop: "12px" }}>
              Upload all 3 files to continue
            </p>
          )}
        </div>

        <div style={{ ...card, marginTop: "20px", padding: "24px" }}>
          <div style={{ fontSize: "13px", fontWeight: "700", color: C.text, marginBottom: "14px" }}>
            📋 How to download from your Trading website
          </div>
          {[
            "Go to your trading website and login",
            "Navigate to the Reports section",
            "Download the CSV files for Equity, F&O, and Holdings",
            "Upload the downloaded CSV files above",
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", gap: "12px", marginBottom: "10px", alignItems: "flex-start" }}>
              <div style={{
                width: "22px", height: "22px", background: C.blueSoft, color: C.blue,
                borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "11px", fontWeight: "700", flexShrink: 0,
              }}>{i + 1}</div>
              <span style={{ fontSize: "13px", color: C.textSub, lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}