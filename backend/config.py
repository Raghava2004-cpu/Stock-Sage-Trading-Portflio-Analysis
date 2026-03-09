# config.py
# Central config for all broker schemas and project settings.
# To support a new broker, add a new key under BROKER_SCHEMAS.

BROKER_SCHEMAS = {
    "zerodha": {
        "equity": {
            "required_columns": [
                "trade_date", "order_execution_time", "trade_type",
                "scrip_name", "exchange", "quantity", "price",
                "trade_id", "order_id", "series"
            ],
            "date_cols": ["trade_date", "order_execution_time"],
            "symbol_col": "scrip_name",
            "trade_type_col": "trade_type",
            "quantity_col": "quantity",
            "price_col": "price",
            "trade_id_col": "trade_id",
        },
        "fno": {
            "required_columns": [
                "trade_date", "order_execution_time", "trade_type",
                "scrip_name", "exchange", "quantity", "price",
                "trade_id", "order_id", "series"
            ],
            "date_cols": ["trade_date", "order_execution_time"],
            "symbol_col": "scrip_name",
            "trade_type_col": "trade_type",
            "quantity_col": "quantity",
            "price_col": "price",
            "trade_id_col": "trade_id",
            "expiry_col": "expiry_date",
            "strike_col": "strike_price",
            "option_type_col": "option_type",
        },
        "holdings": {
            "required_columns": [
                "tradingsymbol", "exchange", "isin",
                "average_price", "last_price", "pnl"
            ],
            "symbol_col": "tradingsymbol",
            "avg_price_col": "average_price",
            "last_price_col": "last_price",
            "quantity_col": "realised_quantity",
        }
    }
}

# Symbol rename map — handles mergers, rebranding
# Add more as needed
SYMBOL_RENAME_MAP = {
    "MINDTREE":     "LTIM",
    "LTINFOTECH":   "LTIM",
    "HDFC":         "HDFCBANK",      # post-merger 2023
    "INFRATEL":     "BHARTIARTL",
    "ZEEL":         "ZEEMEDIA",
    "INFY EQ":      "INFY",
    "TCS EQ":       "TCS",
    "RELIANCE EQ":  "RELIANCE",
}

# Segment labels used in master ledger
SEGMENT = {
    "equity": "EQ",
    "futures": "FUT",
    "options": "OPT",
}

# Paths
DATA_RAW_DIR     = "data/raw"
DATA_CLEANED_DIR = "data/cleaned"
DB_PATH          = "data/scorecard.db"