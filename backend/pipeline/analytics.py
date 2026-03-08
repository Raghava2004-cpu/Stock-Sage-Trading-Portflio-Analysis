# pipeline/analytics.py
# Phase 3 — Analytics Engine
# 6 modules: P&L, XIRR, Holding Period, Volatility & Beta, Conviction Score, F&O P&L

import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from datetime import datetime, date
from scipy.optimize import brentq
from utils.logger import get_logger

logger = get_logger("analytics")

TODAY = pd.Timestamp(date.today())


# ═══════════════════════════════════════════════════════════
# MODULE 1 — P&L PER STOCK
# ═══════════════════════════════════════════════════════════

def compute_pnl(master_ledger: pd.DataFrame, holdings: pd.DataFrame) -> pd.DataFrame:
    """
    Per stock P&L breakdown:
      - total_invested    : total buy value ever
      - total_sold        : total sell value ever
      - realized_pnl      : profit/loss from completed sells
      - current_qty       : shares still held
      - avg_buy_price     : FIFO average cost of current holdings
      - current_value     : current_qty × last_price from holdings
      - unrealized_pnl    : current_value - (avg_buy_price × current_qty)
      - total_pnl         : realized + unrealized
      - total_pnl_pct     : total_pnl / total_invested × 100
    """
    logger.info("MODULE 1 — Computing P&L per stock...")

    eq = master_ledger[master_ledger["segment"] == "EQ"].copy()
    eq = eq.dropna(subset=["trade_date"])
    eq = eq.sort_values("trade_date")

    # Build holdings last price lookup
    holdings_clean = holdings.copy()
    holdings_clean.columns = [c.lower() for c in holdings_clean.columns]
    price_lookup = {}
    sym_col = "tradingsymbol" if "tradingsymbol" in holdings_clean.columns else "symbol"
    if sym_col in holdings_clean.columns and "last_price" in holdings_clean.columns:
        price_lookup = dict(zip(holdings_clean[sym_col], holdings_clean["last_price"]))

    results = []

    for symbol, trades in eq.groupby("underlying"):
        trades = trades.sort_values("trade_date")

        total_invested = 0.0
        total_sold     = 0.0
        realized_pnl   = 0.0
        fifo_queue     = []   # list of [qty, price] lots

        for _, row in trades.iterrows():
            qty   = float(row["quantity"])
            price = float(row["price"])

            if row["trade_type"] == "buy":
                total_invested += qty * price
                fifo_queue.append([qty, price])

            elif row["trade_type"] == "sell":
                total_sold    += qty * price
                sell_qty       = qty
                cost_of_sold   = 0.0

                # FIFO: eat through buy lots oldest first
                while sell_qty > 0 and fifo_queue:
                    lot_qty, lot_price = fifo_queue[0]
                    used = min(sell_qty, lot_qty)
                    cost_of_sold  += used * lot_price
                    sell_qty      -= used
                    fifo_queue[0][0] -= used
                    if fifo_queue[0][0] <= 0:
                        fifo_queue.pop(0)

                realized_pnl += (qty * price) - cost_of_sold

        # Current position
        current_qty   = sum(lot[0] for lot in fifo_queue)
        avg_buy_price = (
            sum(lot[0] * lot[1] for lot in fifo_queue) / current_qty
            if current_qty > 0 else 0.0
        )
        last_price      = price_lookup.get(symbol, avg_buy_price)
        current_value   = current_qty * last_price
        unrealized_pnl  = current_value - (avg_buy_price * current_qty)
        total_pnl       = realized_pnl + unrealized_pnl
        total_pnl_pct   = (total_pnl / total_invested * 100) if total_invested > 0 else 0.0

        results.append({
            "symbol":          symbol,
            "total_invested":  round(total_invested, 2),
            "total_sold":      round(total_sold, 2),
            "realized_pnl":    round(realized_pnl, 2),
            "current_qty":     round(current_qty, 2),
            "avg_buy_price":   round(avg_buy_price, 2),
            "last_price":      round(last_price, 2),
            "current_value":   round(current_value, 2),
            "unrealized_pnl":  round(unrealized_pnl, 2),
            "total_pnl":       round(total_pnl, 2),
            "total_pnl_pct":   round(total_pnl_pct, 2),
        })

    df = pd.DataFrame(results).sort_values("total_pnl", ascending=False).reset_index(drop=True)
    logger.info(f"  P&L computed for {len(df)} stocks ✓")
    return df


# ═══════════════════════════════════════════════════════════
# MODULE 2 — XIRR PER STOCK
# ═══════════════════════════════════════════════════════════

def _xirr(cashflows: list) -> float:
    """
    Compute XIRR given a list of (date, amount) tuples.
    Negative amount = money OUT (buy).
    Positive amount = money IN (sell or current value).
    Returns annualized rate as a decimal. Returns NaN if unsolvable.
    """
    if len(cashflows) < 2:
        return np.nan

    dates   = [cf[0] for cf in cashflows]
    amounts = [cf[1] for cf in cashflows]
    t0      = dates[0]

    # days from first cashflow
    days = [(d - t0).days for d in dates]

    def npv(rate):
        return sum(amt / ((1 + rate) ** (d / 365.0))
                   for amt, d in zip(amounts, days))

    try:
        return brentq(npv, -0.999, 100.0, maxiter=1000)
    except (ValueError, RuntimeError):
        return np.nan


def compute_xirr(master_ledger: pd.DataFrame, pnl_df: pd.DataFrame) -> pd.DataFrame:
    """
    XIRR per stock using actual trade cash flows + current market value.
    Buys = negative cashflow (money paid out)
    Sells = positive cashflow (money received)
    Current value = positive cashflow on today's date
    """
    logger.info("MODULE 2 — Computing XIRR per stock...")

    eq = master_ledger[master_ledger["segment"] == "EQ"].copy()
    eq = eq.dropna(subset=["trade_date"])

    pnl_lookup = pnl_df.set_index("symbol")[["current_value", "current_qty"]].to_dict("index")

    xirr_results = []

    for symbol, trades in eq.groupby("underlying"):
        trades = trades.sort_values("trade_date")
        cashflows = []

        for _, row in trades.iterrows():
            amt   = float(row["quantity"]) * float(row["price"])
            tdate = row["trade_date"].to_pydatetime()
            if row["trade_type"] == "buy":
                cashflows.append((tdate, -amt))   # money OUT
            else:
                cashflows.append((tdate, +amt))   # money IN

        # Add current market value as final inflow (today)
        info = pnl_lookup.get(symbol, {})
        current_val = info.get("current_value", 0)
        if current_val > 0:
            cashflows.append((TODAY.to_pydatetime(), +current_val))

        rate = _xirr(cashflows)
        xirr_pct = round(rate * 100, 2) if not np.isnan(rate) else np.nan

        xirr_results.append({"symbol": symbol, "xirr_pct": xirr_pct})

    df = pd.DataFrame(xirr_results)
    logger.info(f"  XIRR computed for {df['xirr_pct'].notna().sum()}/{len(df)} stocks ✓")
    return df


# ═══════════════════════════════════════════════════════════
# MODULE 3 — HOLDING PERIOD ANALYSIS
# ═══════════════════════════════════════════════════════════

def compute_holding_period(master_ledger: pd.DataFrame) -> pd.DataFrame:
    """
    Per stock:
      - first_buy_date    : when you first bought
      - last_activity     : most recent trade
      - avg_holding_days  : weighted average days held across all sell trades
      - tax_classification: LTCG (>365 days) or STCG (<365 days)
      - total_buy_trades  : number of buy orders placed
      - total_sell_trades : number of sell orders placed
      - still_holding     : True if current_qty > 0
    """
    logger.info("MODULE 3 — Computing holding periods...")

    eq = master_ledger[master_ledger["segment"] == "EQ"].copy()
    eq = eq.dropna(subset=["trade_date"]).sort_values("trade_date")

    results = []

    for symbol, trades in eq.groupby("underlying"):
        buys  = trades[trades["trade_type"] == "buy"]
        sells = trades[trades["trade_type"] == "sell"]

        first_buy    = buys["trade_date"].min()
        last_act     = trades["trade_date"].max()
        days_held    = (TODAY - first_buy).days if pd.notna(first_buy) else 0
        still_holding = (trades["quantity"] * trades["trade_type"].map({"buy": 1, "sell": -1})).sum() > 0

        # Average days between buys and their corresponding sells
        if not sells.empty and not buys.empty:
            avg_hold = (sells["trade_date"].mean() - buys["trade_date"].mean()).days
            avg_hold = max(0, avg_hold)
        else:
            avg_hold = days_held  # still holding, count from first buy to today

        tax = "LTCG" if avg_hold >= 365 else "STCG"

        results.append({
            "symbol":            symbol,
            "first_buy_date":    first_buy.date() if pd.notna(first_buy) else None,
            "last_activity":     last_act.date() if pd.notna(last_act) else None,
            "days_since_first_buy": days_held,
            "avg_holding_days":  avg_hold,
            "tax_classification": tax,
            "total_buy_trades":  len(buys),
            "total_sell_trades": len(sells),
            "still_holding":     still_holding,
        })

    df = pd.DataFrame(results)
    ltcg = (df["tax_classification"] == "LTCG").sum()
    stcg = (df["tax_classification"] == "STCG").sum()
    logger.info(f"  Holding periods computed ✓  LTCG: {ltcg} stocks | STCG: {stcg} stocks")
    return df


# ═══════════════════════════════════════════════════════════
# MODULE 4 — VOLATILITY & BETA
# ═══════════════════════════════════════════════════════════

def _simulate_price_series(symbol: str, n_days: int = 252) -> pd.Series:
    """
    Simulates a realistic price series when yfinance is unavailable (offline mode).
    Uses integer seed derived from symbol string — abs() prevents negative seed
    which causes ValueError in numpy on Python 3.12+.
    """
    try:
        seed = abs(hash(symbol)) % (2**31 - 1)
        rng  = np.random.default_rng(seed)   # modern API — no deprecated warnings
        daily_returns = rng.normal(loc=0.0005, scale=0.018, size=n_days)
        prices = 1000.0 * np.cumprod(1 + daily_returns)
        # Use 'D' instead of 'B' — 'B' is deprecated in pandas 2.2+
        dates  = pd.date_range(end=TODAY, periods=n_days, freq="D")
        return pd.Series(prices, index=dates, name=symbol)
    except Exception as e:
        logger.warning(f"  _simulate_price_series failed for {symbol}: {e}")
        # Last resort: flat series so downstream doesn't crash
        dates  = pd.date_range(end=TODAY, periods=n_days, freq="D")
        return pd.Series(np.ones(n_days) * 1000.0, index=dates, name=symbol)


def fetch_price_data(symbol: str, use_live: bool = True) -> pd.Series:
    """
    Fetch historical closing prices. Falls back to simulation if offline.
    """
    if use_live:
        try:
            import yfinance as yf
            ticker = symbol if symbol.startswith("^") else f"{symbol}.NS"
            df = yf.download(ticker, period="1y", progress=False, auto_adjust=True)
            if df.empty:
                raise ValueError("Empty response from Yahoo Finance")
            close = df["Close"]
            return close.squeeze() if hasattr(close, "squeeze") else close
        except Exception as e:
            logger.warning(f"  yfinance failed for {symbol}: {e} — using simulation")

    return _simulate_price_series(symbol)


def compute_volatility_beta(symbols: list, use_live: bool = True) -> pd.DataFrame:
    """
    Per stock:
      - volatility_pct   : annualized std deviation of daily returns
      - beta             : regression of stock returns vs NIFTY 50
      - max_drawdown_pct : worst peak-to-trough drop in the past year

    Fully wrapped in try/except — never crashes the pipeline.
    Returns NaN columns for any symbol that fails.
    """
    logger.info("MODULE 4 — Computing Volatility & Beta...")
    if not use_live:
        logger.warning("  Running in OFFLINE mode — using simulated price data")

    # Get NIFTY 50 benchmark — safe fallback if it fails
    nifty_ret = pd.Series(dtype=float)
    try:
        nifty     = fetch_price_data("^NSEI", use_live=use_live)
        nifty_ret = nifty.pct_change().dropna()
    except Exception as e:
        logger.warning(f"  Could not fetch NIFTY benchmark: {e} — beta will be NaN")

    results = []

    for symbol in symbols:
        try:
            prices  = fetch_price_data(symbol, use_live=use_live)
            returns = prices.pct_change().dropna()

            if returns.empty:
                raise ValueError("Empty returns series")

            # Annualized volatility
            vol_pct = round(float(returns.std()) * np.sqrt(252) * 100, 2)

            # Max drawdown
            roll_max   = prices.cummax()
            drawdown   = (prices - roll_max) / roll_max
            max_dd_pct = round(float(drawdown.min()) * 100, 2)

            # Beta vs NIFTY 50
            beta = np.nan
            if len(nifty_ret) > 10:
                try:
                    aligned = pd.concat([returns, nifty_ret], axis=1).dropna()
                    aligned.columns = ["stock", "nifty"]
                    if len(aligned) > 10:
                        cov  = np.cov(aligned["stock"].values, aligned["nifty"].values)
                        beta = round(float(cov[0][1] / cov[1][1]), 2)
                except Exception:
                    beta = np.nan

            results.append({
                "symbol":           symbol,
                "volatility_pct":   vol_pct,
                "beta":             beta,
                "max_drawdown_pct": max_dd_pct,
            })

        except Exception as e:
            logger.warning(f"  Risk metrics failed for {symbol}: {e} — using NaN")
            results.append({
                "symbol":           symbol,
                "volatility_pct":   np.nan,
                "beta":             np.nan,
                "max_drawdown_pct": np.nan,
            })

    df = pd.DataFrame(results)
    logger.info(f"  Volatility & Beta computed for {len(df)} stocks ✓")
    return df


# ═══════════════════════════════════════════════════════════
# MODULE 5 — CONVICTION SCORE
# ═══════════════════════════════════════════════════════════

def compute_conviction_score(
    master_ledger: pd.DataFrame,
    pnl_df: pd.DataFrame,
    holding_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Conviction Score (0–100) per stock.
    Measures how well you acted as an investor — not just returns.

    Scoring breakdown (100 pts total):
      30 pts — Hold Duration Score   : longer hold = higher score
      25 pts — Position Size Score   : bigger position = higher conviction
      25 pts — Add-on Behavior Score : did you buy more on dips?
      20 pts — Sell Discipline Score : did you hold winners or sell too soon?
    """
    logger.info("MODULE 5 — Computing Conviction Scores...")

    eq = master_ledger[master_ledger["segment"] == "EQ"].copy()
    eq = eq.dropna(subset=["trade_date"])

    pnl_idx     = pnl_df.set_index("symbol")
    holding_idx = holding_df.set_index("symbol")

    total_portfolio_value = pnl_df["total_invested"].sum()

    results = []

    for symbol, trades in eq.groupby("underlying"):
        buys  = trades[trades["trade_type"] == "buy"].sort_values("trade_date")
        sells = trades[trades["trade_type"] == "sell"].sort_values("trade_date")

        # ── 30 pts: Hold Duration ──
        avg_hold = holding_idx.loc[symbol, "avg_holding_days"] if symbol in holding_idx.index else 0
        # 0 days = 0 pts, 730 days (2 yrs) = 30 pts, scaled linearly
        hold_score = min(30, round((avg_hold / 730) * 30, 1))

        # ── 25 pts: Position Size ──
        invested = pnl_idx.loc[symbol, "total_invested"] if symbol in pnl_idx.index else 0
        position_pct = (invested / total_portfolio_value * 100) if total_portfolio_value > 0 else 0
        # 5%+ allocation = full 25 pts
        size_score = min(25, round((position_pct / 5) * 25, 1))

        # ── 25 pts: Add-on Behavior ──
        # Multiple buy trades at different prices = active conviction
        num_buys = len(buys)
        if num_buys >= 3:
            addon_score = 25
        elif num_buys == 2:
            addon_score = 15
        else:
            addon_score = 8

        # Bonus: did they buy on price dips? (next buy price < prev buy price)
        if num_buys >= 2:
            buy_prices = buys["price"].tolist()
            dip_buys = sum(1 for i in range(1, len(buy_prices)) if buy_prices[i] < buy_prices[i-1])
            addon_score = min(25, addon_score + dip_buys * 3)

        # ── 20 pts: Sell Discipline ──
        total_pnl_pct = pnl_idx.loc[symbol, "total_pnl_pct"] if symbol in pnl_idx.index else 0
        still_holding  = holding_idx.loc[symbol, "still_holding"] if symbol in holding_idx.index else False

        if still_holding and total_pnl_pct > 0:
            sell_score = 20   # holding a winner = best behavior
        elif still_holding and total_pnl_pct < -20:
            sell_score = 5    # holding a big loser = poor discipline
        elif not still_holding and total_pnl_pct > 20:
            sell_score = 10   # sold a winner too soon
        elif not still_holding and total_pnl_pct < 0:
            sell_score = 8    # sold a loser (cut losses — not terrible)
        else:
            sell_score = 14

        total_score = round(hold_score + size_score + addon_score + sell_score, 1)

        results.append({
            "symbol":          symbol,
            "hold_score":      hold_score,
            "size_score":      size_score,
            "addon_score":     addon_score,
            "sell_score":      sell_score,
            "conviction_score": min(100, total_score),
        })

    df = pd.DataFrame(results).sort_values("conviction_score", ascending=False).reset_index(drop=True)

    # Grade label
    def grade(score):
        if score >= 75: return "🟢 High"
        if score >= 50: return "🟡 Medium"
        return "🔴 Low"

    df["conviction_grade"] = df["conviction_score"].apply(grade)
    logger.info(f"  Conviction scores computed for {len(df)} stocks ✓")
    return df


# ═══════════════════════════════════════════════════════════
# MODULE 6 — F&O P&L MATCHING
# ═══════════════════════════════════════════════════════════

def compute_fno_pnl(master_ledger: pd.DataFrame) -> dict:
    """
    Match F&O buy-sell pairs. Compute:
      - net P&L per trade pair
      - win rate %
      - best / worst trade
      - total futures P&L vs options P&L
    """
    logger.info("MODULE 6 — Computing F&O P&L...")

    fno = master_ledger[master_ledger["segment"].isin(["FUT", "OPT"])].copy()

    if fno.empty:
        logger.warning("  No F&O trades found in ledger")
        return {"trade_pairs": pd.DataFrame(), "summary": {}}

    fno = fno.dropna(subset=["trade_date"]).sort_values("trade_date")

    matched_pairs = []

    for symbol, trades in fno.groupby("scrip_name"):
        buys  = trades[trades["trade_type"] == "buy"].copy()
        sells = trades[trades["trade_type"] == "sell"].copy()

        buy_val  = (buys["quantity"]  * buys["price"]).sum()
        sell_val = (sells["quantity"] * sells["price"]).sum()
        net_pnl  = sell_val - buy_val

        segment  = trades["segment"].iloc[0]

        matched_pairs.append({
            "instrument":  symbol,
            "segment":     segment,
            "buy_value":   round(buy_val, 2),
            "sell_value":  round(sell_val, 2),
            "net_pnl":     round(net_pnl, 2),
            "result":      "WIN" if net_pnl > 0 else "LOSS",
            "num_trades":  len(trades),
        })

    pairs_df = pd.DataFrame(matched_pairs).sort_values("net_pnl", ascending=False)

    wins     = (pairs_df["net_pnl"] > 0).sum()
    losses   = (pairs_df["net_pnl"] <= 0).sum()
    win_rate = round(wins / len(pairs_df) * 100, 1) if len(pairs_df) > 0 else 0

    summary = {
        "total_fno_pnl":   round(pairs_df["net_pnl"].sum(), 2),
        "futures_pnl":     round(pairs_df[pairs_df["segment"] == "FUT"]["net_pnl"].sum(), 2),
        "options_pnl":     round(pairs_df[pairs_df["segment"] == "OPT"]["net_pnl"].sum(), 2),
        "total_trades":    len(pairs_df),
        "wins":            int(wins),
        "losses":          int(losses),
        "win_rate_pct":    win_rate,
        "best_trade":      pairs_df.iloc[0]["instrument"] if not pairs_df.empty else None,
        "best_trade_pnl":  pairs_df["net_pnl"].max(),
        "worst_trade":     pairs_df.iloc[-1]["instrument"] if not pairs_df.empty else None,
        "worst_trade_pnl": pairs_df["net_pnl"].min(),
    }

    logger.info(f"  F&O P&L computed ✓  Win rate: {win_rate}%  |  Net P&L: ₹{summary['total_fno_pnl']:,.0f}")
    return {"trade_pairs": pairs_df, "summary": summary}


# ═══════════════════════════════════════════════════════════
# MASTER FUNCTION — run all 6 modules
# ═══════════════════════════════════════════════════════════

def run_analytics(cleaned_data: dict, use_live_prices: bool = True) -> dict:
    """
    Run all 6 analytics modules in order.
    Returns a dict with all results ready for the scorecard.
    """
    master   = cleaned_data["master_ledger"]
    holdings = cleaned_data["holdings"]

    logger.info("=" * 55)
    logger.info("PHASE 3 — ANALYTICS ENGINE STARTED")
    logger.info(f"  master_ledger rows : {len(master)}")
    logger.info("=" * 55)

    # Module 1 — P&L
    pnl_df = compute_pnl(master, holdings)
    logger.info(f"  [M1] pnl_df shape: {pnl_df.shape} | unique symbols: {pnl_df['symbol'].nunique()}")

    # Module 2 — XIRR
    xirr_df = compute_xirr(master, pnl_df)
    logger.info(f"  [M2] xirr_df shape: {xirr_df.shape} | unique symbols: {xirr_df['symbol'].nunique()}")

    # Module 3 — Holding Period
    holding_df = compute_holding_period(master)
    logger.info(f"  [M3] holding_df shape: {holding_df.shape} | unique symbols: {holding_df['symbol'].nunique()}")

    # Module 4 — Volatility & Beta
    eq_symbols = pnl_df["symbol"].tolist()
    risk_df = compute_volatility_beta(eq_symbols, use_live=use_live_prices)
    logger.info(f"  [M4] risk_df shape: {risk_df.shape} | unique symbols: {risk_df['symbol'].nunique()}")

    # Module 5 — Conviction Score
    conviction_df = compute_conviction_score(master, pnl_df, holding_df)
    logger.info(f"  [M5] conviction_df shape: {conviction_df.shape} | unique symbols: {conviction_df['symbol'].nunique()}")

    # Module 6 — F&O P&L
    fno_result = compute_fno_pnl(master)

    # ── Deduplicate every df on symbol before merging ──
    # Duplicate symbols in any df cause row explosion during merge,
    # which produces "Length of values X does not match length of index Y"
    def dedup(df, cols):
        d = df[cols].drop_duplicates(subset=["symbol"], keep="first").reset_index(drop=True)
        return d

    pnl_base         = pnl_df.drop_duplicates(subset=["symbol"], keep="first").reset_index(drop=True)
    xirr_clean       = dedup(xirr_df,      ["symbol", "xirr_pct"])
    holding_clean    = dedup(holding_df,    ["symbol", "avg_holding_days",
                                             "tax_classification", "still_holding",
                                             "total_buy_trades", "total_sell_trades",
                                             "first_buy_date"])
    risk_clean       = dedup(risk_df,       ["symbol", "volatility_pct", "beta", "max_drawdown_pct"])
    conviction_clean = dedup(conviction_df, ["symbol", "conviction_score", "conviction_grade"])

    logger.info(f"  After dedup — pnl:{len(pnl_base)} xirr:{len(xirr_clean)} hold:{len(holding_clean)} risk:{len(risk_clean)} conv:{len(conviction_clean)}")

    # ── Merge into one master scorecard ──
    try:
        scorecard = pnl_base.merge(xirr_clean,       on="symbol", how="left")
        logger.info(f"  After xirr merge: {scorecard.shape}")
        scorecard = scorecard.merge(holding_clean,    on="symbol", how="left")
        logger.info(f"  After holding merge: {scorecard.shape}")
        scorecard = scorecard.merge(risk_clean,       on="symbol", how="left")
        logger.info(f"  After risk merge: {scorecard.shape}")
        scorecard = scorecard.merge(conviction_clean, on="symbol", how="left")
        logger.info(f"  After conviction merge: {scorecard.shape}")
    except Exception as e:
        logger.error(f"  MERGE FAILED: {e}")
        raise

    logger.info("=" * 55)
    logger.info("PHASE 3 — ANALYTICS COMPLETE ✓")
    logger.info(f"  Scorecard rows : {len(scorecard)}")
    logger.info(f"  Columns        : {len(scorecard.columns)}")
    logger.info("=" * 55)

    return {
        "scorecard":     scorecard,
        "pnl":           pnl_df,
        "xirr":          xirr_df,
        "holding":       holding_df,
        "risk":          risk_df,
        "conviction":    conviction_df,
        "fno":           fno_result,
    }