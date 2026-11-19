//! Deterministic, single-position historical simulator.
//!
//! Signals are evaluated at bar close and filled at the next bar open.
//! Stops are evaluated against each bar's OHLC. This is a research simulator,
//! not an exchange connector or a live execution component.

use crate::{
    assess_order, validate_candles, Candle, CandlePolicy, DomainError, OrderIntent,
    PortfolioState, RiskLimits, Side,
};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BacktestSignal {
    Hold,
    EnterLong { stop_price: f64 },
    EnterShort { stop_price: f64 },
    Exit,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BacktestConfig {
    pub interval_ms: i64,
    pub now_ms: i64,
    pub max_age_ms: i64,
    pub initial_equity: f64,
    /// Adverse price adjustment on every simulated fill; e.g. 0.001 = 10 bps.
    pub slippage_rate: f64,
    pub risk_limits: RiskLimits,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BacktestTrade {
    pub side: Side,
    pub entry_time_ms: i64,
    pub exit_time_ms: i64,
    pub entry_price: f64,
    pub exit_price: f64,
    pub quantity: f64,
    pub net_pnl: f64,
    pub exit_reason: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EquityPoint {
    pub timestamp_ms: i64,
    pub equity: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BacktestReport {
    pub initial_equity: f64,
    pub final_equity: f64,
    pub total_return: f64,
    pub max_drawdown: f64,
    pub win_rate: f64,
    pub trades: Vec<BacktestTrade>,
    pub equity_curve: Vec<EquityPoint>,
}

#[derive(Debug, Clone, Copy)]
struct ExecutionCosts {
    slippage_rate: f64,
    fee_rate: f64,
}

#[derive(Debug, Clone, Copy)]
struct Position {
    side: Side,
    entry_time_ms: i64,
    entry_price: f64,
    stop_price: f64,
    quantity: f64,
    entry_fee: f64,
}

fn adverse_fill(raw_price: f64, side: Side, is_entry: bool, slippage: f64) -> f64 {
    match (side, is_entry) {
        (Side::Long, true) | (Side::Short, false) => raw_price * (1.0 + slippage),
        (Side::Short, true) | (Side::Long, false) => raw_price * (1.0 - slippage),
    }
}

fn close_position(
    cash: &mut f64,
    position: Position,
    raw_exit: f64,
    timestamp_ms: i64,
    reason: &'static str,
    costs: ExecutionCosts,
    trades: &mut Vec<BacktestTrade>,
) {
    let exit_price = adverse_fill(raw_exit, position.side, false, costs.slippage_rate);
    let direction = if position.side == Side::Long { 1.0 } else { -1.0 };
    let gross_pnl = (exit_price - position.entry_price) * position.quantity * direction;
    let exit_fee = exit_price * position.quantity * costs.fee_rate;
    *cash += gross_pnl - exit_fee;
    trades.push(BacktestTrade {
        side: position.side,
        entry_time_ms: position.entry_time_ms,
        exit_time_ms: timestamp_ms,
        entry_price: position.entry_price,
        exit_price,
        quantity: position.quantity,
        net_pnl: gross_pnl - position.entry_fee - exit_fee,
        exit_reason: reason,
    });
}

fn marked_equity(cash: f64, position: Option<Position>, close: f64) -> f64 {
    match position {
        None => cash,
        Some(position) => {
            let direction = if position.side == Side::Long { 1.0 } else { -1.0 };
            cash + (close - position.entry_price) * position.quantity * direction
        }
    }
}

/// Run a deterministic one-position backtest. No order is transmitted.
///
/// The input bars must be contiguous, closed and fresh according to the config.
/// The final open position is liquidated at the last close, with adverse
/// slippage and fees, so the report always contains realized final equity.
pub fn run_backtest(
    candles: &[Candle],
    signals: &[BacktestSignal],
    config: BacktestConfig,
) -> Result<BacktestReport, DomainError> {
    if candles.len() < 2 || signals.len() != candles.len() {
        return Err(DomainError::InvalidConfig("backtest needs at least two bars and one signal per bar"));
    }
    if !config.initial_equity.is_finite() || config.initial_equity <= 0.0 {
        return Err(DomainError::InvalidConfig("initial_equity must be finite and positive"));
    }
    if !config.slippage_rate.is_finite() || !(0.0..=0.05).contains(&config.slippage_rate) {
        return Err(DomainError::InvalidConfig("slippage_rate must be between 0 and 5%"));
    }
    validate_candles(
        candles,
        CandlePolicy {
            interval_ms: config.interval_ms,
            now_ms: config.now_ms,
            max_age_ms: config.max_age_ms,
            min_bars: 2,
        },
    )?;

    let initial_equity = config.initial_equity;
    let fee_rate = config.risk_limits.fee_rate;
    let mut cash = initial_equity;
    let mut position: Option<Position> = None;
    let mut trades = Vec::new();
    let mut equity_curve = Vec::with_capacity(candles.len());
    let mut peak_equity = initial_equity;
    let mut max_drawdown: f64 = 0.0;
    let mut session_start_equity = initial_equity;
    let mut current_utc_day = candles[0].timestamp_ms.div_euclid(86_400_000);
    let mut pending = BacktestSignal::Hold;

    for (index, candle) in candles.iter().enumerate() {
        let utc_day = candle.timestamp_ms.div_euclid(86_400_000);
        if utc_day != current_utc_day {
            session_start_equity = marked_equity(cash, position, candles[index - 1].close);
            current_utc_day = utc_day;
        }

        match pending {
            BacktestSignal::Exit => {
                if let Some(open_position) = position.take() {
                    close_position(
                        &mut cash,
                        open_position,
                        candle.open,
                        candle.timestamp_ms,
                        "signal_next_open",
                        ExecutionCosts { slippage_rate: config.slippage_rate, fee_rate },
                        &mut trades,
                    );
                }
            }
            BacktestSignal::EnterLong { stop_price } | BacktestSignal::EnterShort { stop_price }
                if position.is_none() =>
            {
                let side = match pending {
                    BacktestSignal::EnterLong { .. } => Side::Long,
                    BacktestSignal::EnterShort { .. } => Side::Short,
                    _ => unreachable!(),
                };
                let entry_price = adverse_fill(candle.open, side, true, config.slippage_rate);
                let proposal = assess_order(
                    PortfolioState {
                        equity: cash,
                        session_start_equity,
                        peak_equity,
                        open_notional: 0.0,
                        open_risk: 0.0,
                    },
                    config.risk_limits,
                    OrderIntent { side, entry_price, stop_price },
                );
                if let Ok(proposal) = proposal {
                    let entry_fee = proposal.notional * fee_rate;
                    cash -= entry_fee;
                    position = Some(Position {
                        side,
                        entry_time_ms: candle.timestamp_ms,
                        entry_price,
                        stop_price,
                        quantity: proposal.quantity,
                        entry_fee,
                    });
                }
            }
            BacktestSignal::Hold | BacktestSignal::EnterLong { .. } | BacktestSignal::EnterShort { .. } => {}
        }

        if let Some(open_position) = position {
            let stop_hit = match open_position.side {
                Side::Long => candle.low <= open_position.stop_price,
                Side::Short => candle.high >= open_position.stop_price,
            };
            if stop_hit {
                let raw_exit = match open_position.side {
                    Side::Long if candle.open <= open_position.stop_price => candle.open,
                    Side::Long => open_position.stop_price,
                    Side::Short if candle.open >= open_position.stop_price => candle.open,
                    Side::Short => open_position.stop_price,
                };
                position = None;
                close_position(
                    &mut cash,
                    open_position,
                    raw_exit,
                    candle.timestamp_ms,
                    "stop_loss",
                    ExecutionCosts { slippage_rate: config.slippage_rate, fee_rate },
                    &mut trades,
                );
            }
        }

        let equity = marked_equity(cash, position, candle.close);
        peak_equity = peak_equity.max(equity);
        if peak_equity > 0.0 {
            max_drawdown = max_drawdown.max((peak_equity - equity).max(0.0) / peak_equity);
        }
        equity_curve.push(EquityPoint { timestamp_ms: candle.timestamp_ms, equity });

        pending = if index + 1 < candles.len() { signals[index] } else { BacktestSignal::Hold };
    }

    if let Some(open_position) = position.take() {
        let last = candles.last().expect("at least two candles checked");
        close_position(
            &mut cash,
            open_position,
            last.close,
            last.timestamp_ms + config.interval_ms,
            "end_of_data",
            ExecutionCosts { slippage_rate: config.slippage_rate, fee_rate },
            &mut trades,
        );
        peak_equity = peak_equity.max(cash);
        if peak_equity > 0.0 {
            max_drawdown = max_drawdown.max((peak_equity - cash).max(0.0) / peak_equity);
        }
        if let Some(last_point) = equity_curve.last_mut() {
            last_point.equity = cash;
        }
    }

    let wins = trades.iter().filter(|trade| trade.net_pnl > 0.0).count();
    let win_rate = if trades.is_empty() { 0.0 } else { wins as f64 / trades.len() as f64 };
    Ok(BacktestReport {
        initial_equity,
        final_equity: cash,
        total_return: cash / initial_equity - 1.0,
        max_drawdown,
        win_rate,
        trades,
        equity_curve,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const FOUR_HOURS: i64 = 14_400_000;

    fn bars(values: &[(f64, f64, f64, f64)]) -> Vec<Candle> {
        values.iter().enumerate().map(|(index, (open, high, low, close))| Candle {
            timestamp_ms: index as i64 * FOUR_HOURS,
            open: *open,
            high: *high,
            low: *low,
            close: *close,
            volume: 100.0,
        }).collect()
    }

    fn config(last_bar_count: usize) -> BacktestConfig {
        BacktestConfig {
            interval_ms: FOUR_HOURS,
            now_ms: last_bar_count as i64 * FOUR_HOURS,
            max_age_ms: 0,
            initial_equity: 10_000.0,
            slippage_rate: 0.001,
            risk_limits: RiskLimits::default(),
        }
    }

    #[test]
    fn fills_signals_on_next_open_and_charges_both_sides() {
        let candles = bars(&[
            (100.0, 101.0, 99.0, 100.0),
            (102.0, 105.0, 101.0, 104.0),
            (105.0, 108.0, 104.0, 107.0),
            (110.0, 112.0, 109.0, 111.0),
        ]);
        let signals = [
            BacktestSignal::EnterLong { stop_price: 95.0 },
            BacktestSignal::Hold,
            BacktestSignal::Exit,
            BacktestSignal::Hold,
        ];
        let report = run_backtest(&candles, &signals, config(4)).unwrap();
        assert_eq!(report.trades.len(), 1);
        let trade = &report.trades[0];
        assert_eq!(trade.entry_time_ms, FOUR_HOURS);
        assert_eq!(trade.exit_time_ms, 3 * FOUR_HOURS);
        assert!(trade.entry_price > 102.0);
        assert!(trade.exit_price < 110.0);
        assert!(trade.net_pnl > 0.0);
        assert!(report.final_equity > report.initial_equity);
    }

    #[test]
    fn stop_loss_uses_gap_aware_adverse_fill() {
        let candles = bars(&[
            (100.0, 101.0, 99.0, 100.0),
            (100.0, 102.0, 99.0, 101.0),
            (97.0, 98.0, 94.0, 95.0),
        ]);
        let signals = [
            BacktestSignal::EnterLong { stop_price: 95.0 },
            BacktestSignal::Hold,
            BacktestSignal::Hold,
        ];
        let report = run_backtest(&candles, &signals, config(3)).unwrap();
        assert_eq!(report.trades.len(), 1);
        assert_eq!(report.trades[0].exit_reason, "stop_loss");
        assert!(report.trades[0].exit_price < 97.0);
        assert!(report.trades[0].net_pnl < 0.0);
    }

    #[test]
    fn last_bar_signal_is_not_filled_with_lookahead() {
        let candles = bars(&[
            (100.0, 101.0, 99.0, 100.0),
            (100.0, 102.0, 99.0, 101.0),
        ]);
        let signals = [
            BacktestSignal::Hold,
            BacktestSignal::EnterLong { stop_price: 95.0 },
        ];
        let report = run_backtest(&candles, &signals, config(2)).unwrap();
        assert!(report.trades.is_empty());
        assert_eq!(report.final_equity, 10_000.0);
    }

    #[test]
    fn rejects_signal_count_mismatch_and_gapped_history() {
        let candles = bars(&[
            (100.0, 101.0, 99.0, 100.0),
            (100.0, 102.0, 99.0, 101.0),
        ]);
        assert!(run_backtest(&candles, &[BacktestSignal::Hold], config(2)).is_err());

        let mut gap = candles.clone();
        gap[1].timestamp_ms += FOUR_HOURS;
        assert!(run_backtest(&gap, &[BacktestSignal::Hold; 2], config(2)).is_err());
    }
}
