// App.jsx — StockSage — Root entry
import { useState, useEffect } from "react";
import axios from "axios";
import { API, C } from "./constants";   // ← interceptor is wired in constants.js
import Landing    from "./components/Landing";
import AuthPage   from "./components/AuthPage";
import UploadPage from "./components/UploadPage";
import Dashboard  from "./components/Dashboard";

export default function App() {
  const stored = localStorage.getItem("sc_user");
  const [page,     setPage]     = useState("landing");
  const [authMode, setAuthMode] = useState("login");
  const [user,     setUser]     = useState(stored ? JSON.parse(stored) : null);


  useEffect(() => {
    if (!user) return;
    // /status is user-scoped (uses the JWT interceptor automatically)
    axios.get(`${API}/status`)
      .then(r => {
        setPage(r.data.scorecard_ready ? "dashboard" : "upload");
      })
      .catch(() => setPage("upload"));
  }, []);  // eslint-disable-line

  const handleLogin = (mode) => { setAuthMode(mode); setPage("auth"); };

  const handleAuthSuccess = (isNewUser = false) => {
    const u = JSON.parse(localStorage.getItem("sc_user"));
    setUser(u);

    if (isNewUser) {
      // New signup — always needs to upload first
      setPage("upload");
    } else {
      // Returning login — ask the server if they have existing data
      axios.get(`${API}/status`)
        .then(r => {
          setPage(r.data.scorecard_ready ? "dashboard" : "upload");
        })
        .catch(() => setPage("upload"));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("sc_user");
    setUser(null);
    setPage("landing");
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tickerScroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.bg}}
      `}</style>
      {page==="landing"   && <Landing   onLogin={handleLogin}/>}
      {page==="auth"      && <AuthPage  mode={authMode} onSuccess={handleAuthSuccess} onBack={()=>setPage("landing")}/>}
      {page==="upload"    && user && <UploadPage user={user} onUploaded={()=>{setPage("dashboard");}} onLogout={handleLogout}/>}
      {page==="dashboard" && user && <Dashboard  user={user} onLogout={handleLogout} onReupload={()=>setPage("upload")}/>}
    </>
  );
}