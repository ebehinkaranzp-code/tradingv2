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


/// Current closed-bar Quattro signal conditions. This is a signal primitive,
/// not the complete pyramiding/backtest state machine.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct QuattroSignal {
    pub entry_breakout: bool,
    pub exit_breakdown: bool,
    pub daily_trend_filter: bool,
    pub atr: f64,
    pub daily_ema200: f64,
}

/// Evaluate the last 4h candle against the previous 20-bar high and 10-bar low,
/// using only daily EMA200 values whose daily candle closed before the 4h bar.
pub fn quattro_signal(four_hour: &[Candle], daily: &[Candle]) -> Result<QuattroSignal, DomainError> {
    const FOUR_HOURS_MS: i64 = 4 * 60 * 60 * 1000;
    const DAY_MS: i64 = 24 * 60 * 60 * 1000;
    if four_hour.len() < 21 || daily.len() < 220 {
        return Err(DomainError::InvalidMarketData("Quattro requires at least 21 4h and 220 daily candles".into()));
    }
    let closes: Vec<f64> = daily.iter().map(|bar| bar.close).collect();
    let ema = exponential_moving_average(&closes, 200)?;
    let current = four_hour.last().ok_or_else(|| DomainError::InvalidMarketData("missing 4h candle".into()))?;
    let prior_20 = &four_hour[four_hour.len() - 21..four_hour.len() - 1];
    let prior_10 = &four_hour[four_hour.len() - 11..four_hour.len() - 1];
    let highest_high = prior_20.iter().map(|bar| bar.high).fold(f64::NEG_INFINITY, f64::max);
    let lowest_low = prior_10.iter().map(|bar| bar.low).fold(f64::INFINITY, f64::min);

    let daily_index = daily.iter().rposition(|bar| {
        bar.timestamp_ms.checked_add(DAY_MS).is_some_and(|close_time| close_time <= current.timestamp_ms)
    }).ok_or_else(|| DomainError::InvalidMarketData("no fully closed daily candle is available for the 4h trend filter".into()))?;
    let daily_ema200 = ema[daily_index];
    let atr = average_true_range(four_hour, 14)?;
    let daily_trend_filter = current.close > daily_ema200;

    let _ = FOUR_HOURS_MS; // The caller validates timeframe continuity before calling.
    Ok(QuattroSignal {
        entry_breakout: current.close > highest_high && daily_trend_filter,
        exit_breakdown: current.close < lowest_low,
        daily_trend_filter,
        atr: *atr.last().ok_or_else(|| DomainError::InvalidMarketData("ATR is unavailable".into()))?,
        daily_ema200,
    })
}

/// EMA with the first value as its seed. Inputs must be finite and period > 0.
pub fn exponential_moving_average(values: &[f64], period: usize) -> Result<Vec<f64>, DomainError> {
    if period == 0 || values.is_empty() || values.iter().any(|value| !value.is_finite()) {
        return Err(DomainError::InvalidMarketData("EMA requires finite values and a positive period".into()));
    }
    let alpha = 2.0 / (period as f64 + 1.0);
    let mut previous = values[0];
    let mut output = Vec::with_capacity(values.len());
    output.push(previous);
    for value in values.iter().skip(1) {
        previous = alpha * value + (1.0 - alpha) * previous;
        output.push(previous);
    }
    Ok(output)
}

/// Wilder-smoothed ATR. The first true range is high minus low.
pub fn average_true_range(candles: &[Candle], period: usize) -> Result<Vec<f64>, DomainError> {
    if period == 0 || candles.is_empty() {
        return Err(DomainError::InvalidMarketData("ATR requires candles and a positive period".into()));
    }
    let mut previous_close: Option<f64> = None;
    let mut previous_atr: Option<f64> = None;
    let mut output = Vec::with_capacity(candles.len());
    for candle in candles {
        let true_range = match previous_close {
            None => candle.high - candle.low,
            Some(close) => (candle.high - candle.low)
                .max((candle.high - close).abs())
                .max((candle.low - close).abs()),
        };
        let atr = match previous_atr {
            None => true_range,
            Some(previous) => ((period as f64 - 1.0) * previous + true_range) / period as f64,
        };
        output.push(atr);
        previous_close = Some(candle.close);
        previous_atr = Some(atr);
    }
    Ok(output)
}

/// Long-only volatility-targeted momentum exposure building block.
/// The walk-forward lookback selection and no-trade-band state machine are separate.
pub fn momentum_exposure(
    closes: &[f64],
    lookback: usize,
    volatility_window: usize,
    target_annual_volatility: f64,
) -> Result<f64, DomainError> {
    if lookback == 0 || volatility_window < 2 || closes.len() <= lookback
        || closes.len() <= volatility_window
        || !target_annual_volatility.is_finite()
        || target_annual_volatility <= 0.0
        || closes.iter().any(|price| !price.is_finite() || *price <= 0.0)
    {
        return Err(DomainError::InvalidMarketData("invalid momentum inputs or insufficient close history".into()));
    }
    let last = closes.len() - 1;
    let momentum = closes[last] / closes[last - lookback] - 1.0;
    if momentum <= 0.0 {
        return Ok(0.0);
    }
    let start = closes.len() - volatility_window - 1;
    let mut returns = Vec::with_capacity(volatility_window);
    for index in (start + 1)..closes.len() {
        returns.push(closes[index] / closes[index - 1] - 1.0);
    }
    let mean = returns.iter().sum::<f64>() / returns.len() as f64;
    let variance = returns.iter().map(|value| (value - mean).powi(2)).sum::<f64>()
        / (returns.len() - 1) as f64;
    let annualized_volatility = variance.sqrt() * 365.0_f64.sqrt();
    if annualized_volatility <= f64::EPSILON {
        return Ok(0.0);
    }
    Ok((target_annual_volatility / annualized_volatility).min(1.0))
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
    fn ema_and_atr_are_finite_and_deterministic() {
        let ema = exponential_moving_average(&[1.0, 2.0, 3.0], 2).unwrap();
        assert!((ema[1] - 1.6666666667).abs() < 1e-8);
        let bars = [candle(0), candle(60_000), candle(120_000)];
        let atr = average_true_range(&bars, 14).unwrap();
        assert_eq!(atr.len(), 3);
        assert!(atr.iter().all(|value| value.is_finite() && *value > 0.0));
    }

    #[test]
    fn momentum_exposure_is_long_only_and_volatility_capped() {
        let rising: Vec<f64> = (0..100).map(|index| 100.0 + index as f64).collect();
        let exposure = momentum_exposure(&rising, 20, 30, 0.40).unwrap();
        assert!((0.0..=1.0).contains(&exposure));
        let falling: Vec<f64> = (0..100).map(|index| 200.0 - index as f64).collect();
        assert_eq!(momentum_exposure(&falling, 20, 30, 0.40).unwrap(), 0.0);
    }

    #[test]
    fn quattro_signal_uses_previous_bars_and_closed_daily_ema() {
        let day_ms = 86_400_000;
        let daily: Vec<Candle> = (0..220).map(|index| Candle {
            timestamp_ms: index * day_ms,
            open: 100.0 + index as f64 * 0.2,
            high: 102.0 + index as f64 * 0.2,
            low: 99.0 + index as f64 * 0.2,
            close: 101.0 + index as f64 * 0.2,
            volume: 100.0,
        }).collect();
        let mut four_hour: Vec<Candle> = (0..21).map(|index| Candle {
            timestamp_ms: 220 * day_ms + index * 14_400_000,
            open: 180.0,
            high: 181.0,
            low: 179.0,
            close: 180.0,
            volume: 10.0,
        }).collect();
        let last = four_hour.last_mut().unwrap();
        last.high = 191.0;
        last.close = 190.0;
        let signal = quattro_signal(&four_hour, &daily).unwrap();
        assert!(signal.daily_trend_filter);
        assert!(signal.entry_breakout);
        assert!(!signal.exit_breakdown);
        assert!(signal.atr.is_finite() && signal.atr > 0.0);
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
