// components/TickerTape.jsx
import { C, TICKER_STOCKS } from "../constants";

export default function TickerTape() {
  const doubled = [...TICKER_STOCKS, ...TICKER_STOCKS];
  return (
    <div style={{ background:"#0F172A", padding:"10px 0", borderTop:`2px solid ${C.blue}`, overflow:"hidden", flexShrink:0 }}>
      <div style={{ display:"flex", width:"max-content", animation:"tickerScroll 38s linear infinite" }}
        onMouseEnter={e=>e.currentTarget.style.animationPlayState="paused"}
        onMouseLeave={e=>e.currentTarget.style.animationPlayState="running"}>
        {doubled.map((s,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"0 30px", borderRight:"1px solid #1e293b", whiteSpace:"nowrap" }}>
            <span style={{ fontSize:"12px", color:"#94A3B8", fontFamily:"Courier New,monospace", fontWeight:"700" }}>{s.sym}</span>
            <span style={{ fontSize:"12px", color:"#e2e8f0", fontFamily:"Courier New,monospace" }}>{s.price}</span>
            <span style={{ fontSize:"11px", color:s.up?"#22c55e":"#ef4444", fontFamily:"Courier New,monospace", fontWeight:"700" }}>{s.chg} {s.up?"▲":"▼"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}