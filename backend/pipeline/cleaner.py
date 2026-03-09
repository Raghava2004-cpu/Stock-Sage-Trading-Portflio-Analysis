# pipeline/cleaner.py
# Phase 2 — Data Cleaning
# Fixes dates, symbols, duplicates, F&O contract parsing, and merges into master ledger.

import re
import pandas as pd
import numpy as np
from config import BROKER_SCHEMAS, SYMBOL_RENAME_MAP, SEGMENT
from utils.logger import get_logger

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))



logger = get_logger("cleaner")


# ─────────────────────────────────────────────
# STEP 1 — Date Parsing
# ─────────────────────────────────────────────

def parse_dates(df: pd.DataFrame, date_cols: list, label: str) -> pd.DataFrame:
    """Convert all date columns to datetime. Handle multiple formats gracefully."""
    df = df.copy()
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], dayfirst=True, errors="coerce")
            nulls = df[col].isna().sum()
            if nulls > 0:
                logger.warning(f"[{label}] {nulls} unparseable dates in '{col}' — set to NaT")
    logger.info(f"[{label}] Date columns parsed ✓")
    return df


# ─────────────────────────────────────────────
# STEP 2 — Symbol Standardization
# ─────────────────────────────────────────────

def clean_symbol(symbol: str) -> str:
    """
    Strip exchange suffixes, whitespace, and apply rename map.
    e.g. 'INFY EQ' → 'INFY', 'MINDTREE' → 'LTIM'
    """
    if pd.isna(symbol):
        return symbol
    symbol = str(symbol).strip().upper()
    # Remove common suffixes like '-EQ', ' EQ', '-BE'
    symbol = re.sub(r"[-\s](EQ|BE|BL|SM|ST)$", "", symbol)
    # Apply merger / rename map
    return SYMBOL_RENAME_MAP.get(symbol, symbol)


def standardize_symbols(df: pd.DataFrame, symbol_col: str, label: str) -> pd.DataFrame:
    df = df.copy()
    before = df[symbol_col].nunique()
    df[symbol_col] = df[symbol_col].apply(clean_symbol)
    after = df[symbol_col].nunique()
    logger.info(f"[{label}] Symbols standardized ✓  ({before} → {after} unique tickers)")
    return df


# ─────────────────────────────────────────────
# STEP 3 — Duplicate Removal
# ─────────────────────────────────────────────

def remove_duplicates(df: pd.DataFrame, trade_id_col: str, label: str) -> pd.DataFrame:
    df = df.copy()
    before = len(df)
    df = df.drop_duplicates(subset=[trade_id_col], keep="first")
    dropped = before - len(df)
    if dropped > 0:
        logger.warning(f"[{label}] Removed {dropped} duplicate trade_id rows")
    else:
        logger.info(f"[{label}] No duplicates found ✓")
    return df


# ─────────────────────────────────────────────
# STEP 4 — Numeric Cleaning
# ─────────────────────────────────────────────

def clean_numerics(df: pd.DataFrame, cols: list, label: str) -> pd.DataFrame:
    """Strip commas/rupee symbols and cast to float."""
    df = df.copy()
    for col in cols:
        if col in df.columns:
            df[col] = (
                df[col].astype(str)
                       .str.replace(",", "", regex=False)
                       .str.replace("₹", "", regex=False)
                       .str.strip()
            )
            df[col] = pd.to_numeric(df[col], errors="coerce")
    logger.info(f"[{label}] Numeric columns cleaned ✓")
    return df


# ─────────────────────────────────────────────
# STEP 5 — F&O Contract Parsing
# ─────────────────────────────────────────────

# Matches Zerodha F&O instrument names like:
#   NIFTY23MAR17500PE  → underlying=NIFTY, expiry=23MAR, strike=17500, type=PE
#   BANKNIFTY21OCT37000CE
#   RELIANCE19SEPFUT   → underlying=RELIANCE, type=FUT

FNO_PATTERN = re.compile(
    r"^(?P<underlying>[A-Z&]+)"          # underlying (NIFTY, BANKNIFTY, RELIANCE, etc.)
    r"(?P<expiry_code>\d{2}[A-Z]{3})"    # expiry code e.g. 23MAR
    r"(?:(?P<strike>\d+)(?P<opt_type>CE|PE)|(?P<fut>FUT))$"
)

def parse_fno_instrument(name: str) -> dict:
    """Parse a raw F&O instrument name into structured fields."""
    result = {
        "underlying": None,
        "expiry_code": None,
        "strike_price_parsed": np.nan,
        "option_type_parsed": None,
        "instrument_type": None,
    }
    if pd.isna(name):
        return result

    m = FNO_PATTERN.match(str(name).strip().upper())
    if not m:
        return result

    result["underlying"]    = m.group("underlying")
    result["expiry_code"]   = m.group("expiry_code")

    if m.group("fut"):
        result["instrument_type"]    = SEGMENT["futures"]
        result["option_type_parsed"] = "FUT"
    else:
        result["strike_price_parsed"] = float(m.group("strike"))
        result["option_type_parsed"]  = m.group("opt_type")   # CE or PE
        result["instrument_type"]     = SEGMENT["options"]

    return result


def parse_fno_contracts(df: pd.DataFrame) -> pd.DataFrame:
    """Apply F&O contract parsing and merge parsed fields back into DataFrame."""
    df = df.copy()
    parsed = df["scrip_name"].apply(parse_fno_instrument).apply(pd.Series)
    df = pd.concat([df, parsed], axis=1)

    # Fill instrument_type from series column if regex missed (fallback)
    if "series" in df.columns:
        mask = df["instrument_type"].isna()
        df.loc[mask & df["series"].str.startswith("FUTIDX", na=False), "instrument_type"] = SEGMENT["futures"]
        df.loc[mask & df["series"].str.startswith("FUTSTK", na=False), "instrument_type"] = SEGMENT["futures"]
        df.loc[mask & df["series"].str.startswith("OPTIDX", na=False), "instrument_type"] = SEGMENT["options"]
        df.loc[mask & df["series"].str.startswith("OPTSTK", na=False), "instrument_type"] = SEGMENT["options"]

    parsed_count = df["underlying"].notna().sum()
    logger.info(f"[F&O] Parsed {parsed_count}/{len(df)} contract names ✓")
    return df


# ─────────────────────────────────────────────
# STEP 6 — Build Master Ledger
# ─────────────────────────────────────────────

def build_master_ledger(df_equity: pd.DataFrame, df_fno: pd.DataFrame) -> pd.DataFrame:
    """
    Combine equity + F&O into one unified master ledger.
    Adds a 'segment' column and sorts by trade date.
    """
    eq = df_equity.copy()
    eq["segment"]    = SEGMENT["equity"]
    eq["underlying"] = eq["scrip_name"]   # for equity, underlying = symbol

    fno = df_fno.copy()
    # 'underlying' already parsed above; fallback to scrip_name if missing
    if "underlying" not in fno.columns or fno["underlying"].isna().all():
        fno["underlying"] = fno["scrip_name"]

    # Align columns — only keep shared + important extras
    shared_cols = [
        "trade_date", "trade_type", "scrip_name", "underlying",
        "exchange", "quantity", "price", "trade_id", "segment"
    ]
    fno_extra = ["expiry_date", "strike_price", "option_type", "instrument_type",
                 "expiry_code", "strike_price_parsed", "option_type_parsed"]

    eq_aligned  = eq.reindex(columns=shared_cols + fno_extra)
    fno_aligned = fno.reindex(columns=shared_cols + fno_extra)

    master = pd.concat([eq_aligned, fno_aligned], ignore_index=True)
    master = master.sort_values("trade_date").reset_index(drop=True)

    # Add trade value column
    master["trade_value"] = master["quantity"] * master["price"]

    logger.info(f"Master ledger built: {len(master)} total trades ✓")
    logger.info(f"  Equity : {(master['segment'] == 'EQ').sum()} trades")
    logger.info(f"  Futures: {(master['segment'] == 'FUT').sum()} trades")
    logger.info(f"  Options: {(master['segment'] == 'OPT').sum()} trades")
    return master


# ─────────────────────────────────────────────
# STEP 7 — Holdings Reconciliation
# ─────────────────────────────────────────────

def compute_net_positions(master_ledger: pd.DataFrame) -> pd.DataFrame:
    """
    Compute net equity position (shares held) per stock from trade history.
    buy → +qty, sell → -qty
    """
    eq = master_ledger[master_ledger["segment"] == "EQ"].copy()
    eq["signed_qty"] = eq.apply(
        lambda r: r["quantity"] if r["trade_type"] == "buy" else -r["quantity"],
        axis=1
    )
    net = (
        eq.groupby("underlying")["signed_qty"]
          .sum()
          .reset_index()
          .rename(columns={"underlying": "symbol", "signed_qty": "net_qty_from_trades"})
    )
    return net


def reconcile_holdings(master_ledger: pd.DataFrame, df_holdings: pd.DataFrame,
                        holdings_symbol_col: str = "tradingsymbol",
                        holdings_qty_col: str = "realised_quantity") -> pd.DataFrame:
    """
    Compare computed positions from trades vs broker's reported holdings.
    Returns a reconciliation table with a 'discrepancy' flag.
    """
    net_positions = compute_net_positions(master_ledger)

    holdings_snapshot = df_holdings[[holdings_symbol_col, holdings_qty_col]].copy()
    holdings_snapshot.columns = ["symbol", "broker_qty"]
    holdings_snapshot["symbol"] = holdings_snapshot["symbol"].apply(clean_symbol)

    recon = pd.merge(net_positions, holdings_snapshot, on="symbol", how="outer")
    recon["net_qty_from_trades"] = recon["net_qty_from_trades"].fillna(0)
    recon["broker_qty"]          = recon["broker_qty"].fillna(0)
    recon["discrepancy"]         = recon["net_qty_from_trades"] != recon["broker_qty"]
    recon["qty_diff"]            = recon["net_qty_from_trades"] - recon["broker_qty"]

    discrepancies = recon["discrepancy"].sum()
    if discrepancies > 0:
        logger.warning(f"Reconciliation: {discrepancies} discrepancies found — check recon report")
        logger.warning(recon[recon["discrepancy"]][["symbol", "net_qty_from_trades", "broker_qty", "qty_diff"]].to_string())
    else:
        logger.info("Reconciliation: All positions match broker holdings ✓")

    return recon


# ─────────────────────────────────────────────
# MAIN CLEAN FUNCTION (called by run.py)
# ─────────────────────────────────────────────

def clean(raw_data: dict, broker: str = "zerodha") -> dict:
    """
    Full Phase 2 cleaning pipeline.

    Args:
        raw_data: dict from ingestor.ingest() with keys equity, fno, holdings
        broker:   broker name

    Returns:
        dict with keys:
          master_ledger  — unified cleaned DataFrame
          holdings       — cleaned holdings DataFrame
          reconciliation — position match report
    """
    schema = BROKER_SCHEMAS[broker]
    eq_schema  = schema["equity"]
    fno_schema = schema["fno"]

    logger.info("=" * 50)
    logger.info("PHASE 2 — DATA CLEANING STARTED")
    logger.info("=" * 50)

    # ── Equity ──
    eq = raw_data["equity"].copy()
    eq = parse_dates(eq,          eq_schema["date_cols"],     "Equity")
    eq = standardize_symbols(eq,  eq_schema["symbol_col"],    "Equity")
    eq = remove_duplicates(eq,    eq_schema["trade_id_col"],  "Equity")
    eq = clean_numerics(eq,       ["quantity", "price"],      "Equity")

    # ── F&O ──
    fno = raw_data["fno"].copy()
    fno = parse_dates(fno,         fno_schema["date_cols"],    "F&O")
    fno = remove_duplicates(fno,   fno_schema["trade_id_col"], "F&O")
    fno = clean_numerics(fno,      ["quantity", "price"],      "F&O")
    fno = parse_fno_contracts(fno)

    # ── Holdings ──
    holdings = raw_data["holdings"].copy()
    holdings = standardize_symbols(holdings, schema["holdings"]["symbol_col"], "Holdings")
    holdings = clean_numerics(holdings, ["average_price", "last_price", "pnl"], "Holdings")

    # ── Master Ledger ──
    master = build_master_ledger(eq, fno)

    # ── Reconciliation ──
    recon = reconcile_holdings(master, holdings)

    logger.info("PHASE 2 — CLEANING COMPLETE ✓")

    return {
        "master_ledger":  master,
        "holdings":       holdings,
        "reconciliation": recon,
    }
