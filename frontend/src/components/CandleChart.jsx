// components/CandleChart.jsx
import { useEffect, useRef } from "react";
import { C, card } from "../constants";

export default function CandleChart() {
  const canvasRef = useRef(null);
  const stateRef  = useRef({ candles:[], reveal:0, lineP:0, phase:"candles", glowT:0, raf:null });

  function genCandles(n) {
    const d = []; let p = 21600;
    for (let i = 0; i < n; i++) {
      const o = p, m = (Math.random() - 0.44) * 260;
      const c = o + m;
      d.push({ open:o, close:c, high:Math.max(o,c)+Math.random()*120, low:Math.min(o,c)-Math.random()*90 });
      p = c;
    }
    return d;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const NC  = 30;
    const PL=58, PR=24, PT=22, PB=40;
    const st  = stateRef.current;

    function resize() {
      canvas.width  = canvas.parentElement.clientWidth - 48;
      canvas.height = 300;
    }
    resize();

    function W() { return canvas.width; }
    function H() { return canvas.height; }

    function range() {
      const a = st.candles.flatMap(c=>[c.high,c.low]);
      const mn=Math.min(...a), mx=Math.max(...a), pd=(mx-mn)*.1;
      return { mn:mn-pd, mx:mx+pd };
    }
    function pY(p) { const r=range(); return PT+(H()-PT-PB)*(1-(p-r.mn)/(r.mx-r.mn)); }
    function cX(i) { return PL+(i/(NC-1))*(W()-PL-PR); }

    function drawGrid() {
      const r=range();
      ctx.strokeStyle="#E2E8F0"; ctx.lineWidth=1;
      ctx.fillStyle="#94A3B8"; ctx.font="10px 'Courier New',monospace"; ctx.textAlign="right";
      for(let i=0;i<=5;i++){
        const y=PT+(i/5)*(H()-PT-PB);
        const p=Math.round(r.mx-(i/5)*(r.mx-r.mn));
        ctx.setLineDash([4,7]); ctx.beginPath(); ctx.moveTo(PL,y); ctx.lineTo(W()-PR,y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillText("₹"+p.toLocaleString("en-IN"),PL-6,y+4);
      }
      ctx.textAlign="center";
      const mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr"];
      st.candles.forEach((_,i)=>{ if(i%5===0) ctx.fillText(mo[Math.floor(i/2)%mo.length],cX(i),H()-PB+16); });
    }

    function drawCandle(i,alpha) {
      const c=st.candles[i], x=cX(i), isG=c.close>=c.open;
      const col=isG?"#059669":"#DC2626", glo=isG?"#22c55e":"#f87171";
      const bw=Math.max((W()-PL-PR)/NC*.58,6);
      const oY=pY(c.open),cY=pY(c.close),hY=pY(c.high),lY=pY(c.low);
      const bT=Math.min(oY,cY), bH=Math.max(Math.abs(cY-oY),3);
      ctx.globalAlpha=alpha;
      ctx.strokeStyle=col; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(x,hY); ctx.lineTo(x,lY); ctx.stroke();
      ctx.shadowBlur=8; ctx.shadowColor=glo+"88";
      ctx.fillStyle=col; ctx.fillRect(x-bw/2,bT,bw,bH);
      ctx.strokeRect(x-bw/2,bT,bw,bH);
      ctx.shadowBlur=0;
      ctx.fillStyle="rgba(255,255,255,0.2)";
      ctx.fillRect(x-bw/2+1.5,bT+1.5,bw*.35,Math.max(bH-3,1));
      ctx.globalAlpha=1;
    }

    function drawLine(prog) {
      const pts=st.candles.map((c,i)=>({x:cX(i),y:pY((c.open+c.close)/2)}));
      const total=pts.length-1, at=prog*total, full=Math.floor(at), frac=at-full;
      ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
      for(let i=1;i<=full&&i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
      const tipX=full<total?pts[full].x+(pts[full+1].x-pts[full].x)*frac:pts[total].x;
      const tipY=full<total?pts[full].y+(pts[full+1].y-pts[full].y)*frac:pts[total].y;
      if(full<total) ctx.lineTo(tipX,tipY);
      ctx.strokeStyle="#1A56DB"; ctx.lineWidth=2.6; ctx.lineJoin="round"; ctx.lineCap="round";
      ctx.shadowBlur=12; ctx.shadowColor="#1A56DB88"; ctx.stroke(); ctx.shadowBlur=0;
      ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
      for(let i=1;i<=full&&i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
      if(full<total) ctx.lineTo(tipX,tipY);
      ctx.lineTo(tipX,H()-PB); ctx.lineTo(pts[0].x,H()-PB); ctx.closePath();
      const ag=ctx.createLinearGradient(0,PT,0,H()-PB);
      ag.addColorStop(0,"rgba(26,86,219,0.13)"); ag.addColorStop(1,"rgba(26,86,219,0)");
      ctx.fillStyle=ag; ctx.fill();
      const pulse=Math.abs(Math.sin(st.glowT))*7;
      ctx.beginPath(); ctx.arc(tipX,tipY,6+pulse,0,Math.PI*2);
      ctx.fillStyle="rgba(26,86,219,0.18)"; ctx.fill();
      ctx.beginPath(); ctx.arc(tipX,tipY,6,0,Math.PI*2);
      ctx.fillStyle="#1A56DB"; ctx.shadowBlur=14; ctx.shadowColor="#1A56DB"; ctx.fill(); ctx.shadowBlur=0;
      const lc=st.candles[Math.min(full,NC-1)].close;
      const tag="₹"+Math.round(lc).toLocaleString("en-IN");
      ctx.font="bold 11px 'Courier New',monospace";
      const tw=ctx.measureText(tag).width, isUp=lc>=st.candles[0].open;
      ctx.fillStyle=isUp?"#ECFDF5":"#FEF2F2"; ctx.strokeStyle=isUp?"#059669":"#DC2626"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.roundRect(tipX+11,tipY-11,tw+14,22,5); ctx.fill(); ctx.stroke();
      ctx.fillStyle=isUp?"#059669":"#DC2626"; ctx.textAlign="left";
      ctx.fillText(tag,tipX+18,tipY+4);
    }

    function restart() {
      st.candles=genCandles(NC); st.reveal=0; st.lineP=0; st.phase="candles";
    }
    restart();

    const timer = setInterval(restart, 9000);

    function animate() {
      st.raf = requestAnimationFrame(animate);
      ctx.clearRect(0,0,W(),H());
      ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,W(),H());
      drawGrid();
      st.glowT+=0.07;
      if(st.phase==="candles"){st.reveal+=0.2;if(st.reveal>=NC){st.reveal=NC;st.phase="line";}}
      else if(st.phase==="line"){st.lineP+=0.016;if(st.lineP>=1){st.lineP=1;st.phase="done";}}
      const full=Math.floor(st.reveal);
      for(let i=0;i<full;i++) drawCandle(i,1);
      if(full<NC) drawCandle(full,st.reveal-full);
      if(st.phase==="line"||st.phase==="done") drawLine(st.lineP);
    }
    animate();

    const handleResize = () => { resize(); restart(); };
    window.addEventListener("resize", handleResize);

    return () => {
      clearInterval(timer);
      cancelAnimationFrame(st.raf);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div style={{ ...card, width:"100%", padding:"22px 24px 18px", marginBottom:"0" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
        <div style={{ fontSize:"13px", fontWeight:"700", color:C.text }}>
          NIFTY 50 · Your Portfolio <span style={{ fontSize:"11px", color:C.textLight, fontWeight:"400" }}>NSE · Live View</span>
        </div>
        <div style={{ fontSize:"12px", fontWeight:"700", padding:"4px 13px", borderRadius:"20px", background:C.greenSoft, color:C.green }}>
          Portfolio Analytics
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display:"block", borderRadius:"10px", width:"100%" }} />
    </div>
  );
}