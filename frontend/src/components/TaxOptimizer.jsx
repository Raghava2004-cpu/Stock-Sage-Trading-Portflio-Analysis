// components/TaxOptimizer.jsx — StockSage
// Shows tax-loss harvesting opportunities computed by the backend

import { useState, useEffect } from "react";
import axios from "axios";
import { C, card, fmt, API } from "../constants";

const LTCG_EXEMPTION = 125000;

function SummaryCard({ label, value, sub, color, bg, large }) {
  return (
    <div style={{ ...card, background: bg || C.bgCard, padding: "20px 24px", flex: 1, minWidth: "140px" }}>
      <div style={{ fontSize: "11px", color: C.textSub, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "8px" }}>{label}</div>
      <div style={{ fontSize: large ? "28px" : "22px", fontWeight: "900", color: color || C.text, fontFamily: "'Courier New', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: "12px", color: C.textSub, marginTop: "4px" }}>{sub}</div>}
    </div>
  );
}

export default function TaxOptimizer() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [checked, setChecked] = useState({});   // which suggestions are selected

  useEffect(() => {
    axios.get(`${API}/portfolio/tax-harvest`)
      .then(r => {
        setData(r.data);
        // Default: select all suggestions
        const init = {};
        r.data.suggestions.forEach((s, i) => { init[i] = true; });
        setChecked(init);
      })
      .catch(e => setError(e.response?.data?.detail || "Failed to load tax data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "80px", color: C.textSub }}>
      <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
      Calculating your tax opportunities...
    </div>
  );

  if (error) return (
    <div style={{ ...card, textAlign: "center", padding: "60px", color: C.red }}>{error}</div>
  );

  if (!data) return null;

  const { summary, suggestions, note } = data;

  // Recompute savings based on checked selections
  const selectedSavings = suggestions
    .filter((_, i) => checked[i])
    .reduce((sum, s) => sum + s.tax_saved, 0);

  const taxAfterSelected = Math.max(0, summary.total_current_tax - selectedSavings);

  const impactLevel = (saved) => {
    if (saved >= 10000) return { label: "High Impact", bg: "#ECFDF5", color: C.green };
    if (saved >= 2000)  return { label: "Medium Impact", bg: "#FFFBEB", color: "#D97706" };
    return                     { label: "Insight",       bg: C.blueSoft, color: C.blue };
  };

  return (
    <div style={{ animation: "fadeUp .5s ease" }}>

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "22px", color: C.text, margin: "0 0 4px" }}>🌿 Tax Optimizer</h2>
        <p style={{ fontSize: "13px", color: C.textSub }}>
          Book unrealized losses strategically to legally reduce your tax bill this financial year
        </p>
      </div>

      {/* Current Tax Situation */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "12px", fontWeight: "700", color: C.textSub, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px", borderLeft: `3px solid ${C.blue}`, paddingLeft: "10px" }}>
          Current Tax Situation
        </div>
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
          <SummaryCard
            label="LTCG Gains"
            value={fmt(summary.ltcg_gains)}
            sub={summary.ltcg_gains > LTCG_EXEMPTION ? `₹${((summary.ltcg_gains - LTCG_EXEMPTION)/1000).toFixed(0)}K above exemption` : "Within ₹1.25L exemption"}
            color={summary.ltcg_gains > LTCG_EXEMPTION ? C.red : C.green}
            bg={summary.ltcg_gains > LTCG_EXEMPTION ? C.redSoft : C.greenSoft}
          />
          <SummaryCard
            label="STCG Gains"
            value={fmt(summary.stcg_gains)}
            sub="Taxed at 20%"
            color={summary.stcg_gains > 0 ? C.red : C.green}
            bg={summary.stcg_gains > 0 ? C.redSoft : C.greenSoft}
          />
          <SummaryCard
            label="LTCG Tax Owed"
            value={fmt(summary.current_ltcg_tax)}
            sub="At 12.5% above ₹1.25L"
            color={C.red}
            bg={C.redSoft}
          />
          <SummaryCard
            label="STCG Tax Owed"
            value={fmt(summary.current_stcg_tax)}
            sub="At 20%"
            color={C.red}
            bg={C.redSoft}
          />
          <SummaryCard
            label="Total Tax Bill"
            value={fmt(summary.total_current_tax)}
            color={C.red}
            bg={C.redSoft}
            large
          />
        </div>
      </div>

      {/* After Harvesting Preview */}
      {suggestions.length > 0 && (
        <div style={{
          ...card,
          background: "linear-gradient(135deg, #ECFDF5, #F0FDF4)",
          border: `1.5px solid ${C.green}`,
          marginBottom: "28px",
          display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: "12px", color: C.green, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "6px" }}>
              After Selected Harvests
            </div>
            <div style={{ fontSize: "36px", fontWeight: "900", color: C.green, fontFamily: "'Courier New', monospace" }}>
              {fmt(taxAfterSelected)}
            </div>
            <div style={{ fontSize: "13px", color: C.textSub, marginTop: "4px" }}>estimated tax bill</div>
          </div>
          <div style={{ borderLeft: `1px solid ${C.green}`, paddingLeft: "32px" }}>
            <div style={{ fontSize: "12px", color: C.green, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "6px" }}>
              You Save
            </div>
            <div style={{ fontSize: "36px", fontWeight: "900", color: C.green, fontFamily: "'Courier New', monospace" }}>
              {fmt(selectedSavings)}
            </div>
            <div style={{ fontSize: "13px", color: C.textSub, marginTop: "4px" }}>
              from {suggestions.filter((_, i) => checked[i]).length} trades
            </div>
          </div>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <div style={{ fontSize: "13px", color: C.textSub, lineHeight: 1.7 }}>
              💡 Select which stocks to harvest below. The savings update in real time.
              You can deselect any stock if you want to keep holding it.
            </div>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "60px 40px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎉</div>
          <h3 style={{ fontSize: "20px", color: C.green, marginBottom: "8px" }}>No harvesting needed!</h3>
          <p style={{ color: C.textSub, fontSize: "14px", maxWidth: "420px", margin: "0 auto" }}>
            Either your gains are within the ₹1.25L LTCG exemption, or you have no unrealized losses to book.
            Your tax situation looks clean.
          </p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: "12px", fontWeight: "700", color: C.textSub, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px", borderLeft: `3px solid ${C.green}`, paddingLeft: "10px" }}>
            Harvesting Opportunities — {suggestions.length} found
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
            {suggestions.map((s, i) => {
              const impact = impactLevel(s.tax_saved);
              const isChecked = checked[i] !== false;
              return (
                <div
                  key={i}
                  onClick={() => setChecked(prev => ({ ...prev, [i]: !isChecked }))}
                  style={{
                    ...card,
                    cursor: "pointer",
                    border: `1.5px solid ${isChecked ? C.green : C.border}`,
                    background: isChecked ? "#F0FDF4" : C.white,
                    padding: "20px 24px",
                    display: "flex", gap: "20px", alignItems: "flex-start",
                    transition: "all .2s",
                    animation: `fadeUp .4s ease ${i * 60}ms both`,
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: "22px", height: "22px", borderRadius: "6px", flexShrink: 0, marginTop: "2px",
                    background: isChecked ? C.green : C.white,
                    border: `2px solid ${isChecked ? C.green : C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: C.white, fontSize: "14px", fontWeight: "900",
                  }}>
                    {isChecked ? "✓" : ""}
                  </div>

                  {/* Stock badge */}
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "10px",
                    background: C.redSoft, display: "flex", alignItems: "center",
                    justifyContent: "center", fontWeight: "800", color: C.red,
                    fontSize: "12px", flexShrink: 0,
                  }}>
                    {s.symbol.slice(0, 2)}
                  </div>

                  {/* Main content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "15px", fontWeight: "800", color: C.text }}>{s.symbol}</span>
                      <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 10px", borderRadius: "20px", background: impact.bg, color: impact.color }}>
                        {impact.label}
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 10px", borderRadius: "20px", background: C.blueSoft, color: C.blue }}>
                        Offsets {s.offset_from} gains
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: C.textSub, lineHeight: 1.6 }}>
                      {s.action} — book a loss of <strong style={{ color: C.red }}>{fmt(s.unrealized_pnl)}</strong> to
                      {s.offset_from === "Carry Forward"
                        ? " carry forward to next financial year"
                        : ` offset your ${s.offset_from} gains`
                      }
                    </div>
                  </div>

                  {/* Tax saved */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "11px", color: C.textSub, marginBottom: "4px" }}>Tax Saved</div>
                    <div style={{ fontSize: "20px", fontWeight: "900", color: C.green, fontFamily: "'Courier New', monospace" }}>
                      {s.tax_saved > 0 ? fmt(s.tax_saved) : "Carry fwd"}
                    </div>
                    <div style={{ fontSize: "11px", color: C.textSub, marginTop: "2px" }}>
                      Loss: {fmt(s.unrealized_pnl)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Tax Rules Explainer */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        {[
          { title: "LTCG Rules (held > 1 year)", points: ["First ₹1,25,000 of LTCG gains are tax-free", "Gains above ₹1.25L taxed at 12.5%", "Losses can offset LTCG gains of the same year", "Unabsorbed losses carry forward for 8 years"] },
          { title: "STCG Rules (held < 1 year)", points: ["All STCG gains taxed at flat 20%", "STCG losses offset STCG or LTCG gains", "No exemption limit — every rupee is taxable", "Losses carry forward for 8 years"] },
        ].map(({ title, points }) => (
          <div key={title} style={{ ...card, padding: "20px 24px" }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: C.text, marginBottom: "12px" }}>{title}</div>
            {points.map(p => (
              <div key={p} style={{ display: "flex", gap: "8px", marginBottom: "8px", fontSize: "12px", color: C.textSub, lineHeight: 1.5 }}>
                <span style={{ color: C.blue, flexShrink: 0 }}>→</span> {p}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div style={{ ...card, background: "#FFFBEB", border: "1px solid #FDE68A", padding: "16px 20px" }}>
        <div style={{ fontSize: "12px", color: "#92400E", lineHeight: 1.7 }}>
          ⚠️ <strong>Important:</strong> {note} Tax rules shown reflect FY 2024-25 rates (Budget 2024 update).
          Wash sale rules do not apply in India — you can repurchase the same stock immediately after selling for a loss.
          However, it is considered better practice to wait at least 30 days.
        </div>
      </div>
    </div>
  );
}