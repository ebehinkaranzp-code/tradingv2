# NeoWave source extraction — Chapter 5 structural rules

**Status:** partial source extraction from the supplied Persian translation scan. This is a research note, not an executable or complete rulebook. The scan is the only currently verified book file; English wording has not been checked.

## Source scope

- Chapter 5, "Central Structural Notes" (printed pages 5-2 onward in the Persian edition).
- The first section, "Necessary Structural Rules", appears on printed page 5-3.
- The text explicitly says these are guidelines for analyzing most corrective patterns; the following section introduces additional rules for combining/aggregating structures. Do not treat the seven items below as universal pattern definitions.

## Seven necessary structural guidelines (source-faithful summary)

For a candidate five-section trend/terminal sequence:

1. Five adjacent sections must exist. A section may be one monowave or a group of monowaves, and the sequence must satisfy the structural requirements for a trend or terminal pattern.
2. Three of the five sections must progress in the same direction: upward or downward.
3. Immediately after section 1, a small movement in the opposite direction must occur (section 2). Section 2 must not completely retrace section 1.
4. Section 3 must be longer than section 2. The source wording here does not explicitly restate whether "longer" is price, time, or a combined comparison; do not encode a single metric without reviewing the detailed context.
5. Immediately after section 3, a small movement in the opposite direction to section 3 must occur (section 4). Section 4 must not completely retrace section 3.
6. Section 5 is almost always longer than section 4. If section 4 is larger, the source gives a fallback: section 5 must be at least 38.2% of section 4, measured by price.
7. When comparing the vertical price coverage of sections 1, 3 and 5, section 3 need not be the largest, but it must not be the smallest of the three.

## Interpretation constraints

- These are candidate/necessary guidelines, not sufficient proof that a five-section structure is an impulse or terminal.
- The text distinguishes ordinary corrective patterns from trend/terminal patterns and warns that corrective patterns do not necessarily obey these guidelines.
- The book separately discusses 3-3-3-3-3 triangles, zigzags, flats, and other structures. A generic five-section validator must not be applied to those families unless the relevant source rule explicitly requires it.
- "Longer" in items 4 and 6 must not be silently normalized to price or time. Item 6 explicitly specifies price only for its 38.2% fallback.
- Section identity and endpoints must be established from Rules of Observation before applying structural tests. A section can contain more than one monowave.
- The source's retracement/aggregation/alternation/degree rules later in the chapter can modify or constrain these initial guidelines.

## Engineering consequence

The engine now exposes these as a **candidate five-section checklist** restricted to trend or terminal candidates, with explicit unresolved metric semantics. It checks adjacency, directional sequence, the two non-complete-retracement constraints, the 1/3/5 price-coverage condition, and the two 'longer' comparisons. For the latter, it returns indeterminate when price and time comparisons disagree. It must not emit a pattern label from this checklist alone. A future implementation should:
- require five contiguous, ordered sections with explicit endpoints and constituent monowaves;
- evaluate direction and complete-retracement constraints only where the source wording is unambiguous;
- return indeterminate for "longer" comparisons until the applicable price/time convention is established from the surrounding rule;
- retain candidate hypotheses and their causal availability in revision history;
- keep pattern completion/confirmation and tradability blocked pending later chapters' rules and independent validation.
