# NeoWave source extraction — Chapter 3 observation, proportion and neutrality

**Status:** source-grounded research notes from the supplied Persian translation scan; not a complete executable specification.

## Rules of Observation — monowave endpoints

Source locator: printed Chapter 3 pp. 3-2–3-4 (scan PDF pp. 50–55).

The Chapter 3 opening explains that a chart must be prepared before identifying individual monowaves. It uses the most important low/high as the initial reference, then identifies successive change-of-direction points from the price path. A monowave runs between two successive identified turning points. The book distinguishes the end of one monowave from the start/end of the next and emphasizes that the terminal point is the point at which the market's direction changes, not an arbitrary fixed-window local extreme.

The scan's examples also show why a generic fixed left/right fractal detector cannot be treated as Neely's Rules of Observation. The current engine's symmetric-fractal pivots are therefore explicitly labeled heuristic candidates and are not certified as NeoWave monowaves.

## Rule of Proportion

Source locator: printed Chapter 3 p. 3-5 (scan PDF p. 55).

The source says chart construction requires selecting both a price scale and a time scale. Their purpose is to make the price/time behavior of the wave pattern observable and comparable. It explicitly cautions that:
- there is no single independent time unit that is always suitable for analysis;
- time is flexible and should be interpreted with the market's observed behavior;
- the correct scale supports consistent proportional comparison across waves;
- the proportionality rule is used to standardize the appearance/measurement of price patterns, not to claim that every market has one universal time scale.

The diagrams show that the same data can appear materially different under different horizontal/vertical scales. Therefore the engine must preserve source time and price units and must not infer a universal bars-per-price-unit threshold from chart pixels or a fixed display ratio.

## Directional and non-directional movement; Neutrality Rule

Source locators: printed Chapter 3 pp. 3-6–3-13 (scan PDF pp. 56–63).

The source distinguishes directional movement (price movement with a discernible upward/downward direction) from non-directional or neutral movement. A neutral move is not automatically a flat line and cannot be identified by one fixed price threshold alone. Its interpretation depends on surrounding movement and on the selected chart scale. The examples distinguish:
- neutral movement in relation to preceding/following waves;
- opposing directional movement;
- same-direction movement;
- cases where a nominally horizontal movement is still price movement and must be evaluated in context.

The source warns that the analyst must not assume a move is neutral solely because it appears small or horizontal. It must be assessed against the adjacent wave context and the proportionality rules.

## Engineering consequences

1. Do not promote fixed-window fractal pivots to authoritative Neely monowaves.
2. Do not define neutrality as `abs(priceChange) < constant` without the source's proportionality and contextual conditions.
3. Preserve native timestamps, price values, chart scale metadata and endpoint provenance.
4. Any automated endpoint or neutrality decision that lacks enough source-defined context must return indeterminate and preserve alternatives.
5. The existing candidate-pivot functions remain useful only as optional diagnostics until a full Rules-of-Observation implementation is built and independently validated.
