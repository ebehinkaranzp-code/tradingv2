//! Common technical indicators for deterministic market analysis.
//!
//! Inputs are expected to come from validated, completed candles. Warm-up
//! periods are represented as None rather than filled with synthetic values.

use crate::{Candle, DomainError};

fn validate_closes(closes: &[f64], min_len: usize, name: &'static str) -> Result<(), DomainError> {
    if closes.len() < min_len || closes.iter().any(|value| !value.is_finite() || *value <= 0.0) {
        return Err(DomainError::InvalidMarketData(name.into()));
    }
    Ok(())
}

/// Wilder RSI. The first value is available after period price changes.
pub fn relative_strength_index(closes: &[f64], period: usize) -> Result<Vec<Option<f64>>, DomainError> {
    if period == 0 {
        return Err(DomainError::InvalidConfig("RSI period must be positive"));
    }
    validate_closes(closes, period + 1, "RSI requires positive finite closes and sufficient history")?;

    let mut output = vec![None; closes.len()];
    let mut gain_sum = 0.0;
    let mut loss_sum = 0.0;
    for index in 1..=period {
        let change = closes[index] - closes[index - 1];
        if change > 0.0 {
            gain_sum += change;
        } else {
            loss_sum -= change;
        }
    }
    let mut average_gain = gain_sum / period as f64;
    let mut average_loss = loss_sum / period as f64;

    let value = |gain: f64, loss: f64| {
        if loss <= f64::EPSILON {
            if gain <= f64::EPSILON { 50.0 } else { 100.0 }
        } else if gain <= f64::EPSILON {
            0.0
        } else {
            let relative_strength = gain / loss;
            100.0 - 100.0 / (1.0 + relative_strength)
        }
    };
    output[period] = Some(value(average_gain, average_loss));

    for index in (period + 1)..closes.len() {
        let change = closes[index] - closes[index - 1];
        let gain = change.max(0.0);
        let loss = (-change).max(0.0);
        average_gain = (average_gain * (period - 1) as f64 + gain) / period as f64;
        average_loss = (average_loss * (period - 1) as f64 + loss) / period as f64;
        output[index] = Some(value(average_gain, average_loss));
    }
    Ok(output)
}

#[derive(Debug, Clone, PartialEq)]
pub struct MacdPoint {
    pub line: Option<f64>,
    pub signal: Option<f64>,
    pub histogram: Option<f64>,
}

/// MACD with standard EMA seeding and explicit warm-up gaps.
pub fn macd(
    closes: &[f64],
    fast_period: usize,
    slow_period: usize,
    signal_period: usize,
) -> Result<Vec<MacdPoint>, DomainError> {
    if fast_period == 0 || slow_period == 0 || signal_period == 0 || fast_period >= slow_period {
        return Err(DomainError::InvalidConfig("MACD periods must be positive and fast < slow"));
    }
    validate_closes(closes, slow_period + signal_period - 1, "MACD requires positive finite closes and sufficient history")?;

    let fast = ema(closes, fast_period);
    let slow = ema(closes, slow_period);
    let start = slow_period - 1;
    let line: Vec<f64> = (start..closes.len()).map(|index| fast[index] - slow[index]).collect();
    let signal_line = ema(&line, signal_period);
    let mut output = vec![MacdPoint { line: None, signal: None, histogram: None }; closes.len()];
    for index in start..closes.len() {
        let line_value = line[index - start];
        let signal_index = index - start;
        let signal_value = (signal_index + 1 >= signal_period).then_some(signal_line[signal_index]);
        output[index] = MacdPoint {
            line: Some(line_value),
            signal: signal_value,
            histogram: signal_value.map(|value| line_value - value),
        };
    }
    Ok(output)
}

fn ema(values: &[f64], period: usize) -> Vec<f64> {
    let alpha = 2.0 / (period as f64 + 1.0);
    let mut previous = values[0];
    let mut output = Vec::with_capacity(values.len());
    output.push(previous);
    for value in values.iter().skip(1) {
        previous = alpha * value + (1.0 - alpha) * previous;
        output.push(previous);
    }
    output
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BollingerBand {
    pub middle: f64,
    pub upper: f64,
    pub lower: f64,
}

/// Rolling SMA bands using sample standard deviation.
pub fn bollinger_bands(
    closes: &[f64],
    period: usize,
    standard_deviations: f64,
) -> Result<Vec<Option<BollingerBand>>, DomainError> {
    if period < 2 || !standard_deviations.is_finite() || standard_deviations <= 0.0 {
        return Err(DomainError::InvalidConfig("Bollinger period must be >= 2 and deviation multiplier positive"));
    }
    validate_closes(closes, period, "Bollinger Bands requires positive finite closes and sufficient history")?;
    let mut output = vec![None; closes.len()];
    for end in (period - 1)..closes.len() {
        let window = &closes[end + 1 - period..=end];
        let mean = window.iter().sum::<f64>() / period as f64;
        let variance = window.iter().map(|value| (value - mean).powi(2)).sum::<f64>()
            / (period - 1) as f64;
        let deviation = variance.sqrt() * standard_deviations;
        output[end] = Some(BollingerBand {
            middle: mean,
            upper: mean + deviation,
            lower: mean - deviation,
        });
    }
    Ok(output)
}

/// On-balance volume. The initial value is zero; flat closes do not change OBV.
pub fn on_balance_volume(candles: &[Candle]) -> Result<Vec<f64>, DomainError> {
    if candles.is_empty() {
        return Err(DomainError::InvalidMarketData("OBV requires at least one candle".into()));
    }
    if candles.iter().any(|bar| {
        !bar.close.is_finite() || bar.close <= 0.0 || !bar.volume.is_finite() || bar.volume < 0.0
    }) {
        return Err(DomainError::InvalidMarketData("OBV requires positive finite closes and non-negative finite volume".into()));
    }
    let mut output = Vec::with_capacity(candles.len());
    let mut cumulative = 0.0;
    output.push(cumulative);
    for index in 1..candles.len() {
        if candles[index].close > candles[index - 1].close {
            cumulative += candles[index].volume;
        } else if candles[index].close < candles[index - 1].close {
            cumulative -= candles[index].volume;
        }
        output.push(cumulative);
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rsi_handles_rising_falling_and_flat_series() {
        let rising: Vec<f64> = (1..=20).map(f64::from).collect();
        let rsi = relative_strength_index(&rising, 14).unwrap();
        assert_eq!(rsi[13], None);
        assert_eq!(rsi[14], Some(100.0));

        let falling: Vec<f64> = (20..=39).rev().map(f64::from).collect();
        assert_eq!(relative_strength_index(&falling, 14).unwrap()[14], Some(0.0));

        let flat = vec![100.0; 20];
        assert_eq!(relative_strength_index(&flat, 14).unwrap()[14], Some(50.0));
    }

    #[test]
    fn macd_preserves_warmup_and_histogram_identity() {
        let closes: Vec<f64> = (0..60).map(|index| 100.0 + index as f64).collect();
        let values = macd(&closes, 12, 26, 9).unwrap();
        assert!(values[24].line.is_none());
        assert!(values[25].line.is_some());
        assert!(values[32].signal.is_none());
        let point = &values[33];
        assert!(point.histogram.is_some());
        assert!((point.histogram.unwrap() - (point.line.unwrap() - point.signal.unwrap())).abs() < 1e-10);
    }

    #[test]
    fn bollinger_bands_are_ordered_and_have_warmup() {
        let closes = [10.0, 11.0, 12.0, 13.0, 14.0];
        let bands = bollinger_bands(&closes, 3, 2.0).unwrap();
        assert!(bands[1].is_none());
        let band = bands[2].unwrap();
        assert!(band.upper > band.middle && band.middle > band.lower);
    }

    #[test]
    fn obv_tracks_volume_direction_and_flat_bars() {
        let candles = [
            Candle { timestamp_ms: 0, open: 10.0, high: 11.0, low: 9.0, close: 10.0, volume: 5.0 },
            Candle { timestamp_ms: 1, open: 10.0, high: 12.0, low: 10.0, close: 11.0, volume: 7.0 },
            Candle { timestamp_ms: 2, open: 11.0, high: 11.0, low: 10.0, close: 11.0, volume: 3.0 },
            Candle { timestamp_ms: 3, open: 11.0, high: 11.0, low: 9.0, close: 10.0, volume: 4.0 },
        ];
        assert_eq!(on_balance_volume(&candles).unwrap(), vec![0.0, 7.0, 7.0, 3.0]);
    }

    #[test]
    fn rejects_invalid_indicator_parameters_and_data() {
        assert!(relative_strength_index(&[1.0, 2.0], 0).is_err());
        assert!(macd(&[1.0, 2.0], 12, 12, 9).is_err());
        assert!(bollinger_bands(&[1.0, f64::NAN], 2, 2.0).is_err());
        let invalid = Candle { timestamp_ms: 0, open: 1.0, high: 1.0, low: 1.0, close: 0.0, volume: f64::INFINITY };
        assert!(on_balance_volume(&[invalid]).is_err());
    }
}
