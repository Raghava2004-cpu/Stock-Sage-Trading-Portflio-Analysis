// components/HistoryChart.jsx — StockSage
// Portfolio value over time — one data point per CSV upload snapshot

import { useState, useEffect } from "react";
import axios from "axios";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { C, card, fmt, API } from "../constants";

// NOTE: CustomTooltip must be defined as a function reference, NOT as <CustomTooltip />.
// Passing content={<CustomTooltip />} (JSX instance) breaks recharts per-point updates —
// recharts cannot re-render it with new payload on each hover. Always use content={CustomTooltip}.
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  // Compute P&L directly from the two visible values — avoids stored DB mismatch
  const computedPnl    = (d.total_current_value || 0) - (d.total_invested || 0);
  const computedPnlPct = d.total_invested > 0 ? (computedPnl / d.total_invested * 100) : 0;
  const up             = computedPnl >= 0;

  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: "12px", padding: "14px 18px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.1)", minWidth: "180px",
    }}>
      <div style={{ fontSize: "12px", color: C.textSub, marginBottom: "8px" }}>{d.label}</div>
      <div style={{ fontSize: "16px", fontWeight: "800", color: C.blue, fontFamily: "'Courier New',monospace", marginBottom: "4px" }}>
        {fmt(d.total_current_value)}
      </div>
      <div style={{ fontSize: "12px", color: C.textSub }}>Invested: {fmt(d.total_invested)}</div>
      <div style={{ fontSize: "12px", fontWeight: "700", color: up ? C.green : C.red, marginTop: "4px" }}>
        P&L: {up ? "+" : ""}{fmt(computedPnl)} ({up ? "+" : ""}{computedPnlPct.toFixed(1)}%)
      </div>
    </div>
  );
};

export default function HistoryChart() {
  const [history, setHistory] = useState([]);
  const [nifty,   setNifty]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/portfolio/history`),
      axios.get(`${API}/prices/nifty`).catch(() => ({ data: null })),
    ]).then(([histRes, niftyRes]) => {
      // Add numeric index — used as XAxis dataKey so recharts can uniquely
      // identify each point even when all dates are the same day
      const data = (histRes.data || []).map((item, i) => ({ ...item, idx: i }));
      setHistory(data);
      setNifty(niftyRes.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  // Need at least 2 snapshots to show a meaningful chart
  if (history.length < 2) {
    return (
      <div style={{ ...card, marginBottom: "20px", padding: "24px" }}>
        <div style={{ fontSize: "14px", fontWeight: "700", color: C.text, marginBottom: "8px" }}>
          Portfolio Value Over Time
        </div>
        <div style={{ fontSize: "13px", color: C.textSub, padding: "20px 0" }}>
          📈 Upload your CSV again next month and this chart will show your portfolio growth over time.
          Each upload creates a snapshot — the more you upload, the richer this chart becomes.
        </div>
      </div>
    );
  }

  const latestValue    = history[history.length - 1]?.total_current_value || 0;
  const latestInvested = history[history.length - 1]?.total_invested || 0;
  const firstInvested  = history[0]?.total_invested || 0;
  const totalGrowth    = latestInvested > 0 ? ((latestValue - latestInvested) / latestInvested * 100) : 0;
  const isUp           = totalGrowth >= 0;

  return (
    <div style={{ ...card, marginBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: "700", color: C.text, marginBottom: "4px" }}>
            Portfolio Value Over Time
          </div>
          <div style={{ fontSize: "12px", color: C.textSub }}>
            {history.length} snapshots · from {history[0]?.label} to {history[history.length - 1]?.label}
          </div>
        </div>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", color: C.textSub, letterSpacing: "1px" }}>YOUR RETURN</div>
            <div style={{ fontSize: "18px", fontWeight: "900", color: isUp ? C.green : C.red, fontFamily: "'Courier New',monospace" }}>
              {isUp ? "+" : ""}{totalGrowth.toFixed(1)}%
            </div>
          </div>
          {nifty?.one_year_return != null && (
            <div style={{ textAlign: "right", paddingLeft: "20px", borderLeft: `1px solid ${C.border}` }}>
              <div style={{ fontSize: "11px", color: C.textSub, letterSpacing: "1px" }}>NIFTY 50</div>
              <div style={{ fontSize: "18px", fontWeight: "900", color: nifty.one_year_return >= 0 ? C.green : C.red, fontFamily: "'Courier New',monospace" }}>
                {nifty.one_year_return >= 0 ? "+" : ""}{nifty.one_year_return.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={history} margin={{ left: 10, right: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={isUp ? C.green : C.red} stopOpacity={0.15}/>
              <stop offset="95%" stopColor={isUp ? C.green : C.red} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.blue} stopOpacity={0.08}/>
              <stop offset="95%" stopColor={C.blue} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
          <XAxis
            dataKey="idx"
            tickFormatter={(_,i) => history[i]?.label || ""}
            tick={{ fill: C.textSub, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: C.textSub, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `₹${(v / 100000).toFixed(1)}L`}
          />

          {/* FIX: pass component reference, not JSX instance — content={CustomTooltip} not content={<CustomTooltip />} */}
          <Tooltip content={CustomTooltip} />

          <ReferenceLine
            y={firstInvested}
            stroke={C.blue}
            strokeDasharray="4 4"
            label={{ value: "Invested", position: "insideTopLeft", fill: C.blue, fontSize: 11 }}
          />
          {/* Invested amount — baseline */}
          <Area
            type="monotone"
            dataKey="total_invested"
            stroke={C.blue}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="url(#investedGrad)"
            dot={false}
            name="Amount Invested"
          />
          {/* Current value — main line */}
          <Area
            type="monotone"
            dataKey="total_current_value"
            stroke={isUp ? C.green : C.red}
            strokeWidth={2.5}
            fill="url(#valueGrad)"
            dot={{ r: 4, fill: isUp ? C.green : C.red, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            name="Portfolio Value"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div style={{ display: "flex", gap: "20px", marginTop: "14px", fontSize: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "20px", height: "2px", background: isUp ? C.green : C.red }}/>
          <span style={{ color: C.textSub }}>Portfolio Value</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "20px", height: "2px", background: C.blue, borderTop: "2px dashed " + C.blue }}/>
          <span style={{ color: C.textSub }}>Amount Invested</span>
        </div>
        {nifty?.one_year_return != null && (
          <div style={{ marginLeft: "auto", color: C.textSub }}>
            {totalGrowth > nifty.one_year_return
              ? `✅ You beat Nifty by ${(totalGrowth - nifty.one_year_return).toFixed(1)}%`
              : `📉 Nifty beat you by ${(nifty.one_year_return - totalGrowth).toFixed(1)}%`
            }
          </div>
        )}
      </div>
    </div>
  );
}