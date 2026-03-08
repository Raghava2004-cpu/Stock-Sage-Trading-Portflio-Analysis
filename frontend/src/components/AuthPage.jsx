// components/AuthPage.jsx
import { useState } from "react";
import axios from "axios";
import { C, card, btn, API } from "../constants";
import LOGO_B64 from "../logoBase64";

export default function AuthPage({ mode, onSuccess, onBack }) {
  const [tab,      setTab]      = useState(mode);
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handle = async () => {
    setError("");
    if (!email || !password) { setError("Please fill all fields."); return; }
    if (tab === "signup" && !name) { setError("Please enter your name."); return; }

    setLoading(true);
    try {
      const endpoint = tab === "signup" ? `${API}/auth/signup` : `${API}/auth/login`;
      const payload  = tab === "signup"
        ? { name, email, password }
        : { email, password };

      const { data } = await axios.post(endpoint, payload);

      // Save token + user info to localStorage
      // The JWT interceptor in constants.js will pick this up automatically
      localStorage.setItem("sc_user", JSON.stringify({
        token: data.token,
        name:  data.user.name,
        email: data.user.email,
        id:    data.user.id,
      }));

      // Pass isNewUser so App.jsx routes correctly:
      // true  → new signup → always goes to UploadPage
      // false → returning login → checks /status to decide
      onSuccess(data.is_new_user);

    } catch (e) {
      setError(e.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Allow Enter key to submit
  const onKey = (e) => { if (e.key === "Enter") handle(); };

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: "10px",
    border: `1.5px solid ${C.border}`, fontSize: "14px",
    fontFamily: "Georgia, serif", outline: "none", boxSizing: "border-box",
    background: C.bg, color: C.text,
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, fontFamily: "Georgia, serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 20px",
    }}>
      <div style={{ marginBottom: "32px", textAlign: "center" }}>
        <img
          src={`data:image/png;base64,${LOGO_B64}`}
          alt="StockSage"
          style={{ height: "70px", objectFit: "contain", filter: "drop-shadow(0 2px 10px rgba(0,73,159,0.12))" }}
        />
        <div style={{ fontSize: "14px", color: C.textSub, marginTop: "8px" }}>Your personal portfolio analyst</div>
      </div>

      <div style={{ ...card, width: "100%", maxWidth: "420px", padding: "40px", animation: "fadeUp .5s ease" }}>

        {/* Login / Sign Up toggle */}
        <div style={{ display: "flex", background: C.bg, borderRadius: "10px", padding: "4px", marginBottom: "32px" }}>
          {["login", "signup"].map(t => (
            <button key={t} onClick={() => { setTab(t); setError(""); }} style={{
              flex: 1, padding: "10px", border: "none", cursor: "pointer", borderRadius: "8px",
              fontSize: "14px", fontWeight: "600", fontFamily: "Georgia, serif",
              background: tab === t ? C.white : "transparent",
              color: tab === t ? C.blue : C.textSub,
              boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              transition: "all .2s",
            }}>
              {t === "login" ? "Login" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Name field — signup only */}
        {tab === "signup" && (
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "13px", color: C.textSub, display: "block", marginBottom: "6px" }}>Full Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={onKey}
              placeholder="Rahul Sharma"
              style={inputStyle}
            />
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "13px", color: C.textSub, display: "block", marginBottom: "6px" }}>Email</label>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={onKey}
            placeholder="you@email.com"
            type="email"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ fontSize: "13px", color: C.textSub, display: "block", marginBottom: "6px" }}>Password</label>
          <input
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={onKey}
            placeholder="••••••"
            type="password"
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={{
            color: C.red, fontSize: "13px", marginBottom: "16px",
            background: C.redSoft, padding: "10px 14px", borderRadius: "8px",
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handle}
          disabled={loading}
          style={{
            ...btn("primary"), width: "100%", padding: "14px", fontSize: "15px",
            opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading
            ? (tab === "login" ? "Logging in…" : "Creating account…")
            : (tab === "login" ? "Login to Dashboard" : "Create My Account")
          }
        </button>

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            onClick={onBack}
            style={{ background: "none", border: "none", color: C.textSub, fontSize: "13px", cursor: "pointer" }}
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}