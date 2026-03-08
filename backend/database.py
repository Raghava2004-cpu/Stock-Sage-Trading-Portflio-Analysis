# database.py — StockSage
# SQLAlchemy models + session factory
# Uses SQLite locally, swap DATABASE_URL env var for PostgreSQL in production

import os
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, String, Float, Integer,
    Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./stocksage.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


# ── Models ────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id            = Column(String, primary_key=True)          # UUID
    email         = Column(String, unique=True, nullable=False, index=True)
    name          = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow)

    portfolios = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")


class Portfolio(Base):
    """Each CSV upload creates one Portfolio snapshot — old ones are kept for history."""
    __tablename__ = "portfolios"

    id          = Column(String, primary_key=True)            # UUID
    user_id     = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    is_active   = Column(Boolean, default=True)               # Only one active per user

    # Snapshot totals — stored so history queries are O(1)
    total_invested     = Column(Float, default=0)
    total_current_value = Column(Float, default=0)
    total_pnl          = Column(Float, default=0)
    total_pnl_pct      = Column(Float, default=0)

    user   = relationship("User", back_populates="portfolios")
    stocks = relationship("Stock", back_populates="portfolio", cascade="all, delete-orphan")


class Stock(Base):
    """One row per stock per portfolio snapshot."""
    __tablename__ = "stocks"

    id           = Column(String, primary_key=True)           # UUID
    portfolio_id = Column(String, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True)

    # Core fields from scorecard CSV
    symbol              = Column(String, nullable=False)
    total_invested      = Column(Float,   default=0)
    current_value       = Column(Float,   default=0)
    total_pnl           = Column(Float,   default=0)
    total_pnl_pct       = Column(Float,   default=0)
    realized_pnl        = Column(Float,   default=0)
    unrealized_pnl      = Column(Float,   default=0)
    xirr_pct            = Column(Float,   nullable=True)
    avg_buy_price       = Column(Float,   default=0)
    last_price          = Column(Float,   default=0)
    current_qty         = Column(Integer, default=0)
    conviction_score    = Column(Integer, default=0)
    tax_classification  = Column(String,  nullable=True)      # LTCG / STCG
    avg_holding_days    = Column(Float,   default=0)
    total_buy_trades    = Column(Integer, default=0)
    total_sell_trades   = Column(Integer, default=0)
    first_buy_date      = Column(String,  nullable=True)
    volatility_pct      = Column(Float,   nullable=True)
    max_drawdown_pct    = Column(Float,   nullable=True)
    beta                = Column(Float,   nullable=True)

    portfolio = relationship("Portfolio", back_populates="stocks")


# ── Helpers ───────────────────────────────────────────

def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)