//! Pure, deterministic domain primitives for Trading V2.
//!
//! This crate validates market bars and computes risk-bounded position proposals.
//! It has no networking, exchange credentials, broker integration, or order
//! submission capability. A proposal is not an instruction to execute a trade.

use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum DomainError {
    InvalidConfig(&'static str),
    InvalidMarketData(String),
    RiskRejected(&'static str),
}

impl fmt::Display for DomainError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidConfig(message) => write!(f, "invalid config: {message}"),
            Self::InvalidMarketData(message) => write!(f, "invalid market data: {message}"),
            Self::RiskRejected(message) => write!(f, "risk rejected: {message}"),
        }
    }
}

impl std::error::Error for DomainError {}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Candle {
    /// UTC Unix timestamp in milliseconds at the start of the candle.
    pub timestamp_ms: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CandlePolicy {
    pub interval_ms: i64,
    pub now_ms: i64,
    pub max_age_ms: i64,
    pub min_bars: usize,
}

pub fn validate_candles(candles: &[Candle], policy: CandlePolicy) -> Result<(), DomainError> {
    if policy.interval_ms <= 0 || policy.now_ms <= 0 || policy.max_age_ms < 0 || policy.min_bars == 0 {
        return Err(DomainError::InvalidConfig("candle policy values must be positive (max_age may be zero)"));
    }
    if candles.len() < policy.min_bars {
        return Err(DomainError::InvalidMarketData("insufficient candle history".into()));
    }

    let mut previous: Option<i64> = None;
    for (index, candle) in candles.iter().enumerate() {
        let values = [candle.open, candle.high, candle.low, candle.close, candle.volume];
        if candle.timestamp_ms < 0 || values.iter().any(|value| !value.is_finite()) {
            return Err(DomainError::InvalidMarketData(format!("non-finite value or invalid timestamp at index {index}")));
        }
        if [candle.open, candle.high, candle.low, candle.close].iter().any(|value| *value <= 0.0)
            || candle.volume < 0.0
        {
            return Err(DomainError::InvalidMarketData(format!("non-positive price or negative volume at index {index}")));
        }
        if candle.high < candle.open.max(candle.close).max(candle.low)
            || candle.low > candle.open.min(candle.close).min(candle.high)
        {
            return Err(DomainError::InvalidMarketData(format!("invalid OHLC range at index {index}")));
        }
        if let Some(previous_timestamp) = previous {
            if candle.timestamp_ms <= previous_timestamp {
                return Err(DomainError::InvalidMarketData("timestamps must be strictly increasing".into()));
            }
            if candle.timestamp_ms - previous_timestamp != policy.interval_ms {
                return Err(DomainError::InvalidMarketData("candle gap detected".into()));
            }
        }
        let close_time = candle.timestamp_ms.checked_add(policy.interval_ms)
            .ok_or_else(|| DomainError::InvalidMarketData("candle timestamp overflow".into()))?;
        if close_time > policy.now_ms {
            return Err(DomainError::InvalidMarketData("latest candle is not closed".into()));
        }
        previous = Some(candle.timestamp_ms);
    }

    let latest = candles.last().ok_or_else(|| DomainError::InvalidMarketData("empty candle history".into()))?;
    let latest_close = latest.timestamp_ms.checked_add(policy.interval_ms)
        .ok_or_else(|| DomainError::InvalidMarketData("latest candle timestamp overflow".into()))?;
    if policy.now_ms - latest_close > policy.max_age_ms {
        return Err(DomainError::InvalidMarketData("latest candle is stale".into()));
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Side {
    Long,
    Short,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RiskLimits {
    /// Fraction of current equity risked at the stop, e.g. 0.01 = 1%.
    pub risk_per_trade: f64,
    pub max_daily_loss: f64,
    pub max_drawdown: f64,
    pub max_leverage: f64,
    /// Estimated one-way fee rate; round-trip fees are included in risk sizing.
    pub fee_rate: f64,
}

impl Default for RiskLimits {
    fn default() -> Self {
        Self {
            risk_per_trade: 0.01,
            max_daily_loss: 0.03,
            max_drawdown: 0.10,
            max_leverage: 1.0,
            fee_rate: 0.0006,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PortfolioState {
    pub equity: f64,
    pub session_start_equity: f64,
    pub peak_equity: f64,
    pub open_notional: f64,
    /// Aggregate worst-case loss at stops for all currently open positions.
    pub open_risk: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct OrderIntent {
    pub side: Side,
    pub entry_price: f64,
    pub stop_price: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RiskProposal {
    pub quantity: f64,
    pub notional: f64,
    pub risk_budget: f64,
    pub estimated_stop_loss_including_fees: f64,
    pub leverage_after: f64,
}

fn valid_fraction(value: f64, name: &'static str, max: f64) -> Result<(), DomainError> {
    if !value.is_finite() || value <= 0.0 || value > max {
        return Err(DomainError::InvalidConfig(name));
    }
    Ok(())
}

/// Return a bounded proposal only. This function never submits or routes orders.
pub fn assess_order(
    portfolio: PortfolioState,
    limits: RiskLimits,
    intent: OrderIntent,
) -> Result<RiskProposal, DomainError> {
    valid_fraction(limits.risk_per_trade, "risk_per_trade must be in (0, 0.02]", 0.02)?;
    valid_fraction(limits.max_daily_loss, "max_daily_loss must be in (0, 0.10]", 0.10)?;
    valid_fraction(limits.max_drawdown, "max_drawdown must be in (0, 0.50]", 0.50)?;
    valid_fraction(limits.max_leverage, "max_leverage must be in (0, 5]", 5.0)?;
    if !limits.fee_rate.is_finite() || limits.fee_rate < 0.0 || limits.fee_rate > 0.02 {
        return Err(DomainError::InvalidConfig("fee_rate must be in [0, 0.02]"));
    }

    let state_values = [portfolio.equity, portfolio.session_start_equity, portfolio.peak_equity, portfolio.open_notional, portfolio.open_risk];
    if state_values.iter().any(|value| !value.is_finite())
        || portfolio.equity <= 0.0
        || portfolio.session_start_equity <= 0.0
        || portfolio.peak_equity <= 0.0
        || portfolio.open_notional < 0.0
        || portfolio.open_risk < 0.0
    {
        return Err(DomainError::InvalidConfig("portfolio state must contain finite positive equity values"));
    }

    let prices = [intent.entry_price, intent.stop_price];
    if prices.iter().any(|price| !price.is_finite() || *price <= 0.0) {
        return Err(DomainError::RiskRejected("entry and stop prices must be finite and positive"));
    }
    let stop_distance = match intent.side {
        Side::Long if intent.stop_price < intent.entry_price => intent.entry_price - intent.stop_price,
        Side::Short if intent.stop_price > intent.entry_price => intent.stop_price - intent.entry_price,
        _ => return Err(DomainError::RiskRejected("stop must be below entry for long and above entry for short")),
    };

    let daily_loss = (portfolio.session_start_equity - portfolio.equity).max(0.0)
        / portfolio.session_start_equity;
    if daily_loss >= limits.max_daily_loss {
        return Err(DomainError::RiskRejected("daily loss limit reached"));
    }
    let drawdown = (portfolio.peak_equity - portfolio.equity).max(0.0)
        / portfolio.peak_equity;
    if drawdown >= limits.max_drawdown {
        return Err(DomainError::RiskRejected("maximum drawdown limit reached"));
    }

    // Reserve room for current open-position risk and never let a new proposal
    // consume more than the remaining daily-loss or peak-drawdown allowance.
    let realized_daily_loss = (portfolio.session_start_equity - portfolio.equity).max(0.0);
    let realized_drawdown = (portfolio.peak_equity - portfolio.equity).max(0.0);
    let daily_risk_remaining = (portfolio.session_start_equity * limits.max_daily_loss
        - realized_daily_loss - portfolio.open_risk).max(0.0);
    let drawdown_risk_remaining = (portfolio.peak_equity * limits.max_drawdown
        - realized_drawdown - portfolio.open_risk).max(0.0);
    let risk_budget = (portfolio.equity * limits.risk_per_trade)
        .min(daily_risk_remaining)
        .min(drawdown_risk_remaining);
    if risk_budget <= 0.0 {
        return Err(DomainError::RiskRejected("no remaining portfolio risk budget"));
    }
    let per_unit_risk = stop_distance + intent.entry_price * limits.fee_rate * 2.0;
    let risk_limited_quantity = risk_budget / per_unit_risk;
    let max_total_notional = portfolio.equity * limits.max_leverage;
    let available_notional = (max_total_notional - portfolio.open_notional).max(0.0);
    let leverage_limited_quantity = available_notional / intent.entry_price;
    let quantity = risk_limited_quantity.min(leverage_limited_quantity);
    if !quantity.is_finite() || quantity <= 0.0 {
        return Err(DomainError::RiskRejected("no remaining notional capacity"));
    }

    let notional = quantity * intent.entry_price;
    let estimated_loss = quantity * per_unit_risk;
    Ok(RiskProposal {
        quantity,
        notional,
        risk_budget,
        estimated_stop_loss_including_fees: estimated_loss,
        leverage_after: (portfolio.open_notional + notional) / portfolio.equity,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn candle(timestamp_ms: i64) -> Candle {
        Candle { timestamp_ms, open: 100.0, high: 102.0, low: 98.0, close: 101.0, volume: 10.0 }
    }

    #[test]
    fn accepts_closed_fresh_contiguous_candles() {
        let bars = [candle(0), candle(60_000), candle(120_000)];
        let policy = CandlePolicy { interval_ms: 60_000, now_ms: 180_500, max_age_ms: 1_000, min_bars: 3 };
        assert_eq!(validate_candles(&bars, policy), Ok(()));
    }

    #[test]
    fn rejects_incomplete_stale_gapped_and_unsorted_candles() {
        let bars = [candle(0), candle(60_000), candle(120_000)];
        let incomplete = CandlePolicy { now_ms: 179_999, ..CandlePolicy { interval_ms: 60_000, now_ms: 0, max_age_ms: 10_000, min_bars: 3 } };
        assert!(validate_candles(&bars, incomplete).is_err());
        let stale = CandlePolicy { interval_ms: 60_000, now_ms: 200_000, max_age_ms: 1_000, min_bars: 3 };
        assert!(validate_candles(&bars, stale).is_err());
        let gap = [candle(0), candle(60_000), candle(180_000)];
        let policy = CandlePolicy { interval_ms: 60_000, now_ms: 240_000, max_age_ms: 60_000, min_bars: 3 };
        assert!(validate_candles(&gap, policy).is_err());
        let unsorted = [candle(0), candle(120_000), candle(60_000)];
        assert!(validate_candles(&unsorted, policy).is_err());
    }

    #[test]
    fn rejects_invalid_ohlc_and_nan() {
        let mut bad = candle(0);
        bad.high = 90.0;
        let policy = CandlePolicy { interval_ms: 60_000, now_ms: 60_000, max_age_ms: 0, min_bars: 1 };
        assert!(validate_candles(&[bad], policy).is_err());
        let mut nan = candle(0);
        nan.close = f64::NAN;
        assert!(validate_candles(&[nan], policy).is_err());
    }

    fn portfolio() -> PortfolioState {
        PortfolioState { equity: 10_000.0, session_start_equity: 10_000.0, peak_equity: 10_000.0, open_notional: 0.0, open_risk: 0.0 }
    }

    #[test]
    fn sizes_position_with_risk_and_leverage_caps() {
        let proposal = assess_order(portfolio(), RiskLimits::default(), OrderIntent {
            side: Side::Long, entry_price: 100.0, stop_price: 95.0,
        }).unwrap();
        assert!(proposal.quantity > 0.0);
        assert!(proposal.estimated_stop_loss_including_fees <= proposal.risk_budget + 1e-8);
        assert!(proposal.leverage_after <= 1.0 + 1e-10);
    }

    #[test]
    fn rejects_wrong_side_stop_and_loss_limits() {
        let wrong_stop = assess_order(portfolio(), RiskLimits::default(), OrderIntent {
            side: Side::Long, entry_price: 100.0, stop_price: 101.0,
        });
        assert!(wrong_stop.is_err());

        let mut daily_loss = portfolio();
        daily_loss.equity = 9_700.0;
        assert!(assess_order(daily_loss, RiskLimits::default(), OrderIntent {
            side: Side::Long, entry_price: 100.0, stop_price: 95.0,
        }).is_err());

        let mut drawdown = portfolio();
        drawdown.equity = 8_900.0;
        assert!(assess_order(drawdown, RiskLimits::default(), OrderIntent {
            side: Side::Short, entry_price: 100.0, stop_price: 105.0,
        }).is_err());
    }

    #[test]
    fn caps_new_risk_by_remaining_daily_and_open_position_budget() {
        let mut near_daily_limit = portfolio();
        near_daily_limit.equity = 9_750.0;
        let proposal = assess_order(
            near_daily_limit,
            RiskLimits::default(),
            OrderIntent { side: Side::Long, entry_price: 100.0, stop_price: 95.0 },
        ).unwrap();
        assert!(proposal.risk_budget <= 50.0 + 1e-8);

        let mut with_open_risk = portfolio();
        with_open_risk.open_risk = 80.0;
        let proposal = assess_order(
            with_open_risk,
            RiskLimits::default(),
            OrderIntent { side: Side::Long, entry_price: 100.0, stop_price: 95.0 },
        ).unwrap();
        assert!(proposal.risk_budget <= 100.0 + 1e-8);

        near_daily_limit.open_risk = 45.0;
        let near_limit = assess_order(
            near_daily_limit,
            RiskLimits::default(),
            OrderIntent { side: Side::Long, entry_price: 100.0, stop_price: 95.0 },
        ).unwrap();
        assert!(near_limit.risk_budget <= 5.0 + 1e-8);

        with_open_risk.open_risk = 300.0;
        assert!(assess_order(
            with_open_risk,
            RiskLimits::default(),
            OrderIntent { side: Side::Long, entry_price: 100.0, stop_price: 95.0 },
        ).is_err());
    }

    #[test]
    fn rejects_non_finite_portfolio_and_limits() {
        let mut bad = portfolio();
        bad.equity = f64::INFINITY;
        assert!(assess_order(bad, RiskLimits::default(), OrderIntent {
            side: Side::Long, entry_price: 100.0, stop_price: 95.0,
        }).is_err());

        let limits = RiskLimits { risk_per_trade: 0.5, ..RiskLimits::default() };
        assert!(assess_order(portfolio(), limits, OrderIntent {
            side: Side::Long, entry_price: 100.0, stop_price: 95.0,
        }).is_err());
    }
}
