// constants.js — StockSage shared tokens
import axios from "axios";

export const API = "https://stock-sage-trading-portflio-analysis-7.onrender.com";

// ── JWT Interceptor ────────────────────────────────────
// Automatically attaches the auth token to every axios request.
// You never have to pass headers manually anywhere in the app.
axios.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem("sc_user") || "{}");
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

// If the server returns 401 (token expired), log the user out automatically
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("sc_user");
      window.location.reload();   // Forces App.jsx back to landing
    }
    return Promise.reject(error);
  }
);

// ── Color System ─────────────────────────────────────
export const C = {
  bg:         "#F8FAFF",
  bgCard:     "#FFFFFF",
  blue:       "#1A56DB",
  blueSoft:   "#EEF2FF",
  blueLight:  "#3B82F6",
  green:      "#059669",
  greenSoft:  "#ECFDF5",
  red:        "#DC2626",
  redSoft:    "#FEF2F2",
  text:       "#0F172A",
  textSub:    "#64748B",
  textLight:  "#94A3B8",
  border:     "#E2E8F0",
  white:      "#FFFFFF",
};

// ── Shared Styles ─────────────────────────────────────
export const card = {
  background: C.bgCard,
  borderRadius: "16px",
  border: `1px solid ${C.border}`,
  boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
  padding: "24px",
};

export const btn = (variant = "primary") => ({
  padding: "12px 28px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "600",
  fontFamily: "Georgia, serif",
  transition: "all .2s",
  ...(variant === "primary" ? {
    background: C.blue, color: C.white,
    boxShadow: "0 4px 14px rgba(26,86,219,0.3)",
  } : variant === "outline" ? {
    background: "transparent", color: C.blue,
    border: `2px solid ${C.blue}`,
  } : {
    background: C.blueSoft, color: C.blue,
  })
});

// ── Helpers ───────────────────────────────────────────
export const fmt = (n) => n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
export const pct = (n) => n == null ? "—" : `${Number(n).toFixed(1)}%`;
export const pos = (n) => n > 0 ? C.green : n < 0 ? C.red : C.textSub;

// ── Pie chart colors ──────────────────────────────────
export const PIE_COLORS = ["#1A56DB","#059669","#F59E0B","#DC2626","#7C3AED","#0891B2","#D97706","#16A34A"];

// ── Ticker stocks ─────────────────────────────────────
export const TICKER_STOCKS = [
  { sym:"RELIANCE",  price:"₹2,934.50", chg:"+1.24%", up:true  },
  { sym:"TCS",       price:"₹4,123.80", chg:"+0.81%", up:true  },
  { sym:"INFY",      price:"₹1,897.65", chg:"-0.43%", up:false },
  { sym:"HDFCBANK",  price:"₹1,623.40", chg:"+0.29%", up:true  },
  { sym:"BAJFINANCE",price:"₹7,456.30", chg:"+1.82%", up:true  },
  { sym:"SBIN",      price:"₹623.75",   chg:"-0.18%", up:false },
  { sym:"WIPRO",     price:"₹523.45",   chg:"+0.62%", up:true  },
  { sym:"MARUTI",    price:"₹12,456.30",chg:"+0.92%", up:true  },
  { sym:"LTIM",      price:"₹5,432.25", chg:"-0.51%", up:false },
  { sym:"NESTLEIND", price:"₹24,567.80",chg:"+0.31%", up:true  },
  { sym:"AXISBANK",  price:"₹1,089.45", chg:"+1.10%", up:true  },
  { sym:"ICICIBANK", price:"₹1,134.55", chg:"-0.09%", up:false },
  { sym:"KOTAKBANK", price:"₹1,934.60", chg:"+0.41%", up:true  },
  { sym:"TATAMOTORS",price:"₹812.30",   chg:"+2.14%", up:true  },
  { sym:"HCLTECH",   price:"₹1,534.80", chg:"+0.42%", up:true  },
  { sym:"SUNPHARMA", price:"₹1,687.30", chg:"-0.22%", up:false },
  { sym:"ADANIENT",  price:"₹2,876.40", chg:"+3.12%", up:true  },
  { sym:"TATASTEEL", price:"₹167.85",   chg:"-0.38%", up:false },
  { sym:"M&M",       price:"₹2,134.60", chg:"+1.54%", up:true  },
  { sym:"BHARTIARTL",price:"₹1,456.80", chg:"+1.33%", up:true  },
  { sym:"DRREDDY",   price:"₹5,432.10", chg:"+0.88%", up:true  },
  { sym:"POWERGRID", price:"₹298.45",   chg:"+0.78%", up:true  },
  { sym:"ONGC",      price:"₹267.35",   chg:"+0.95%", up:true  },
  { sym:"DIVISLAB",  price:"₹3,876.50", chg:"-0.67%", up:false },
  { sym:"NTPC",      price:"₹356.20",   chg:"-0.11%", up:false },
];