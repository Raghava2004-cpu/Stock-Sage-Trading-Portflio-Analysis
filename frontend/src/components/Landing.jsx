// components/Landing.jsx
import { useEffect, useRef } from "react";
import { C, btn } from "../constants";
import CandleChart from "./CandleChart";
import TickerTape from "./TickerTape";
import LOGO_B64 from "../logoBase64";

// ── Animated Particles Background ────────────────────
function ParticlesBg() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H, particles = [], raf;

    const COLORS = ["#1beb0c","#ef1509","#6366F1","#059669","#0bc7f6"];

    // eslint-disable-next-line react-hooks/unsupported-syntax
    class Particle {
      constructor() { this.reset(true); }
      reset(init = false) {
        this.x = Math.random() * W;
        this.y = init ? Math.random() * H : H + 20;
        this.r = Math.random() * 18 + 6;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = -(Math.random() * 0.5 + 0.2);
        this.alpha = 0;
        this.maxAlpha = Math.random() * 0.12 + 0.04;
        this.fadeIn = true;
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.pulse = Math.random() * Math.PI * 2;
        this.pulseSpeed = Math.random() * 0.02 + 0.01;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.pulse += this.pulseSpeed;
        const pa = this.maxAlpha + Math.sin(this.pulse) * 0.025;
        if (this.fadeIn) {
          this.alpha = Math.min(this.alpha + 0.003, pa);
          if (this.alpha >= pa - 0.001) this.fadeIn = false;
        } else { this.alpha = pa; }
        if (this.y < -this.r * 2) this.reset();
      }
      draw() {
        const hex = Math.floor(this.alpha * 255).toString(16).padStart(2,"0");
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 2.5);
        grad.addColorStop(0, this.color + hex);
        grad.addColorStop(1, this.color + "00");
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 2.5, 0, Math.PI*2);
        ctx.fillStyle = grad; ctx.fill();
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
        ctx.fillStyle = this.color + Math.floor(Math.min(this.alpha*1.8,1)*255).toString(16).padStart(2,"0");
        ctx.fill();
      }
    }

    function init() {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      particles = Array.from({ length: 38 }, () => new Particle());
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 120) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(26,86,219,${(1 - dist/120) * 0.07})`; ctx.lineWidth = 1; ctx.stroke();
          }
        }
        particles[i].update(); particles[i].draw();
      }
      raf = requestAnimationFrame(draw);
    }

    init(); draw();
    const onResize = () => init();
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position:"absolute", inset:0, width:"100%", height:"100%",
      pointerEvents:"none", zIndex:0
    }}/>
  );
}

export default function Landing({ onLogin }) {
  return (
    <div style={{ minHeight:"100vh", background:C.white, fontFamily:"Georgia, serif", display:"flex", flexDirection:"column" }}>

      {/* ── NAV ── */}
      <nav style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"0 60px", height:"68px", background:C.white,
        borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, zIndex:100,
        boxShadow:"0 1px 4px rgba(0,0,0,0.05)"
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"34px", height:"34px", background:C.blue, borderRadius:"8px",
            display:"flex", alignItems:"center", justifyContent:"center",
            color:C.white, fontWeight:"900", fontSize:"16px" }}>S</div>
          <span style={{ fontSize:"17px", fontWeight:"700", color:C.text }}>Stock<span style={{color:C.blue}}>Sage</span></span>
        </div>
        <div style={{ display:"flex", gap:"12px" }}>
          <button style={btn("outline")} onClick={()=>onLogin("login")}>Login</button>
          <button style={btn("primary")} onClick={()=>onLogin("signup")}>Sign Up Free</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{
        flex:1, display:"flex", flexDirection:"column", alignItems:"center",
        padding:"52px 32px 0", position:"relative", overflow:"hidden",
        background:"linear-gradient(180deg, #F0F4FF 0%, #ffffff 100%)",
      }}>
        <ParticlesBg />

        <div style={{ marginBottom:"24px", animation:"fadeUp .6s ease both", position:"relative", zIndex:1 }}>
          <img src={`data:image/png;base64,${LOGO_B64}`} alt="StockSage"
            style={{ height:"170px", maxWidth:"560px", width:"auto", objectFit:"contain",
              filter:"drop-shadow(0 2px 16px rgba(0,73,159,0.12))" }} />
        </div>

        <div style={{ display:"inline-block", background:C.bluesoft, color:C.blue,
          fontSize:"13px", fontWeight:"700", letterSpacing:"3px",
          padding:"7px 20px", borderRadius:"20px", marginBottom:"18px",
          textTransform:"uppercase", animation:"fadeUp .7s ease .1s both",
          position:"relative", zIndex:1 }}>
          Portfolio Analytics Engine
        </div>

        <h1 style={{
          fontFamily:"Georgia, serif", fontSize:"clamp(26px,4vw,46px)", fontWeight:"900",
          color:C.text, lineHeight:1.2, textAlign:"center", marginBottom:"32px",
          animation:"fadeUp .8s ease .15s both", position:"relative", zIndex:1
        }}>
          Know Exactly How Well<br/><span style={{color:C.blue}}>you Invested.</span>
        </h1>

        <div style={{ width:"100%", maxWidth:"860px", animation:"fadeUp .9s ease .2s both", position:"relative", zIndex:1 }}>
          <CandleChart />
        </div>

        <div style={{ height:"56px" }} />
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ background:C.bg, padding:"80px 60px", borderTop:`1px solid ${C.border}` }}>
        <div style={{ maxWidth:"1060px", margin:"0 auto" }}>
          <div style={{ fontSize:"18px", letterSpacing:"2.5px", textTransform:"uppercase",
            color:C.blue, fontWeight:"900", textAlign:"center", marginBottom:"10px" }}>PRIVATE AND SAFE</div>
          <h2 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(24px,3.5vw,38px)", fontWeight:"900",
            color:C.text, textAlign:"center", marginBottom:"10px" }}>How it works</h2>
          <p style={{ textAlign:"center", color:C.textSub, fontSize:"15px", marginBottom:"48px", lineHeight:1.7 }}>
            Three steps from your Trading account to a full portfolio scorecard
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"28px" }}>
            {[
              { step:"1", icon:"📥", title:"Downloading CSV Files", desc:"Login to your Trading Website.com → Reports → Tradebook. Download your Equity CSV, F&O CSV, and Holdings CSV. Takes less than 2 minutes." },
              { step:"2", icon:"⚡", title:"Upload Your Files",      desc:"Drop your 3 CSV files into StockSage. Our engine automatically cleans, validates and processes your entire trade history — equity, F&O and holdings." },
              { step:"3", icon:"📊", title:"Get Our Trading Analysis",    desc:"Get XIRR per stock, conviction score, LTCG/STCG tax breakdown, F&O win rate and full P&L and predictions— all in one clean, visual report Download Free Pdf .In under 10 seconds." },
            ].map(s => (
              <div key={s.step} style={{
                background:C.white, border:`1.5px solid ${C.border}`, borderRadius:"18px",
                padding:"36px 28px", textAlign:"center",
                transition:"transform .25s, box-shadow .25s"
              }}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-5px)";e.currentTarget.style.boxShadow="0 12px 40px rgba(26,86,219,0.1)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none";}}>
                <div style={{ display:"inline-flex", width:"36px", height:"36px", background:C.blue,
                  color:C.white, borderRadius:"50%", fontSize:"13px", fontWeight:"700",
                  alignItems:"center", justifyContent:"center", marginBottom:"16px",
                  boxShadow:"0 4px 12px rgba(26,86,219,0.3)" }}>{s.step}</div>
                <div style={{ fontSize:"34px", marginBottom:"12px" }}>{s.icon}</div>
                <h3 style={{ fontFamily:"Georgia,serif", fontSize:"17px", fontWeight:"700",
                  color:C.text, marginBottom:"12px" }}>{s.title}</h3>
                <p style={{ fontSize:"13.5px", color:C.textSub, lineHeight:1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{
        background:"linear-gradient(135deg, #1A56DB, #1e3a8a)",
        padding:"80px 60px", textAlign:"center", position:"relative", overflow:"hidden"
      }}>
        <div style={{ position:"absolute", inset:0,
          backgroundImage:"radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize:"24px 24px", pointerEvents:"none" }}/>
        <div style={{ display:"inline-block", background:"rgba(255,255,255,0.15)", color:C.white,
          fontSize:"15px", fontWeight:"700", letterSpacing:"2.5px",
          padding:"6px 18px", borderRadius:"20px", marginBottom:"20px", textTransform:"uppercase" }}>
          Ready to find out?
        </div>
        <h2 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(30px,4vw,42px)", fontWeight:"900",
          color:C.white, marginBottom:"15px", lineHeight:1.2, position:"relative", zIndex:2 }}>
          Ready to see your Trading Analysis?
        </h2>
        <p style={{ fontSize:"15px", color:"rgba(255,255,255,0.7)", marginBottom:"36px",
          maxWidth:"480px", marginLeft:"auto", marginRight:"auto", lineHeight:1.7, position:"relative", zIndex:2 }}>
          Join thousands of Global investors who finally understand their true portfolio performance. Free. Instant. Private.
        </p>
        <div style={{ display:"flex", gap:"16px", justifyContent:"center", flexWrap:"wrap", position:"relative", zIndex:2 }}>
          <button onClick={()=>onLogin("login")} style={{
            padding:"15px 38px", borderRadius:"11px", border:"2px solid rgba(255,255,255,0.5)",
            background:"transparent", color:C.white, fontSize:"15px", fontWeight:"700",
            fontFamily:"Georgia,serif", cursor:"pointer"
          }}>Login</button>
          <button onClick={()=>onLogin("signup")} style={{
            padding:"15px 38px", borderRadius:"11px", border:"none",
            background:C.white, color:C.blue, fontSize:"15px", fontWeight:"700",
            fontFamily:"Georgia,serif", cursor:"pointer",
            boxShadow:"0 6px 24px rgba(0,0,0,0.2)"
          }}>Create Free Account →</button>
        </div>
        <div style={{ display:"flex", justifyContent:"center", gap:"48px", marginTop:"40px",
          flexWrap:"wrap", position:"relative", zIndex:2 }}>
          {[["XIRR","PER STOCK"],["100% Correct","CONVICTION SCORE"],["F&O","WIN RATE"],["<10 Sec","INSTANT REPORT"]].map(([v,l])=>(
            <div key={l}>
              <div style={{ fontFamily:"Georgia,serif", fontSize:"26px", fontWeight:"900", color:C.white }}>{v}</div>
              <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.55)", letterSpacing:"1.5px", marginTop:"2px" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <TickerTape />

      <div style={{ background:"#0F172A", color:"rgba(255,255,255,0.4)", textAlign:"center",
        padding:"20px", fontSize:"12px", letterSpacing:"1px", fontFamily:"Courier New,monospace" }}>
        STOCKSAGE &nbsp;·&nbsp; BUILT FOR GLOBAL INVESTORS &nbsp;·&nbsp; YOUR DATA STAYS SAFE ON YOUR DEVICE
      </div>
    </div>
  );
}