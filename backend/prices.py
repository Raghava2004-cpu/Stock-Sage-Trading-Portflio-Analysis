# prices.py — StockSage
# Live price fetching via Yahoo Finance (15-min delayed, free)
# NSE symbols are suffixed with .NS for Yahoo Finance

import yfinance as yf
from fastapi import APIRouter, Query
from datetime import datetime, timedelta
import time

router = APIRouter(prefix="/prices", tags=["Prices"])

# Simple in-memory cache — prices are refreshed at most every 15 minutes
_cache: dict = {}   # { symbol: (price, fetched_at) }
CACHE_TTL_SECONDS = 900  # 15 minutes


def get_cached_price(symbol: str) -> float | None:
    if symbol in _cache:
        price, fetched_at = _cache[symbol]
        if time.time() - fetched_at < CACHE_TTL_SECONDS:
            return price
    return None


def fetch_from_yahoo(symbols: list[str]) -> dict[str, float]:
    """Fetch latest close prices from Yahoo Finance for NSE symbols."""
    yahoo_symbols = [s + ".NS" for s in symbols]
    result = {}

    try:
        if len(symbols) == 1:
            ticker = yf.Ticker(yahoo_symbols[0])
            hist = ticker.history(period="2d", interval="1d")
            if not hist.empty:
                price = float(hist["Close"].iloc[-1])
                result[symbols[0]] = round(price, 2)
                _cache[symbols[0]] = (price, time.time())
        else:
            data = yf.download(
                tickers=yahoo_symbols,
                period="2d",
                interval="1d",
                group_by="ticker",
                auto_adjust=True,
                progress=False,
            )
            for sym, ysym in zip(symbols, yahoo_symbols):
                try:
                    price = float(data[ysym]["Close"].dropna().iloc[-1])
                    result[sym] = round(price, 2)
                    _cache[sym] = (price, time.time())
                except Exception:
                    pass  # symbol not found — skip
    except Exception as e:
        print(f"[prices] Yahoo Finance fetch error: {e}")

    return result


@router.get("/")
def get_prices(symbols: str = Query(..., description="Comma-separated NSE symbols e.g. RELIANCE,TCS,INFY")):
    """
    Returns latest prices + previous close for given NSE symbols.
    Prices are cached for 15 minutes — Yahoo Finance provides ~15-min delayed data for free.

    Example: GET /prices?symbols=RELIANCE,TCS,INFY
    """
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]

    prices = {}
    prev_closes = {}
    to_fetch = []

    # Return cached prices if fresh
    for sym in symbol_list:
        cached = get_cached_price(sym)
        if cached is not None:
            prices[sym] = cached
        else:
            to_fetch.append(sym)

    # Fetch uncached symbols from Yahoo
    if to_fetch:
        fresh = fetch_from_yahoo(to_fetch)
        prices.update(fresh)

    # Fetch prev close for today's P&L change calculation
    try:
        yahoo_symbols = [s + ".NS" for s in symbol_list]

        if len(symbol_list) == 1:
            ticker = yf.Ticker(yahoo_symbols[0])
            hist = ticker.history(period="5d", interval="1d")
            if len(hist) >= 2:
                prev_closes[symbol_list[0]] = round(float(hist["Close"].dropna().iloc[-2]), 2)
        else:
            data = yf.download(
                tickers=yahoo_symbols,
                period="5d",
                interval="1d",
                group_by="ticker",
                auto_adjust=True,
                progress=False,
            )
            for sym, ysym in zip(symbol_list, yahoo_symbols):
                try:
                    closes = data[ysym]["Close"].dropna()
                    if len(closes) >= 2:
                        prev_closes[sym] = round(float(closes.iloc[-2]), 2)
                except Exception:
                    pass

    except Exception as e:
        print(f"[prices] prev_close fetch error: {e}")

    return {
        "prices":       prices,
        "prev_closes":  prev_closes,
        "delayed_min":  15,
        "note":         "Prices are 15-minute delayed via Yahoo Finance",
        "cached_until": datetime.utcnow() + timedelta(seconds=CACHE_TTL_SECONDS),
    }


@router.get("/nifty")
def get_nifty():
    """Returns Nifty 50 index value for benchmark comparison."""
    try:
        nifty = yf.Ticker("^NSEI")
        hist  = nifty.history(period="5d", interval="1d")
        if hist.empty:
            return {"value": None, "change_pct": None}

        latest = float(hist["Close"].iloc[-1])
        prev   = float(hist["Close"].iloc[-2])
        change = round((latest - prev) / prev * 100, 2)

        # Also compute 1-year return for benchmark comparison
        hist_1y = nifty.history(period="1y", interval="1d")
        year_ago = float(hist_1y["Close"].iloc[0]) if not hist_1y.empty else None
        one_year_return = round((latest - year_ago) / year_ago * 100, 2) if year_ago else None

        return {
            "value":           round(latest, 2),
            "change_pct":      change,
            "one_year_return": one_year_return,
        }
    except Exception as e:
        return {"error": str(e), "value": None}
