//! Explainable, configurable confluence scoring for analytical signals.
//!
//! Scores summarize normalized evidence. They are not probabilities, forecasts,
//! or trade instructions. Inputs must be computed from validated, closed bars.

use crate::DomainError;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SignalEvidence {
    /// Directional evidence in [-1, 1]; negative is bearish, positive bullish.
    pub trend: f64,
    pub momentum: f64,
    pub breakout: f64,
    pub volume_confirmation: f64,
    pub higher_timeframe: f64,
    /// Volatility suitability multiplier in [0, 1]. Zero suppresses the score.
    pub volatility_quality: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SignalWeights {
    pub trend: f64,
    pub momentum: f64,
    pub breakout: f64,
    pub volume_confirmation: f64,
    pub higher_timeframe: f64,
}

impl Default for SignalWeights {
    fn default() -> Self {
        Self {
            trend: 0.25,
            momentum: 0.20,
            breakout: 0.25,
            volume_confirmation: 0.10,
            higher_timeframe: 0.20,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SignalDirection {
    Bullish,
    Neutral,
    Bearish,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SignalAssessment {
    /// Signed evidence score from -100 (bearish) to +100 (bullish).
    pub score: f64,
    pub direction: SignalDirection,
    /// Weighted component contributions, before volatility adjustment.
    pub trend_contribution: f64,
    pub momentum_contribution: f64,
    pub breakout_contribution: f64,
    pub volume_contribution: f64,
    pub higher_timeframe_contribution: f64,
    pub volatility_quality: f64,
}

/// Combine normalized evidence without presenting the result as a probability.
///
/// Direction thresholds are intentionally conservative and fixed for now:
/// scores at or above +20 are bullish, at or below -20 bearish, otherwise neutral.
/// These thresholds and default weights require empirical calibration before
/// any claim about predictive performance.
pub fn assess_signal(
    evidence: SignalEvidence,
    weights: SignalWeights,
) -> Result<SignalAssessment, DomainError> {
    let values = [
        evidence.trend,
        evidence.momentum,
        evidence.breakout,
        evidence.volume_confirmation,
        evidence.higher_timeframe,
    ];
    if values.iter().any(|value| !value.is_finite() || !(-1.0..=1.0).contains(value))
        || !evidence.volatility_quality.is_finite()
        || !(0.0..=1.0).contains(&evidence.volatility_quality)
    {
        return Err(DomainError::InvalidMarketData(
            "signal evidence must be finite and within its documented range".into(),
        ));
    }

    let weight_values = [
        weights.trend,
        weights.momentum,
        weights.breakout,
        weights.volume_confirmation,
        weights.higher_timeframe,
    ];
    if weight_values.iter().any(|weight| !weight.is_finite() || *weight < 0.0) {
        return Err(DomainError::InvalidConfig(
            "signal weights must be finite and non-negative",
        ));
    }
    let total_weight: f64 = weight_values.iter().sum();
    if !total_weight.is_finite() || total_weight <= f64::EPSILON {
        return Err(DomainError::InvalidConfig(
            "at least one positive signal weight is required",
        ));
    }

    let trend = evidence.trend * weights.trend / total_weight;
    let momentum = evidence.momentum * weights.momentum / total_weight;
    let breakout = evidence.breakout * weights.breakout / total_weight;
    let volume = evidence.volume_confirmation * weights.volume_confirmation / total_weight;
    let higher_timeframe = evidence.higher_timeframe * weights.higher_timeframe / total_weight;
    let score = (trend + momentum + breakout + volume + higher_timeframe)
        * evidence.volatility_quality
        * 100.0;
    let direction = if score >= 20.0 {
        SignalDirection::Bullish
    } else if score <= -20.0 {
        SignalDirection::Bearish
    } else {
        SignalDirection::Neutral
    };

    Ok(SignalAssessment {
        score,
        direction,
        trend_contribution: trend * 100.0,
        momentum_contribution: momentum * 100.0,
        breakout_contribution: breakout * 100.0,
        volume_contribution: volume * 100.0,
        higher_timeframe_contribution: higher_timeframe * 100.0,
        volatility_quality: evidence.volatility_quality,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn evidence() -> SignalEvidence {
        SignalEvidence {
            trend: 1.0,
            momentum: 0.8,
            breakout: 1.0,
            volume_confirmation: 0.5,
            higher_timeframe: 1.0,
            volatility_quality: 1.0,
        }
    }

    #[test]
    fn returns_explainable_bullish_score() {
        let result = assess_signal(evidence(), SignalWeights::default()).unwrap();
        assert_eq!(result.direction, SignalDirection::Bullish);
        assert!(result.score > 0.0 && result.score <= 100.0);
        let contributions = result.trend_contribution
            + result.momentum_contribution
            + result.breakout_contribution
            + result.volume_contribution
            + result.higher_timeframe_contribution;
        assert!((contributions - result.score).abs() < 1e-10);
    }

    #[test]
    fn conflicting_evidence_can_remain_neutral() {
        let mixed = SignalEvidence {
            trend: 1.0,
            momentum: -1.0,
            breakout: 0.0,
            volume_confirmation: 0.0,
            higher_timeframe: 0.0,
            volatility_quality: 1.0,
        };
        let result = assess_signal(mixed, SignalWeights::default()).unwrap();
        assert_eq!(result.direction, SignalDirection::Neutral);
    }

    #[test]
    fn volatility_quality_suppresses_directional_score() {
        let mut low_quality = evidence();
        low_quality.volatility_quality = 0.0;
        let result = assess_signal(low_quality, SignalWeights::default()).unwrap();
        assert_eq!(result.score, 0.0);
        assert_eq!(result.direction, SignalDirection::Neutral);
    }

    #[test]
    fn rejects_invalid_evidence_and_weights() {
        let mut invalid = evidence();
        invalid.trend = f64::NAN;
        assert!(assess_signal(invalid, SignalWeights::default()).is_err());

        let bad_weights = SignalWeights { trend: -1.0, ..SignalWeights::default() };
        assert!(assess_signal(evidence(), bad_weights).is_err());

        let zero_weights = SignalWeights {
            trend: 0.0,
            momentum: 0.0,
            breakout: 0.0,
            volume_confirmation: 0.0,
            higher_timeframe: 0.0,
        };
        assert!(assess_signal(evidence(), zero_weights).is_err());
    }
}
