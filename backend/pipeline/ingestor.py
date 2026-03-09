# pipeline/ingestor.py
# If it's a .js file:

import os
import pandas as pd

from backend.config import BROKER_SCHEMAS, DATA_RAW_DIR
from backend.utils.logger import get_logger

logger = get_logger("ingestor")


def load_csv(filepath: str) -> pd.DataFrame:
    """Load a single CSV into a DataFrame with basic sanity checks."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")

    df = pd.read_csv(filepath, skipinitialspace=True)

    if df.empty:
        raise ValueError(f"File is empty: {filepath}")

    df.columns = [col.strip().lower().replace(" ", "_") for col in df.columns]

    logger.info(f"Loaded {len(df)} rows from {os.path.basename(filepath)}")
    return df


def validate_schema(df: pd.DataFrame, required_cols: list, file_label: str) -> None:
    """Raise clearly if any required column is missing."""
    missing = [col for col in required_cols if col not in df.columns]

    if missing:
        raise ValueError(
            f"[{file_label}] Missing required columns: {missing}\n"
            f"Found columns: {list(df.columns)}"
        )

    logger.info(f"[{file_label}] Schema validation passed ✓")


def ingest(
    broker: str = "zerodha",
    equity_file: str = None,
    fno_file: str = None,
    holdings_file: str = None,
) -> dict:

    if broker not in BROKER_SCHEMAS:
        raise ValueError(
            f"Unsupported broker '{broker}'. Supported: {list(BROKER_SCHEMAS.keys())}"
        )

    schema = BROKER_SCHEMAS[broker]

    equity_file = equity_file or os.path.join(DATA_RAW_DIR, "zerodha_tradebook_equity.csv")
    fno_file = fno_file or os.path.join(DATA_RAW_DIR, "zerodha_tradebook_fno.csv")
    holdings_file = holdings_file or os.path.join(DATA_RAW_DIR, "zerodha_holdings.csv")

    logger.info("=" * 50)
    logger.info("PHASE 1 — DATA INGESTION STARTED")
    logger.info("=" * 50)

    df_equity = load_csv(equity_file)
    df_fno = load_csv(fno_file)
    df_holdings = load_csv(holdings_file)

    validate_schema(df_equity, schema["equity"]["required_columns"], "Equity Tradebook")
    validate_schema(df_fno, schema["fno"]["required_columns"], "F&O Tradebook")
    validate_schema(df_holdings, schema["holdings"]["required_columns"], "Holdings")

    logger.info("PHASE 1 — INGESTION COMPLETE ✓")
    logger.info(f"Equity trades : {len(df_equity)} rows")
    logger.info(f"F&O trades    : {len(df_fno)} rows")
    logger.info(f"Holdings      : {len(df_holdings)} rows")

    return {
        "equity": df_equity,
        "fno": df_fno,
        "holdings": df_holdings,
    }