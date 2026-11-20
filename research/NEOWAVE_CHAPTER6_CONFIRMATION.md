# NeoWave source extraction — Chapter 6 confirmation addenda

**Status:** partial. Based on the supplied Persian translation scan only. This note does not claim that the entire Chapter 6 procedure or all later confirmation rules have been implemented.

## First-stage confirmation (printed Chapter 6, p. 6-2; scan PDF p. 237)

For a candidate pattern whose fifth wave has completed:

- Draw a trendline connecting the ends of waves 2 and 4.
- The market must break that 2–4 trendline within the same amount of time used to form wave 5, or sooner.
- If the break takes longer, the source says the fifth wave may be developing as a terminal pattern, wave 4 may not be complete, or the interpretation may be wrong.
- For triangles, the source substitutes the 0–B trendline and compares the break time with the duration of wave c.

The code's Chapter 6 first-stage diagnostic only checks this timing window after a confirmed trendline-break event has been supplied. It does not detect the trendline break itself, identify the pattern, or certify a complete NeoWave count.

## Other Chapter 6 topics still outstanding

The source also covers corrective-pattern confirmation and triangle-specific requirements. The available scan pages for those topics are incomplete; only the initial 0-B / c-wave timing rule has been implemented through the first-stage diagnostic. Full corrective-pattern confirmation remains blocked. A first-stage pass is not a complete pattern confirmation.


## Second-stage confirmation — standard impulse (printed Chapter 6 pp. 6-3–6-4; scan PDF pp. 238–239)

After stage one, identify which wave is extended. The source then specifies:

- **Extended wave 1:** the subsequent correction must reach the price region at the end of wave 4.
- **Extended wave 3:** the correction must reach the wave-4 price region; a retracement greater than 61.8% of the entire impulse is evidence for an extended third wave.
- **Extended wave 5:** the subsequent correction must retrace at least 61.8% of wave 5, but must not fully retrace wave 5 if the trend is to remain effective. A full retracement indicates the fifth-wave extension may have ended a larger-degree trend or a corrective structure.

The code's `evaluateStage2Confirmation` implements these price checks only after stage one passes. It requires contiguous wave-4, wave-5, full-pattern and correction endpoints. It does not infer which wave is extended, detect the end of the correction, or certify a complete market count. For an extended fifth, the caller must explicitly state whether the correction is complete; otherwise the result remains pending.

The source also describes a truncated fifth (wave 5 shorter than wave 4). The engine's stage-two-only diagnostic checks that condition, requires stage one to pass, requires a post-pattern move opposite the impulse, and checks that the entire impulse retraces without a new trend extreme beforehand. It does not by itself confirm the entire pattern. Because the source's 'strong countertrend' criterion is qualitative, the caller must explicitly attest it; the engine does not invent a numerical strength threshold.

## Correction confirmation caveat (printed Chapter 6 p. 6-5; scan PDF p. 240)

The source states that corrective-pattern confirmation does not have one fixed sequence for all corrections; the required confirmation depends on the pattern's internal structure (including whether b is shorter or longer than a). The scan's p. 6-5 begins a triangle-specific procedure for the case where wave b is shorter than wave a: draw the 0-B line and compare its break time with wave c. The engine requires this applicability condition explicitly and does not apply the timing rule to all triangles. This is separate from the standard-impulse stage-two procedure above and must not be applied indiscriminately to every corrective pattern.


The stage-two implementation requires the stage-one confirmation time and the availability time of each relevant wave/correction to be no later than the supplied `asOfIndex`. A price-rule pass without causal timestamps is not promoted to overall pattern confirmation. The engine does not infer extension type or correction completion; those remain explicit inputs.
