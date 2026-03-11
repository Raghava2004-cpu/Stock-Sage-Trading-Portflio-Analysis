// components/LivePnLBar.jsx — StockSage
// Real prices from Yahoo Finance via backend proxy (15-min delayed, free)

import { useState, useEffect } from "react";
import axios from "axios";
import { C, fmt, API } from "../constants";

export function LivePnLBar({ stocks }) {
  const [prices,     setPrices]     = useState({});
  const [prevCloses, setPrevCloses] = useState({});
  const [updated,    setUpdated]    = useState(null);
  const [delayed,    setDelayed]    = useState(false);

  useEffect(() => {
    if (!stocks.length) return;

    async function fetchPrices() {
      try {
        const symbols = stocks.map(s => s.symbol).join(",");
        const res = await axios.get(`${API}/prices?symbols=${symbols}`);
        setPrices(res.data.prices || {});
        setPrevCloses(res.data.prev_closes || {});
        setDelayed(true);
        setUpdated(new Date().toLocaleTimeString("en-IN"));
      } catch {
        // Fallback: use last_price from DB
        const fallback = {};
        stocks.forEach(s => { fallback[s.symbol] = s.last_price || 0; });
        setPrices(fallback);
        setUpdated(new Date().toLocaleTimeString("en-IN"));
      }
    }

    fetchPrices();
    const t = setInterval(fetchPrices, 15 * 60 * 1000);  // refresh every 15 min
    return () => clearInterval(t);
  }, [stocks]);

  // Today's P&L = (livePrice - yesterdayClose) * qty held
  const livePnL = stocks.reduce((sum, s) => {
    const livePrice = prices[s.symbol] || s.last_price || 0;
    const prevClose = prevCloses[s.symbol] || s.last_price || livePrice;
    return sum + ((livePrice - prevClose) * (s.current_qty || 0));
  }, 0);

  const totalValue = stocks.reduce((sum, s) => {
    const livePrice = prices[s.symbol] || s.last_price || 0;
    return sum + livePrice * (s.current_qty || 0);
  }, 0);

  const isUp = livePnL >= 0;

  return (
    <div style={{
      background: isUp ? "#ECFDF5" : "#FEF2F2",
      borderBottom: `2px solid ${isUp ? C.green : C.red}`,
      padding: "10px 48px",
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap", gap: "12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "10px", height: "10px", borderRadius: "50%",
          background: isUp ? C.green : C.red,
          boxShadow: `0 0 0 3px ${isUp ? "#bbf7d0" : "#fecaca"}`,
          animation: "pulse 1.5s infinite",
        }}/>
        <span style={{ fontSize: "12px", fontWeight: "700", color: isUp ? C.green : C.red, letterSpacing: "1px" }}>
          LIVE P&L
        </span>
        {delayed && (
          <span style={{ fontSize: "10px", color: C.textLight, background: C.blueSoft, padding: "2px 8px", borderRadius: "20px" }}>
            15-min delayed
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{
          fontSize: "22px", fontWeight: "900",
          color: isUp ? C.green : C.red,
          fontFamily: "'Courier New', monospace",
        }}>
          {isUp ? "▲" : "▼"} {fmt(Math.abs(livePnL))}
        </span>
        <span style={{ fontSize: "13px", color: C.textSub }}>today</span>
      </div>

      <div style={{ display: "flex", gap: "28px", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "11px", color: C.textSub, letterSpacing: "1px" }}>LIVE VALUE</div>
          <div style={{ fontSize: "14px", fontWeight: "800", color: C.text, fontFamily: "'Courier New',monospace" }}>
            {fmt(totalValue)}
          </div>
        </div>
        <div style={{ fontSize: "11px", color: C.textLight }}>
          Updated {updated}
        </div>
      </div>
    </div>
  );
}
