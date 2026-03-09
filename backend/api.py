# api.py — StockSage
# Production-ready FastAPI backend
# Run with: uvicorn api:app --host 0.0.0.0 --port 8000

import os
import math
import uuid
import shutil
from datetime import datetime

import pandas as pd
import numpy as np

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import get_db, create_tables, User, Portfolio, Stock
from auth import router as auth_router, get_current_user
from prices import router as prices_router

from backend.pipeline.ingestor import ingest
from backend.pipeline.cleaner import clean
from backend.pipeline.analytics import run_analytics


# ─────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────

app = FastAPI(
    title="StockSage API",
    description="Portfolio analytics engine — Equity + F&O",
    version="2.0.0",
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database tables
@app.on_event("startup")
def startup():
    create_tables()

# Routers
app.include_router(auth_router)
app.include_router(prices_router)


# ─────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "status": "running",
        "message": "StockSage API is live 🚀",
        "version": "2.0.0",
    }


@app.get("/ingest")
def run_ingest():
    return ingest()


# ── File paths (same as original pipeline expects)
RAW_DIR = "data/raw"

app = FastAPI(
    title="StockSage API",
    description="Portfolio analytics engine — Equity + F&O",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create DB tables on startup
@app.on_event("startup")
def startup():
    create_tables()

# Include routers
app.include_router(auth_router)
app.include_router(prices_router)


# ── Helpers ───────────────────────────────────────────

def df_to_json(df: pd.DataFrame) -> list:
    """Convert DataFrame to JSON-safe list. Replaces NaN/Inf with None."""
    return (
        df.replace([np.nan, np.inf, -np.inf], None)
          .where(pd.notnull(df), None)
          .to_dict(orient="records")
    )


def stocks_to_records(stocks: list) -> list:
    """Convert Stock ORM objects directly to JSON-safe dicts without going via DataFrame."""
    def safe(v):
        if v is None:
            return None
        try:
            import math
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                return None
        except Exception:
            pass
        return v

    return [{
        "symbol":             s.symbol,
        "total_invested":     safe(s.total_invested),
        "current_value":      safe(s.current_value),
        "total_pnl":          safe(s.total_pnl),
        "total_pnl_pct":      safe(s.total_pnl_pct),
        "realized_pnl":       safe(s.realized_pnl),
        "unrealized_pnl":     safe(s.unrealized_pnl),
        "xirr_pct":           safe(s.xirr_pct),
        "avg_buy_price":      safe(s.avg_buy_price),
        "last_price":         safe(s.last_price),
        "current_qty":        safe(s.current_qty),
        "conviction_score":   safe(s.conviction_score),
        "tax_classification": s.tax_classification,
        "avg_holding_days":   safe(s.avg_holding_days),
        "total_buy_trades":   safe(s.total_buy_trades),
        "total_sell_trades":  safe(s.total_sell_trades),
        "first_buy_date":     str(s.first_buy_date) if s.first_buy_date else None,
        "volatility_pct":     safe(s.volatility_pct),
        "max_drawdown_pct":   safe(s.max_drawdown_pct),
        "beta":               safe(s.beta),
    } for s in stocks]


def get_active_portfolio(user: User, db: Session) -> Portfolio:
    portfolio = db.query(Portfolio).filter(
        Portfolio.user_id == user.id,
        Portfolio.is_active == True,
    ).order_by(Portfolio.uploaded_at.desc()).first()

    if not portfolio:
        raise HTTPException(
            status_code=404,
            detail="No portfolio data found. Please upload your CSV files first.",
        )
    return portfolio


# stocks_to_df replaced by stocks_to_records above


# ══════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════

@app.get("/", tags=["Health"])
def root(
    db: Session = Depends(get_db),
    # Optional auth — returns scorecard_ready based on current user if logged in
    # Falls back to False if no token (for the initial App.jsx check)
):
    return {
        "status":  "running",
        "message": "StockSage API is live 🚀",
        "version": "2.0.0",
    }


@app.get("/status", tags=["Health"])
def status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if the current user has uploaded portfolio data."""
    has_data = db.query(Portfolio).filter(
        Portfolio.user_id == current_user.id,
        Portfolio.is_active == True,
    ).first() is not None

    return { "scorecard_ready": has_data }


# ══════════════════════════════════════════════════════
# UPLOAD — saves snapshot, keeps history
# ══════════════════════════════════════════════════════

@app.post("/upload", tags=["Upload"])
async def upload_and_run(
    equity:   UploadFile = File(...),
    fno:      UploadFile = File(...),
    holdings: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload 3 Zerodha CSVs → runs the pipeline → saves to DB as a new snapshot.
    Old portfolios are kept inactive for history tracking.
    """
    # Write uploads to data/raw — where the existing pipeline expects them
    os.makedirs(RAW_DIR, exist_ok=True)

    file_map = {
        "zerodha_tradebook_equity.csv": equity,
        "zerodha_tradebook_fno.csv":    fno,
        "zerodha_holdings.csv":         holdings,
    }
    for filename, upload in file_map.items():
        dest = os.path.join(RAW_DIR, filename)
        with open(dest, "wb") as f:
            shutil.copyfileobj(upload.file, f)

    # Run the analytics pipeline
    try:
        raw_data  = ingest()
        cleaned   = clean(raw_data)
        analytics = run_analytics(cleaned, use_live_prices=False)
        sc        = analytics["scorecard"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")

    # ── Deactivate previous portfolios (keep for history) ──
    db.query(Portfolio).filter(
        Portfolio.user_id == current_user.id,
        Portfolio.is_active == True,
    ).update({"is_active": False})

    # ── Create new portfolio snapshot ──
    portfolio = Portfolio(
        id                  = str(uuid.uuid4()),
        user_id             = current_user.id,
        uploaded_at         = datetime.utcnow(),
        is_active           = True,
        total_invested      = round(float(sc["total_invested"].sum()), 2),
        total_current_value = round(float(sc["current_value"].sum()), 2),
        total_pnl           = round(float(sc["total_pnl"].sum()), 2),
        total_pnl_pct       = round(float(sc["total_pnl"].sum() / sc["total_invested"].sum() * 100), 2) if sc["total_invested"].sum() else 0,
    )
    db.add(portfolio)
    db.flush()  # get portfolio.id before inserting stocks

    # ── Save each stock row ──
    def safe(row, col, default=None):
        v = row.get(col, default)
        return None if pd.isna(v) else v

    for _, row in sc.iterrows():
        stock = Stock(
            id                 = str(uuid.uuid4()),
            portfolio_id       = portfolio.id,
            symbol             = row.get("symbol", ""),
            total_invested     = safe(row, "total_invested", 0),
            current_value      = safe(row, "current_value", 0),
            total_pnl          = safe(row, "total_pnl", 0),
            total_pnl_pct      = safe(row, "total_pnl_pct", 0),
            realized_pnl       = safe(row, "realized_pnl", 0),
            unrealized_pnl     = safe(row, "unrealized_pnl", 0),
            xirr_pct           = safe(row, "xirr_pct"),
            avg_buy_price      = safe(row, "avg_buy_price", 0),
            last_price         = safe(row, "last_price", 0),
            current_qty        = int(safe(row, "current_qty", 0) or 0),
            conviction_score   = int(safe(row, "conviction_score", 0) or 0),
            tax_classification = safe(row, "tax_classification"),
            avg_holding_days   = safe(row, "avg_holding_days", 0),
            total_buy_trades   = int(safe(row, "total_buy_trades", 0) or 0),
            total_sell_trades  = int(safe(row, "total_sell_trades", 0) or 0),
            first_buy_date     = str(safe(row, "first_buy_date", "")),
            volatility_pct     = safe(row, "volatility_pct"),
            max_drawdown_pct   = safe(row, "max_drawdown_pct"),
            beta               = safe(row, "beta"),
        )
        db.add(stock)

    db.commit()

    return {
        "status":        "success",
        "message":       "Portfolio saved ✓",
        "total_stocks":  len(sc),
        "total_invested": portfolio.total_invested,
        "total_pnl":     portfolio.total_pnl,
        "snapshot_id":   portfolio.id,
    }


# ══════════════════════════════════════════════════════
# PORTFOLIO SUMMARY — user-scoped
# ══════════════════════════════════════════════════════

@app.get("/portfolio/summary", tags=["Portfolio"])
def portfolio_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    portfolio = get_active_portfolio(current_user, db)
    stocks    = portfolio.stocks

    if not stocks:
        raise HTTPException(status_code=404, detail="No stock data in portfolio.")

    def safe(v):
        if v is None: return None
        try:
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)): return None
        except: pass
        return v

    fno_pnl = sum(s.total_pnl or 0 for s in stocks if s.tax_classification == "FNO")

    # Best/worst by xirr — ignore None/NaN
    with_xirr = [s for s in stocks if s.xirr_pct is not None and not math.isnan(s.xirr_pct)]
    best_stock  = max(with_xirr, key=lambda s: s.xirr_pct) if with_xirr else stocks[0]
    worst_stock = min(with_xirr, key=lambda s: s.xirr_pct) if with_xirr else stocks[-1]

    return {
        "total_invested":        portfolio.total_invested,
        "total_current_value":   portfolio.total_current_value,
        "total_pnl":             portfolio.total_pnl,
        "total_pnl_pct":         portfolio.total_pnl_pct,
        "total_stocks":          len(stocks),
        "best_stock":            {"symbol": best_stock.symbol,  "xirr_pct": safe(best_stock.xirr_pct),  "total_pnl_pct": safe(best_stock.total_pnl_pct)},
        "worst_stock":           {"symbol": worst_stock.symbol, "xirr_pct": safe(worst_stock.xirr_pct), "total_pnl_pct": safe(worst_stock.total_pnl_pct)},
        "ltcg_stocks":           sum(1 for s in stocks if s.tax_classification == "LTCG"),
        "stcg_stocks":           sum(1 for s in stocks if s.tax_classification == "STCG"),
        "fno_net_pnl":           round(fno_pnl, 2),
        "fno_win_rate_pct":      0,
        "high_conviction_count": sum(1 for s in stocks if (s.conviction_score or 0) >= 75),
    }


# ══════════════════════════════════════════════════════
# ALL STOCKS — user-scoped
# ══════════════════════════════════════════════════════

@app.get("/stocks", tags=["Stocks"])
def get_all_stocks(
    sort_by:  str = "total_pnl",
    order:    str = "desc",
    segment:  str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    portfolio = get_active_portfolio(current_user, db)
    records = stocks_to_records(portfolio.stocks)

    if segment:
        records = [r for r in records if (r.get("tax_classification") or "").upper() == segment.upper()]

    # Sort — handle None values safely
    if records and sort_by in records[0]:
        records = sorted(
            records,
            key=lambda r: (r.get(sort_by) is None, r.get(sort_by) or 0),
            reverse=(order.lower() == "desc"),
        )

    return { "count": len(records), "stocks": records }


# ══════════════════════════════════════════════════════
# PORTFOLIO HISTORY — the new killer feature
# ══════════════════════════════════════════════════════

@app.get("/portfolio/history", tags=["Portfolio"])
def portfolio_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all portfolio snapshots for the current user, ordered by date.
    Used to render the portfolio value over time chart.
    """
    portfolios = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == current_user.id)
        .order_by(Portfolio.uploaded_at.asc())
        .all()
    )

    return [{
        "date":                p.uploaded_at.strftime("%Y-%m-%d %H:%M"),
        "label":               p.uploaded_at.strftime("%d %b %H:%M"),
        "total_invested":      p.total_invested,
        "total_current_value": p.total_current_value,
        "total_pnl":           p.total_pnl,
        "total_pnl_pct":       p.total_pnl_pct,
        "is_active":           p.is_active,
    } for p in portfolios]


# ══════════════════════════════════════════════════════
# TAX HARVESTING — the new high-value feature
# ══════════════════════════════════════════════════════

@app.get("/portfolio/tax-harvest", tags=["Portfolio"])
def tax_harvest_suggestions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Computes tax-loss harvesting opportunities.

    Logic:
    - LTCG gains above ₹1,25,000 are taxed at 12.5%
    - STCG gains are taxed at 20%
    - Unrealized losses can be booked to offset gains
    - Each suggestion shows: sell X, save Y in tax
    """
    LTCG_EXEMPTION  = 125000   # ₹1.25L exempt (Budget 2024)
    LTCG_TAX_RATE   = 0.125    # 12.5%
    STCG_TAX_RATE   = 0.20     # 20%

    portfolio = get_active_portfolio(current_user, db)
    stocks    = portfolio.stocks

    # Stocks still held (qty > 0) with unrealized losses
    loss_stocks = [
        s for s in stocks
        if (s.current_qty or 0) > 0 and (s.unrealized_pnl or 0) < 0
    ]

    # LTCG realized gains this year (from sold LTCG stocks)
    ltcg_gains = sum(
        (s.realized_pnl or 0)
        for s in stocks
        if s.tax_classification == "LTCG" and (s.realized_pnl or 0) > 0
    )

    # STCG realized gains this year
    stcg_gains = sum(
        (s.realized_pnl or 0)
        for s in stocks
        if s.tax_classification == "STCG" and (s.realized_pnl or 0) > 0
    )

    taxable_ltcg = max(0, ltcg_gains - LTCG_EXEMPTION)
    current_ltcg_tax = round(taxable_ltcg * LTCG_TAX_RATE, 2)
    current_stcg_tax = round(stcg_gains * STCG_TAX_RATE, 2)

    suggestions = []
    remaining_ltcg_offset = taxable_ltcg
    remaining_stcg_offset = stcg_gains

    for s in sorted(loss_stocks, key=lambda x: x.unrealized_pnl or 0):
        loss = abs(s.unrealized_pnl or 0)
        if loss < 500:          # Skip trivially small losses
            continue

        # Decide which gain pool to offset
        if remaining_ltcg_offset > 0:
            offset_from = "LTCG"
            offset_amt  = min(loss, remaining_ltcg_offset)
            tax_saved   = round(offset_amt * LTCG_TAX_RATE, 2)
            remaining_ltcg_offset -= offset_amt
        elif remaining_stcg_offset > 0:
            offset_from = "STCG"
            offset_amt  = min(loss, remaining_stcg_offset)
            tax_saved   = round(offset_amt * STCG_TAX_RATE, 2)
            remaining_stcg_offset -= offset_amt
        else:
            offset_from = "Carry Forward"
            offset_amt  = loss
            tax_saved   = 0   # Carried forward to next year

        suggestions.append({
            "symbol":        s.symbol,
            "unrealized_pnl": round(s.unrealized_pnl or 0, 2),
            "current_qty":   s.current_qty,
            "last_price":    s.last_price,
            "tax_classification": s.tax_classification,
            "offset_from":   offset_from,
            "loss_to_book":  round(loss, 2),
            "tax_saved":     tax_saved,
            "action":        f"Sell {s.current_qty} shares of {s.symbol} at ~₹{s.last_price:,.0f}",
        })

    total_tax_saved = sum(s["tax_saved"] for s in suggestions)

    return {
        "summary": {
            "ltcg_gains":       round(ltcg_gains, 2),
            "stcg_gains":       round(stcg_gains, 2),
            "taxable_ltcg":     round(taxable_ltcg, 2),
            "current_ltcg_tax": current_ltcg_tax,
            "current_stcg_tax": current_stcg_tax,
            "total_current_tax": round(current_ltcg_tax + current_stcg_tax, 2),
            "total_tax_saved":  round(total_tax_saved, 2),
            "tax_after_harvest": round(current_ltcg_tax + current_stcg_tax - total_tax_saved, 2),
            "ltcg_exemption":   LTCG_EXEMPTION,
        },
        "suggestions": suggestions,
        "note": "Tax calculations are estimates. Consult a CA before executing trades.",
    }