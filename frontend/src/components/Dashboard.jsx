// components/Dashboard.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Legend
} from "recharts";
import { C, card, btn, fmt, pct, pos, PIE_COLORS, API } from "../constants";
import LOGO_B64 from "../logoBase64";
import { LivePnLBar } from "./LivePnLBar";
import HistoryChart from "./HistoryChart";
import TaxOptimizer from "./TaxOptimizer";



// ── Stat Card ─────────────────────────────────────────
function StatCard({ label, value, sub, color, bg }) {
  return (
    <div style={{ ...card, background:bg||C.bgCard, padding:"22px 24px" }}>
      <div style={{ fontSize:"11px", color:C.textSub, letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:"8px" }}>{label}</div>
      <div style={{ fontSize:"26px", fontWeight:"800", color:color||C.text, fontFamily:"Georgia, serif" }}>{value}</div>
      {sub && <div style={{ fontSize:"12px", color:C.textSub, marginTop:"4px" }}>{sub}</div>}
    </div>
  );
}

// ── Sector Heatmap ────────────────────────────────────
const SECTOR_MAP = {
  "RELIANCE":"Energy","ONGC":"Energy","NTPC":"Energy","POWERGRID":"Energy","BPCL":"Energy",
  "HDFCBANK":"Banking","ICICIBANK":"Banking","SBIN":"Banking","KOTAKBANK":"Banking","AXISBANK":"Banking","BANDHANBNK":"Banking","IDFCFIRSTB":"Banking",
  "INFY":"IT","TCS":"IT","WIPRO":"IT","HCLTECH":"IT","TECHM":"IT","LTIM":"IT","MPHASIS":"IT",
  "BAJFINANCE":"Finance","BAJAJFINSV":"Finance","HDFCLIFE":"Finance","SBILIFE":"Finance","ICICIGI":"Finance",
  "MARUTI":"Auto","TATAMOTORS":"Auto","M&M":"Auto","HEROMOTOCO":"Auto","BAJAJ-AUTO":"Auto","EICHERMOT":"Auto",
  "NESTLEIND":"FMCG","HINDUNILVR":"FMCG","ITC":"FMCG","BRITANNIA":"FMCG","DABUR":"FMCG",
  "SUNPHARMA":"Pharma","DRREDDY":"Pharma","DIVISLAB":"Pharma","CIPLA":"Pharma","APOLLOHOSP":"Pharma",
  "TATASTEEL":"Metal","JSWSTEEL":"Metal","HINDALCO":"Metal","COALINDIA":"Metal",
  "ADANIENT":"Infra","ADANIPORTS":"Infra","LT":"Infra","ULTRACEMCO":"Infra",
  "BHARTIARTL":"Telecom","IDEA":"Telecom",
};

const getHeatColor = (pnlPct) => {
  if (pnlPct === null || pnlPct === undefined) return { bg:"#f1f5f9", text:"#64748b", border:"#e2e8f0" };
  if (pnlPct >= 10)  return { bg:"#14532d", text:"#86efac",  border:"#166534" };
  if (pnlPct >= 2)   return { bg:"#166534", text:"#bbf7d0",  border:"#15803d" };
  if (pnlPct >= 0)   return { bg:"#dcfce7", text:"#166534",  border:"#86efac" };
  if (pnlPct >= -2)  return { bg:"#fef2f2", text:"#dc2626",  border:"#fca5a5" };
  if (pnlPct >= -10) return { bg:"#991b1b", text:"#fca5a5",  border:"#7f1d1d" };
  return               { bg:"#7f1d1d", text:"#fecaca",  border:"#991b1b" };
};

const TABS = ["overview","stocks","analysis","heatmap","anomalies","tax"];

// ── Main Dashboard ────────────────────────────────────
export default function Dashboard({ user, onLogout, onReupload }) {
  const [summary,  setSummary]  = useState(null);
  const [stocks,   setStocks]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState("overview");

  useEffect(() => {
    const load = async () => {
      try {
        const [s, st] = await Promise.all([
          axios.get(`${API}/portfolio/summary`),
          axios.get(`${API}/stocks`),
        ]);
        setSummary(s.data);
        setStocks(st.data.stocks || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const pieTotal = stocks.filter(s=>s.current_value>0).reduce((sum,s)=>sum+s.current_value,0);
  const pieData = stocks.filter(s=>s.current_value>0).sort((a,b)=>b.current_value-a.current_value).slice(0,7)
    .map(s=>({ name:s.symbol, value:Math.round(s.current_value), total:pieTotal }));

  const barData = [...stocks].sort((a,b)=>(b.total_pnl||0)-(a.total_pnl||0)).slice(0,10)
    .map(s=>({ name:s.symbol, pnl:Math.round(s.total_pnl||0), xirr:+(s.xirr_pct||0).toFixed(1) }));

  // ── PDF Export ────────────────────────────────────
  const exportPDF = () => {
    const date = new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
    const gainers = [...stocks].filter(s=>(s.total_pnl||0)>0).sort((a,b)=>b.total_pnl-a.total_pnl).slice(0,5);
    const losers  = [...stocks].filter(s=>(s.total_pnl||0)<0).sort((a,b)=>a.total_pnl-b.total_pnl).slice(0,5);
    const topConv = [...stocks].sort((a,b)=>(b.conviction_score||0)-(a.conviction_score||0)).slice(0,5);

    const rows = (arr, cols) => arr.map(s =>
      `<tr>${cols.map(c => `<td>${c.fn(s)}</td>`).join("")}</tr>`
    ).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <title>StockSage Report — ${date}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Georgia,serif;background:#fff;color:#0F172A;padding:40px}
      h1{font-size:28px;color:#1A56DB;margin-bottom:4px}
      .sub{font-size:13px;color:#64748B;margin-bottom:32px}
      .section{margin-bottom:32px}
      h2{font-size:16px;color:#0F172A;border-left:4px solid #1A56DB;padding-left:12px;margin-bottom:14px}
      .cards{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px}
      .card{flex:1;min-width:140px;background:#F8FAFF;border:1px solid #E2E8F0;border-radius:10px;padding:16px 18px}
      .card .val{font-size:20px;font-weight:800;font-family:'Courier New',monospace;color:#1A56DB}
      .card .lbl{font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
      .card .sub2{font-size:11px;color:#94A3B8;margin-top:3px}
      .green{color:#059669!important}.red{color:#DC2626!important}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#EEF2FF;color:#1A56DB;padding:8px 12px;text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase}
      td{padding:8px 12px;border-bottom:1px solid #F1F5F9;color:#0F172A}
      .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700}
      .badge-green{background:#ECFDF5;color:#059669}
      .badge-red{background:#FEF2F2;color:#DC2626}
      .badge-blue{background:#EEF2FF;color:#1A56DB}
      .badge-yellow{background:#FFFBEB;color:#D97706}
      .footer{margin-top:40px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;text-align:center}
      .logo{font-size:22px;font-weight:900;color:#1A56DB;margin-bottom:2px}
    </style></head><body>
    <div class="logo">StockSage</div>
    <h1>Portfolio Scorecard</h1>
    <div class="sub">Generated for ${user.name} &nbsp;·&nbsp; ${date}</div>
    <div class="section">
      <h2>Portfolio Summary</h2>
      <div class="cards">
        <div class="card"><div class="lbl">Total Invested</div><div class="val">${fmt(summary.total_invested)}</div></div>
        <div class="card"><div class="lbl">Current Value</div><div class="val">${fmt(summary.total_current_value)}</div></div>
        <div class="card"><div class="lbl">Total P&L</div>
          <div class="val ${summary.total_pnl>=0?"green":"red"}">${fmt(summary.total_pnl)}</div>
          <div class="sub2">${pct(summary.total_pnl_pct)} overall</div></div>
        <div class="card"><div class="lbl">Best Stock</div>
          <div class="val green">${summary.best_stock?.symbol||"—"}</div>
          <div class="sub2">${pct(summary.best_stock?.xirr_pct)} XIRR</div></div>
        <div class="card"><div class="lbl">Worst Stock</div>
          <div class="val red">${summary.worst_stock?.symbol||"—"}</div>
          <div class="sub2">${pct(summary.worst_stock?.xirr_pct)} XIRR</div></div>
        <div class="card"><div class="lbl">High Conviction</div>
          <div class="val">${summary.high_conviction_count}</div>
          <div class="sub2">Score ≥ 75</div></div>
      </div>
    </div>
    <div class="section">
      <h2>Tax Classification</h2>
      <div class="cards">
        <div class="card"><div class="lbl">LTCG Stocks</div><div class="val green">${summary.ltcg_stocks}</div><div class="sub2">Held &gt; 1 year · 10% tax</div></div>
        <div class="card"><div class="lbl">STCG Stocks</div><div class="val" style="color:#D97706">${summary.stcg_stocks}</div><div class="sub2">Held &lt; 1 year · 15% tax</div></div>
        <div class="card"><div class="lbl">F&amp;O Net P&L</div>
          <div class="val ${summary.fno_net_pnl>=0?"green":"red"}">${fmt(summary.fno_net_pnl)}</div>
          <div class="sub2">Win rate: ${pct(summary.fno_win_rate_pct)}</div></div>
      </div>
    </div>
    <div class="section">
      <h2>All Stocks</h2>
      <table>
        <thead><tr><th>Symbol</th><th>P&L</th><th>Return %</th><th>XIRR %</th><th>Conviction</th><th>Tax Type</th><th>Holding Days</th></tr></thead>
        <tbody>
          ${stocks.map(s=>`<tr>
            <td><strong>${s.symbol}</strong></td>
            <td class="${(s.total_pnl||0)>=0?"green":"red"}">${fmt(s.total_pnl)}</td>
            <td class="${(s.total_pnl_pct||0)>=0?"green":"red"}">${pct(s.total_pnl_pct)}</td>
            <td class="${(s.xirr_pct||0)>=0?"green":"red"}">${pct(s.xirr_pct)}</td>
            <td><span class="badge ${(s.conviction_score||0)>=75?"badge-green":(s.conviction_score||0)>=50?"badge-yellow":"badge-red"}">${s.conviction_score||0}</span></td>
            <td><span class="badge badge-blue">${s.tax_classification||"—"}</span></td>
            <td>${Math.round(s.avg_holding_days||0)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div class="section" style="display:flex;gap:24px">
      <div style="flex:1"><h2>Top Gainers</h2>
        <table><thead><tr><th>Symbol</th><th>P&L</th><th>XIRR</th></tr></thead>
        <tbody>${rows(gainers,[{fn:s=>`<strong>${s.symbol}</strong>`},{fn:s=>`<span class="green">${fmt(s.total_pnl)}</span>`},{fn:s=>`<span class="green">${pct(s.xirr_pct)}</span>`}])}</tbody></table>
      </div>
      <div style="flex:1"><h2>Top Losers</h2>
        <table><thead><tr><th>Symbol</th><th>P&L</th><th>XIRR</th></tr></thead>
        <tbody>${rows(losers,[{fn:s=>`<strong>${s.symbol}</strong>`},{fn:s=>`<span class="red">${fmt(s.total_pnl)}</span>`},{fn:s=>`<span class="red">${pct(s.xirr_pct)}</span>`}])}</tbody></table>
      </div>
    </div>
    <div class="section"><h2>Top Conviction Stocks</h2>
      <table><thead><tr><th>Symbol</th><th>Conviction Score</th><th>XIRR</th><th>Holding Days</th></tr></thead>
      <tbody>${rows(topConv,[
        {fn:s=>`<strong>${s.symbol}</strong>`},
        {fn:s=>`<span class="badge ${(s.conviction_score||0)>=75?"badge-green":"badge-yellow"}">${s.conviction_score||0}/100</span>`},
        {fn:s=>`<span class="${(s.xirr_pct||0)>=0?"green":"red"}">${pct(s.xirr_pct)}</span>`},
        {fn:s=>Math.round(s.avg_holding_days||0)+" days"},
      ])}</tbody></table>
    </div>
    <div class="footer">StockSage &nbsp;·&nbsp; Portfolio Analytics Engine &nbsp;·&nbsp; Generated ${date}</div>
    </body></html>`;

    const win = window.open("","_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  };

  // ── Anomaly engine ────────────────────────────────
  const buildAnomalies = () => {
    const anomalies = [];
    const avgHoldDays = stocks.reduce((s,x)=>s+(x.avg_holding_days||0),0) / (stocks.length||1);
    const avgXirr     = stocks.filter(s=>s.xirr_pct!=null).reduce((s,x)=>s+x.xirr_pct,0) / (stocks.filter(s=>s.xirr_pct!=null).length||1);
    const avgInvested = stocks.reduce((s,x)=>s+(x.total_invested||0),0) / (stocks.length||1);
    const totalPortfolio = stocks.reduce((sum,x)=>sum+(x.total_invested||0),0);
    const avgTrades   = stocks.reduce((sum,x)=>sum+(x.total_buy_trades||0)+(x.total_sell_trades||0),0) / (stocks.length||1);

    stocks.forEach(s => {
      if (s.avg_holding_days < avgHoldDays * 0.25 && s.avg_holding_days > 0)
        anomalies.push({ symbol:s.symbol, type:"panic_sell", title:"Possible Panic Sell",
          desc:`You held ${s.symbol} for only ${Math.round(s.avg_holding_days)} days — your average is ${Math.round(avgHoldDays)} days. This looks like an emotional exit.`,
          impact:s.total_pnl < 0 ? "high" : "medium", icon:"", pnl:s.total_pnl });

      const totalTrades = (s.total_buy_trades||0) + (s.total_sell_trades||0);
      if (totalTrades > avgTrades * 2.5 && totalTrades > 6)
        anomalies.push({ symbol:s.symbol, type:"overtrade", title:"Overtrading Detected",
          desc:`${s.symbol} has ${totalTrades} trades — ${Math.round(totalTrades/avgTrades)}x your average. Frequent trading usually destroys returns through brokerage and poor timing.`,
          impact:"high", icon:"⚠️", pnl:s.total_pnl });

      const share = (s.total_invested||0) / (totalPortfolio||1) * 100;
      if (share > 30)
        anomalies.push({ symbol:s.symbol, type:"concentration", title:"Concentration Risk",
          desc:`${Math.round(share)}% of your portfolio is in ${s.symbol} alone. A single bad quarter could significantly damage your overall returns.`,
          impact:"high", icon:"🎯", pnl:s.total_pnl });

      if ((s.conviction_score||0) < 35 && (s.total_invested||0) > avgInvested * 1.5)
        anomalies.push({ symbol:s.symbol, type:"low_conv_big_pos", title:"Big Bet, Low Conviction",
          desc:`You invested ${fmt(s.total_invested)} in ${s.symbol} but your conviction score is only ${s.conviction_score}/100. This suggests the position size doesn't match your behaviour pattern.`,
          impact:"medium", icon:"🤔", pnl:s.total_pnl });

      if ((s.xirr_pct||0) > avgXirr * 1.8 && (s.current_qty||0) === 0 && s.xirr_pct > 20)
        anomalies.push({ symbol:s.symbol, type:"sold_winner", title:"Sold Your Best Performer",
          desc:`${s.symbol} had a ${pct(s.xirr_pct)} XIRR — your best performer — but you fully exited. Research shows holding winners longer significantly compounds returns.`,
          impact:"low", icon:"💰", pnl:s.total_pnl });

      if ((s.xirr_pct||0) < -15 && s.avg_holding_days > avgHoldDays * 1.5)
        anomalies.push({ symbol:s.symbol, type:"held_loser", title:"Held a Loser Too Long",
          desc:`${s.symbol} returned ${pct(s.xirr_pct)} XIRR but you held it ${Math.round(s.avg_holding_days)} days — longer than your average. Hope is not a strategy.`,
          impact:"high", icon:"📉", pnl:s.total_pnl });

      if ((s.volatility_pct||0) < 15 && (s.xirr_pct||0) > 20 && (s.total_invested||0) < avgInvested * 0.5)
        anomalies.push({ symbol:s.symbol, type:"missed_opportunity", title:"Missed Opportunity",
          desc:`${s.symbol} gave ${pct(s.xirr_pct)} XIRR with low volatility (${pct(s.volatility_pct)}) — a very safe winner — but you only invested ${fmt(s.total_invested)}. You under-sized your best trade.`,
          impact:"low", icon:"🚀", pnl:s.total_pnl });
    });

    const impactOrder = { high:0, medium:1, low:2 };
    return anomalies.sort((a,b) => impactOrder[a.impact] - impactOrder[b.impact]);
  };

  const impactStyle = {
    high:   { bg:"#FEF2F2", border:"#DC2626", badge:"#DC2626", badgeBg:"#FEE2E2", label:"High Impact"   },
    medium: { bg:"#FFFBEB", border:"#D97706", badge:"#D97706", badgeBg:"#FEF3C7", label:"Medium Impact" },
    low:    { bg:"#EFF6FF", border:"#1A56DB", badge:"#1A56DB", badgeBg:"#DBEAFE", label:"Insight"       },
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"Georgia, serif" }}>

      {/* NAV */}
      <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"16px 48px", background:C.white, borderBottom:`1px solid ${C.border}`,
        position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 6px rgba(0,0,0,0.04)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"32px" }}>
          <img src={`data:image/png;base64,${LOGO_B64}`} alt="StockSage" style={{ height:"40px", objectFit:"contain" }}/>
          <div style={{ display:"flex", gap:"4px" }}>
            {TABS.map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{
                padding:"8px 18px", borderRadius:"8px", border:"none", cursor:"pointer",
                fontSize:"13px", fontWeight:"600", fontFamily:"Georgia, serif", textTransform:"capitalize",
                background:tab===t?C.blueSoft:"transparent", color:tab===t?C.blue:C.textSub
              }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
          <button onClick={onReupload} style={{ ...btn("soft"), padding:"8px 16px", fontSize:"13px" }}>Upload New Files</button>
          {summary && <button onClick={exportPDF} style={{
            padding:"8px 16px", borderRadius:"9px", border:`1.5px solid ${C.blue}`,
            background:C.white, color:C.blue, fontSize:"13px", fontWeight:"700",
            fontFamily:"Georgia,serif", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px"
          }}>⬇ Download PDF</button>}
          <div style={{ width:"36px", height:"36px", background:C.blue, borderRadius:"50%",
            display:"flex", alignItems:"center", justifyContent:"center",
            color:C.white, fontWeight:"700", fontSize:"14px" }}>{user.name[0].toUpperCase()}</div>
          <button onClick={onLogout} style={{ background:"none", border:"none", color:C.textSub, cursor:"pointer", fontSize:"13px" }}>Logout</button>
        </div>
      </nav>

      {!loading && stocks.length > 0 && <LivePnLBar stocks={stocks} />}

      {loading && (
        <div style={{ textAlign:"center", padding:"100px", color:C.textSub }}>
          <div style={{ fontSize:"32px", marginBottom:"16px" }}>⏳</div>Loading your portfolio...
        </div>
      )}

      {!loading && summary && (
        <div style={{ maxWidth:"1200px", margin:"0 auto", padding:"32px 24px" }}>

          {/* ── OVERVIEW ── */}
          {tab==="overview" && (
            <div style={{ animation:"fadeUp .5s ease" }}>
              <div style={{ marginBottom:"28px" }}>
                <h1 style={{ fontSize:"26px", color:C.text, margin:"0 0 4px" }}>Good day, {user.name} 👋</h1>
                <p style={{ color:C.textSub, margin:0, fontSize:"14px" }}>Here is your complete portfolio scorecard</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"16px", marginBottom:"28px" }}>
                <StatCard label="Total Invested"  value={fmt(summary.total_invested)} color={C.blue}/>
                <StatCard label="Current Value"   value={fmt(summary.total_current_value)} color={C.blue}/>
                <StatCard label="Total P&L"       value={fmt(summary.total_pnl)} sub={`${pct(summary.total_pnl_pct)} overall`}
                  color={summary.total_pnl>=0?C.green:C.red} bg={summary.total_pnl>=0?C.greenSoft:C.redSoft}/>
                <StatCard label="Best Stock"      value={summary.best_stock?.symbol} sub={`${pct(summary.best_stock?.xirr_pct)} XIRR`} color={C.green} bg={C.greenSoft}/>
                <StatCard label="Worst Stock"     value={summary.worst_stock?.symbol} sub={`${pct(summary.worst_stock?.xirr_pct)} XIRR`} color={C.red} bg={C.redSoft}/>
                <StatCard label="High Conviction" value={`${summary.high_conviction_count} stocks`} sub="Score ≥ 75" color={C.blue}/>
              </div>

              {/* ── Portfolio History Chart ── */}
              <HistoryChart />

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px", marginBottom:"20px" }}>
                <div style={{...card}}>
                  <div style={{ fontSize:"14px", fontWeight:"700", color:C.text, marginBottom:"20px" }}>Portfolio Allocation</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={pieData} cx="40%" cy="50%" outerRadius={95} dataKey="value" paddingAngle={2}>
                        {pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                      </Pie>
                      <Tooltip content={({active,payload})=>{
                        if(active&&payload&&payload.length){
                          const d=payload[0];
                          return(
                            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:"10px",padding:"12px 16px",boxShadow:"0 4px 16px rgba(0,0,0,0.1)",textAlign:"center",minWidth:"140px"}}>
                              <div style={{fontSize:"13px",fontWeight:"800",color:d.payload.fill||C.blue,marginBottom:"4px",letterSpacing:"0.5px"}}>{d.name}</div>
                              <div style={{fontSize:"11px",color:C.textSub,marginBottom:"6px"}}>Portfolio Value</div>
                              <div style={{fontSize:"17px",fontWeight:"800",color:C.text,fontFamily:"'Courier New',monospace"}}>{fmt(d.value)}</div>
                              <div style={{fontSize:"11px",color:C.textSub,marginTop:"5px",background:C.bg,borderRadius:"6px",padding:"3px 8px"}}>
                                {((d.value/d.payload.total)*100).toFixed(1)}% of portfolio
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}/>
                      <Legend iconType="circle" iconSize={8} formatter={v=><span style={{color:C.textSub,fontSize:"12px"}}>{v}</span>}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{...card}}>
                  <div style={{ fontSize:"14px", fontWeight:"700", color:C.text, marginBottom:"20px" }}>P&L by Stock</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={barData} margin={{left:10}}>
                      <XAxis dataKey="name" tick={{fill:C.textSub,fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:C.textSub,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}K`}/>
                      <Tooltip formatter={v=>[fmt(v),"P&L"]} contentStyle={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:"8px", fontSize:"13px" }}/>
                      <Bar dataKey="pnl" radius={[5,5,0,0]}>
                        {barData.map((e,i)=><Cell key={i} fill={e.pnl>=0?C.green:C.red} fillOpacity={0.85}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{...card}}>
                <div style={{ fontSize:"14px", fontWeight:"700", color:C.text, marginBottom:"16px" }}>Tax Classification</div>
                <div style={{ display:"flex", gap:"20px", flexWrap:"wrap" }}>
                  <div style={{ flex:1, background:C.greenSoft, borderRadius:"12px", padding:"20px 24px" }}>
                    <div style={{ fontSize:"12px", color:C.green, letterSpacing:"1px", marginBottom:"6px" }}>LTCG STOCKS</div>
                    <div style={{ fontSize:"28px", fontWeight:"800", color:C.green }}>{summary.ltcg_stocks}</div>
                    <div style={{ fontSize:"12px", color:C.textSub, marginTop:"4px" }}>Held {">"} 1 year · 10% tax</div>
                  </div>
                  <div style={{ flex:1, background:"#FFF7ED", borderRadius:"12px", padding:"20px 24px" }}>
                    <div style={{ fontSize:"12px", color:"#D97706", letterSpacing:"1px", marginBottom:"6px" }}>STCG STOCKS</div>
                    <div style={{ fontSize:"28px", fontWeight:"800", color:"#D97706" }}>{summary.stcg_stocks}</div>
                    <div style={{ fontSize:"12px", color:C.textSub, marginTop:"4px" }}>Held {"<"} 1 year · 15% tax</div>
                  </div>
                  <div style={{ flex:1, background:C.blueSoft, borderRadius:"12px", padding:"20px 24px" }}>
                    <div style={{ fontSize:"12px", color:C.blue, letterSpacing:"1px", marginBottom:"6px" }}>F&O NET P&L</div>
                    <div style={{ fontSize:"28px", fontWeight:"800", color:summary.fno_net_pnl>=0?C.green:C.red }}>{fmt(summary.fno_net_pnl)}</div>
                    <div style={{ fontSize:"12px", color:C.textSub, marginTop:"4px" }}>Win rate: {pct(summary.fno_win_rate_pct)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STOCKS ── */}
          {tab==="stocks" && (
            <div style={{ animation:"fadeUp .5s ease" }}>
              <h2 style={{ fontSize:"22px", color:C.text, marginBottom:"20px" }}>All Stocks</h2>
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                {stocks.map((s,i)=>(
                  <div key={s.symbol} onClick={()=>setSelected(selected?.symbol===s.symbol?null:s)}
                    style={{ ...card, padding:"18px 24px", cursor:"pointer",
                      border:selected?.symbol===s.symbol?`2px solid ${C.blue}`:`1px solid ${C.border}`,
                      animationDelay:`${i*30}ms`, animation:"fadeUp .4s ease both" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
                        <div style={{ width:"42px", height:"42px", background:C.blueSoft, borderRadius:"10px",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontWeight:"800", color:C.blue, fontSize:"13px" }}>{s.symbol.slice(0,2)}</div>
                        <div>
                          <div style={{ fontWeight:"700", color:C.text, fontSize:"15px" }}>{s.symbol}</div>
                          <div style={{ fontSize:"12px", color:C.textSub }}>{s.tax_classification} · {s.avg_holding_days?.toFixed(0)??0} days held</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:"28px", flexWrap:"wrap" }}>
                        {[{l:"P&L",v:fmt(s.total_pnl),c:pos(s.total_pnl)},{l:"Return",v:pct(s.total_pnl_pct),c:pos(s.total_pnl_pct)},
                          {l:"XIRR",v:pct(s.xirr_pct),c:pos(s.xirr_pct)},{l:"Beta",v:s.beta?.toFixed(2)??"—",c:C.text}].map(m=>(
                          <div key={m.l} style={{ textAlign:"right" }}>
                            <div style={{ fontSize:"11px", color:C.textSub, marginBottom:"2px" }}>{m.l}</div>
                            <div style={{ fontSize:"14px", fontWeight:"700", color:m.c }}>{m.v}</div>
                          </div>
                        ))}
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:"11px", color:C.textSub, marginBottom:"4px" }}>Conviction</div>
                          <span style={{ display:"inline-block", padding:"3px 12px", borderRadius:"20px", fontSize:"13px", fontWeight:"700",
                            background:s.conviction_score>=75?C.greenSoft:s.conviction_score>=50?"#FFF7ED":C.redSoft,
                            color:s.conviction_score>=75?C.green:s.conviction_score>=50?"#D97706":C.red }}>{s.conviction_score}</span>
                        </div>
                      </div>
                    </div>
                    {selected?.symbol===s.symbol && (
                      <div style={{ marginTop:"20px", paddingTop:"20px", borderTop:`1px solid ${C.border}`,
                        display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:"14px", animation:"fadeUp .3s ease" }}>
                        {[{l:"Total Invested",v:fmt(s.total_invested)},{l:"Current Value",v:fmt(s.current_value)},
                          {l:"Realized P&L",v:fmt(s.realized_pnl),c:pos(s.realized_pnl)},{l:"Unrealized P&L",v:fmt(s.unrealized_pnl),c:pos(s.unrealized_pnl)},
                          {l:"Avg Buy Price",v:fmt(s.avg_buy_price)},{l:"Last Price",v:fmt(s.last_price)},
                          {l:"Shares Held",v:s.current_qty??"—"},{l:"Volatility",v:pct(s.volatility_pct)},
                          {l:"Max Drawdown",v:pct(s.max_drawdown_pct),c:C.red},{l:"Buy Trades",v:s.total_buy_trades},
                          {l:"Sell Trades",v:s.total_sell_trades},{l:"First Buy",v:s.first_buy_date}].map(m=>(
                          <div key={m.l} style={{ background:C.bg, padding:"12px 14px", borderRadius:"10px" }}>
                            <div style={{ fontSize:"11px", color:C.textSub, marginBottom:"4px" }}>{m.l}</div>
                            <div style={{ fontSize:"14px", fontWeight:"700", color:m.c||C.text }}>{m.v??"—"}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ANALYSIS ── */}
          {tab==="analysis" && (
            <div style={{ animation:"fadeUp .5s ease" }}>
              <h2 style={{ fontSize:"22px", color:C.text, marginBottom:"20px" }}>Portfolio Analysis</h2>
              <div style={{ ...card, marginBottom:"20px" }}>
                <div style={{ fontSize:"14px", fontWeight:"700", color:C.text, marginBottom:"20px" }}>XIRR % per Stock (Annualized Return)</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stocks.filter(s=>s.xirr_pct!=null).sort((a,b)=>b.xirr_pct-a.xirr_pct).map(s=>({name:s.symbol,xirr:+s.xirr_pct.toFixed(1)}))}>
                    <XAxis dataKey="name" tick={{fill:C.textSub,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.textSub,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                    <Tooltip formatter={v=>[`${v}%`,"XIRR"]} contentStyle={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:"8px", fontSize:"13px" }}/>
                    <Bar dataKey="xirr" radius={[5,5,0,0]}>
                      {stocks.filter(s=>s.xirr_pct!=null).map((s,i)=>(
                        <Cell key={i} fill={s.xirr_pct>=12?C.green:s.xirr_pct>=0?C.blueLight:C.red}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display:"flex", gap:"16px", marginTop:"12px" }}>
                  {[["🟢 Green","> 12% (beating market)"],["🔵 Blue","0–12%"],["🔴 Red","Negative"]].map(([c,l])=>(
                    <div key={c} style={{ fontSize:"12px", color:C.textSub }}><strong>{c}</strong> {l}</div>
                  ))}
                </div>
              </div>
              <div style={{...card}}>
                <div style={{ fontSize:"14px", fontWeight:"700", color:C.text, marginBottom:"20px" }}>Conviction Score — How well did you invest?</div>
                <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                  {[...stocks].sort((a,b)=>(b.conviction_score||0)-(a.conviction_score||0)).map(s=>(
                    <div key={s.symbol} style={{ display:"flex", alignItems:"center", gap:"14px" }}>
                      <div style={{ width:"80px", fontSize:"13px", fontWeight:"600", color:C.text }}>{s.symbol}</div>
                      <div style={{ flex:1, background:C.bg, borderRadius:"6px", height:"10px", overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:"6px", width:`${s.conviction_score||0}%`,
                          background:s.conviction_score>=75?C.green:s.conviction_score>=50?"#F59E0B":C.red,
                          transition:"width 1s ease" }}/>
                      </div>
                      <div style={{ width:"36px", fontSize:"13px", fontWeight:"700", textAlign:"right",
                        color:s.conviction_score>=75?C.green:s.conviction_score>=50?"#D97706":C.red }}>{s.conviction_score}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:"20px", padding:"16px", background:C.bg, borderRadius:"10px", fontSize:"13px", color:C.textSub, lineHeight:1.6 }}>
                  💡 <strong style={{color:C.text}}>What is Conviction Score?</strong> It measures how well you behaved as an investor —
                  how long you held, how big your position was, whether you bought more on dips, and whether you sold at the right time.
                  Score of 75+ means you showed strong investor discipline for that stock.
                </div>
              </div>
            </div>
          )}

          {/* ── HEATMAP ── */}
          {tab==="heatmap" && (
            <div style={{ animation:"fadeUp .5s ease" }}>
              <div style={{ marginBottom:"24px" }}>
                <h2 style={{ fontSize:"22px", color:C.text, margin:"0 0 4px" }}>Sector Heatmap</h2>
                <p style={{ fontSize:"13px", color:C.textSub }}>Your stocks grouped by sector — color shows P&L performance</p>
              </div>
              <div style={{ display:"flex", gap:"20px", marginBottom:"24px", flexWrap:"wrap" }}>
                {[
                  { label:"Strong Gain  > +10%",  bg:"#14532d", text:"#86efac" },
                  { label:"Gain  0 to +10%",       bg:"#166534", text:"#bbf7d0" },
                  { label:"Small Gain  0 to +2%",  bg:"#dcfce7", text:"#166534" },
                  { label:"Small Loss  0 to -2%",  bg:"#fef2f2", text:"#dc2626" },
                  { label:"Loss  -2 to -10%",      bg:"#991b1b", text:"#fca5a5" },
                  { label:"Heavy Loss  < -10%",    bg:"#7f1d1d", text:"#fca5a5" },
                ].map(l => (
                  <div key={l.label} style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                    <div style={{ width:"14px", height:"14px", borderRadius:"3px", background:l.bg, flexShrink:0 }}/>
                    <span style={{ fontSize:"11px", color:C.textSub }}>{l.label}</span>
                  </div>
                ))}
              </div>

              {(() => {
                const grouped = {};
                stocks.forEach(s => {
                  const sector = SECTOR_MAP[s.symbol] || "Other";
                  if (!grouped[sector]) grouped[sector] = [];
                  grouped[sector].push(s);
                });
                return Object.entries(grouped)
                  .sort((a,b) => b[1].length - a[1].length)
                  .map(([sector, sectorStocks]) => (
                    <div key={sector} style={{ marginBottom:"24px" }}>
                      <div style={{ fontSize:"12px", fontWeight:"700", color:C.textSub,
                        letterSpacing:"2px", textTransform:"uppercase",
                        marginBottom:"10px", borderLeft:`3px solid ${C.blue}`, paddingLeft:"10px" }}>
                        {sector} <span style={{ fontWeight:"400", color:C.textLight }}>({sectorStocks.length} stocks)</span>
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"10px" }}>
                        {sectorStocks.map(s => {
                          const col  = getHeatColor(s.total_pnl_pct);
                          const size = Math.max(90, Math.min(160, 90 + Math.abs(s.total_invested || 0) / 20000));
                          return (
                            <div key={s.symbol} style={{
                              width:`${size}px`, height:`${size}px`,
                              background:col.bg, border:`1.5px solid ${col.border}`,
                              borderRadius:"12px", display:"flex", flexDirection:"column",
                              alignItems:"center", justifyContent:"center",
                              padding:"10px", textAlign:"center", cursor:"pointer",
                              transition:"transform .15s, box-shadow .15s",
                            }}
                              onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.06)";e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,0.15)";}}
                              onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="none";}}>
                              <div style={{ fontSize:"12px", fontWeight:"800", color:col.text, marginBottom:"4px", wordBreak:"break-all" }}>{s.symbol}</div>
                              <div style={{ fontSize:"15px", fontWeight:"900", color:col.text }}>
                                {s.total_pnl_pct != null ? `${s.total_pnl_pct >= 0 ? "+" : ""}${Number(s.total_pnl_pct).toFixed(1)}%` : "—"}
                              </div>
                              <div style={{ fontSize:"10px", color:col.text, opacity:0.75, marginTop:"3px" }}>{fmt(s.total_pnl)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
              })()}

              <div style={{ ...card, marginTop:"8px", padding:"18px 24px",
                display:"flex", gap:"32px", flexWrap:"wrap", alignItems:"center" }}>
                <div style={{ fontSize:"13px", fontWeight:"700", color:C.text }}>Portfolio at a glance</div>
                {[
                  { label:"Gaining",  value:stocks.filter(s=>(s.total_pnl_pct||0)>=0).length, color:C.green },
                  { label:"Losing",   value:stocks.filter(s=>(s.total_pnl_pct||0)<0).length,  color:C.red   },
                  { label:"Up >10%",  value:stocks.filter(s=>(s.total_pnl_pct||0)>=10).length, color:"#14532d" },
                  { label:"Down >10%",value:stocks.filter(s=>(s.total_pnl_pct||0)<=-10).length,color:"#7f1d1d" },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize:"20px", fontWeight:"900", color:item.color, fontFamily:"'Courier New',monospace" }}>{item.value}</div>
                    <div style={{ fontSize:"11px", color:C.textSub }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ANOMALIES ── */}
          {tab==="anomalies" && (
            <div style={{ animation:"fadeUp .5s ease" }}>
              <div style={{ marginBottom:"24px" }}>
                <h2 style={{ fontSize:"22px", color:C.text, margin:"0 0 4px" }}>🔍 Anomaly Detection</h2>
                <p style={{ fontSize:"13px", color:C.textSub }}>
                  AI-powered analysis of your trading behaviour — flags unusual patterns in your personal trade history
                </p>
              </div>

              {(() => {
                const anomalies = buildAnomalies();
                return (
                  <div>
                    <div style={{ display:"flex", gap:"16px", marginBottom:"28px", flexWrap:"wrap" }}>
                      {[
                        { label:"Total Flags",   value:anomalies.length,                                        color:C.text   },
                        { label:"High Impact",   value:anomalies.filter(a=>a.impact==="high").length,           color:C.red    },
                        { label:"Medium Impact", value:anomalies.filter(a=>a.impact==="medium").length,         color:"#D97706"},
                        { label:"Insights",      value:anomalies.filter(a=>a.impact==="low").length,            color:C.blue   },
                        { label:"Stocks Flagged",value:new Set(anomalies.map(a=>a.symbol)).size,                color:C.text   },
                      ].map(item => (
                        <div key={item.label} style={{ ...card, padding:"16px 22px", flex:1, minWidth:"120px", textAlign:"center" }}>
                          <div style={{ fontSize:"28px", fontWeight:"900", color:item.color, fontFamily:"'Courier New',monospace" }}>{item.value}</div>
                          <div style={{ fontSize:"11px", color:C.textSub, marginTop:"4px", letterSpacing:"0.5px" }}>{item.label}</div>
                        </div>
                      ))}
                    </div>

                    {anomalies.length === 0 ? (
                      <div style={{ ...card, textAlign:"center", padding:"60px 40px" }}>
                        <div style={{ fontSize:"48px", marginBottom:"16px" }}>🎉</div>
                        <h3 style={{ fontSize:"20px", color:C.green, marginBottom:"8px" }}>No anomalies detected!</h3>
                        <p style={{ color:C.textSub, fontSize:"14px" }}>Your trading behaviour looks consistent and disciplined. Keep it up.</p>
                      </div>
                    ) : (
                      <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                        {anomalies.map((a, i) => {
                          const st = impactStyle[a.impact];
                          return (
                            <div key={i} style={{
                              background:st.bg, border:`1.5px solid ${st.border}`,
                              borderRadius:"14px", padding:"20px 24px",
                              display:"flex", gap:"18px", alignItems:"flex-start",
                              animation:`fadeUp .4s ease ${i*60}ms both`
                            }}>
                              <div style={{ fontSize:"28px", flexShrink:0, marginTop:"2px" }}>{a.icon}</div>
                              <div style={{ flex:1 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px", flexWrap:"wrap" }}>
                                  <span style={{ fontSize:"15px", fontWeight:"800", color:C.text }}>{a.title}</span>
                                  <span style={{ fontSize:"11px", fontWeight:"700", padding:"2px 10px", borderRadius:"20px",
                                    background:st.badgeBg, color:st.badge }}>{st.label}</span>
                                  <span style={{ fontSize:"12px", fontWeight:"700", padding:"2px 10px", borderRadius:"20px",
                                    background:C.blueSoft, color:C.blue }}>{a.symbol}</span>
                                </div>
                                <p style={{ fontSize:"13.5px", color:C.textSub, lineHeight:1.65, margin:0 }}>{a.desc}</p>
                              </div>
                              <div style={{ textAlign:"right", flexShrink:0 }}>
                                <div style={{ fontSize:"11px", color:C.textSub, marginBottom:"2px" }}>P&L</div>
                                <div style={{ fontSize:"14px", fontWeight:"800", fontFamily:"'Courier New',monospace",
                                  color:a.pnl >= 0 ? C.green : C.red }}>
                                  {a.pnl >= 0 ? "+" : ""}{fmt(a.pnl)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ ...card, marginTop:"20px", padding:"18px 24px",
                      background:"linear-gradient(135deg,#EEF2FF,#F8FAFF)", border:`1px solid ${C.blueSoft}` }}>
                      <div style={{ fontSize:"13px", fontWeight:"700", color:C.blue, marginBottom:"6px" }}>
                        💡 How does Anomaly Detection work?
                      </div>
                      <p style={{ fontSize:"13px", color:C.textSub, lineHeight:1.7, margin:0 }}>
                        StockSage compares each stock in your portfolio against your own average behaviour —
                        holding period, trade frequency, position size, conviction score and XIRR. When a stock
                        deviates significantly from your personal baseline, it gets flagged. This is not generic advice —
                        it is based entirely on your own trading patterns.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── TAX OPTIMIZER ── */}
          {tab==="tax" && <TaxOptimizer />}

        </div>
      )}
    </div>
  );
}