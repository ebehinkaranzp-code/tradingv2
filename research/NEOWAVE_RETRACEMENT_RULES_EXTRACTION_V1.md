# NeoWave Retracement Rules — first-pass extraction

**Status: extracted activation map, NOT an executable rulebook.**  
Primary source: Glenn Neely, *Mastering Elliott Wave*, Persian translation scan supplied in this conversation. The English scan has not been verified in this repository.  
Reviewed scan: Persian page images; OCR is unreliable, so disputed wording is retained as unresolved.  
Source locators checked against the supplied Persian page images: Rules 1–7 are shown across printed Chapter 3 pp. 3-30–3-40 (scan PDF pp. 80–91); the graphical summary is printed pp. 3-42–3-43 (scan PDF pp. 92–93). The Pre-Constructive section begins after the summary (scan PDF p. 94 onward). The prior draft's scan-page locators were incorrect and have been replaced.

## Measurement basis recovered
The text instructs the analyst to identify monowave termination points first, then measure the price coverage of m2 relative to m1 and express it as a percentage:
`100 × (vertical price coverage of m2 ÷ vertical price coverage of m1)`.
It separately asks for the relationship of m0 to m1 to select a lettered Condition. Rule 4 additionally asks for the relationship of m3 to m2 to select a Category. The source emphasizes using termination points and says price is implied when a rule does not specify price or time.

## Rule activation bands (m2 as a percentage of m1)

| Rule | Activation condition recovered from source |
|---|---|
| NW-RET-01 | m2 retraces less than 38.2% of m1 |
| NW-RET-02 | m2 retraces at least 38.2% but less than 61.8% of m1 |
| NW-RET-03 | m2 retraces 61.8% of m1 (the source calls this “exactly”; see tolerance conflict below) |
| NW-RET-04 | m2 retraces more than 61.8% but less than 100% of m1 |
| NW-RET-05 | m2 retraces at least 100% but less than 161.8% of m1 |
| NW-RET-06 | m2 retraces between 161.8% and 261.8% of m1, inclusive |
| NW-RET-07 | m2 retraces more than 261.8% of m1 |

These are only activation bands. They do not determine the resulting Elliott/NeoWave structure by themselves.

## Condition maps recovered (m0 as a percentage of m1)

- Rule 1: (a) below 61.8%; (b) at least 61.8% but below 100%; (c) 100% through 161.8% inclusive; (d) above 161.8%. The wording around the 161.8% boundary on printed p. 3-30 needs verification because the scan/OCR appears to append “inclusive” ambiguously.
- Rule 2: (a) below 38.2%; (b) 38.2% to below 61.8%; (c) 61.8% to below 100%; (d) 100% through 161.8% inclusive; (e) above 161.8%.
- Rule 3: (a) below 38.2%; (b) 38.2% to below 61.8%; (c) 61.8% to below 100%; (d) 100% to below 161.8%; (e) 161.8% through 261.8% inclusive; (f) above 261.8%.
- Rule 4: (a) below 38.2%; (b) 38.2% to below 100%; (c) 100% to below 161.8%; (d) 161.8% through 261.8% inclusive; (e) above 261.8%.
- Rules 5, 6 and 7: (a) below 100%; (b) 100% to below 161.8%; (c) 161.8% through 261.8% inclusive; (d) above 261.8%.

## Additional Rule 4 category
After selecting Rule 4's lettered Condition from m0/m1, the source requires a Category based on m3 relative to m2:
- Category i: m3 is at least 100% but less than 161.8% of m2.
- Category ii: m3 is between 161.8% and 261.8% of m2, inclusive.
- Category iii: m3 is more than 261.8% of m2.

The Rule 4 condition/category combination feeds into the Pre-Constructive Rules of Logic. It is not a stand-alone pattern label.

## Critical caveats before implementation
1. **Pre-Constructive Logic is integral.** The Pre-Constructive section (listed in the Chapter 3 contents at printed p. 3-44; scan PDF p. 94 onward) says the Rule identifiers and their Condition identifiers must be transformed into Structure Labels using the following 65 pages of instructions. The book warns not to read that section straight through and requires real-time chart context. The activation map alone is not sufficient to implement the seven rules.
2. **Tolerance conflict requires resolution.** Printed p. 3-30 labels Rule 3 as an “exactly 61.8%” retracement, while the beginning of the Pre-Constructive section (Pre-Constructive section, scan PDF p. 94 onward) says Fibonacci relationships should receive a slight range, giving 61.8% as approximately 58%–66% (about ±4 percentage points). The engine must not use floating-point exact equality or assume a tolerance policy without reconciling the full rule text and diagrams.
3. **Boundary semantics need explicit verification.** Several bands use “at least”, “less than”, “between”, “inclusive”, and “more than”. Rule 1's 161.8% boundary is unclear in the scan. Overlap/gap tests are required before coding.
4. **Monowave identity comes first.** The source says the terminal points of m0, m1, m2 and m3 must be determined using Rules of Observation before applying retracement rules. It also allows some labeled waves to consist of one or more monowaves.
5. **Context matters.** m0 may be composed of multiple monowaves; the source's diagrams show it can vary widely in length. Rule 4's m3/m2 category is an extra dimension.
6. **Implementation remains diagnostic-only.** The engine measures activation/condition/category evidence but does not implement the Pre-Constructive Structure Label decision trees or certify any pattern.

## Required next extraction
- Complete the 65-page Pre-Constructive Rules of Logic section (listed at printed p. 3-44 and beginning in the scan around PDF p. 94) and transcribe the rule/condition-to-Structure-Label mappings as concise original logic tables.
- Review the full Rule 1–7 pages and diagrams at higher resolution to settle boundary/tolerance details.
- Extract Rules of Observation and the complete Rule of Proportion/Neutrality definitions.
- Build synthetic fixtures for every activation boundary, each condition, Rule 4 categories, unknown context, and ambiguous monowave termination.
- Only then implement the retracement rule module and enable its certification tests.


## Pre-Constructive Rules of Logic — what the next section changes
The section is listed at printed p. 3-44 and begins around scan PDF p. 94; it is described as spanning the next 65 pages. It explicitly transforms each Rule plus its lettered Condition into one or more candidate Structure Labels. The analyst must compare multiple surrounding waves and apply all conditions in each relevant paragraph; the activation band is only the entry point into this decision process.

The first Rule 1 / Condition "a" material begins on scan PDF p. 95 onward. The opening examples already refer to:
- relative price and time lengths of m(-1), m0, m1, m2, m3 and sometimes later waves;
- complete retracements measured against the time consumed to form a wave, with an added one-time-unit convention;
- candidate impulse, flat, zigzag, triangle, complex-correction, terminal, and X-wave interpretations;
- alternative X-wave locations, including an explicitly "missing" wave possibility;
- additional conditions that remove candidate Structure Labels from the list.

This confirms that the retracement rules are not a seven-way Fibonacci classifier. They are a multi-stage decision tree producing a ranked/listed set of structural hypotheses, which must later be grouped and confirmed. The exact paragraph-level predicates still need a full page-by-page extraction and positive/negative fixtures.

## Tolerance and causality implications
- The opening of the Pre-Constructive section says that Fibonacci ratios such as 61.8% and 161.8% should receive a tolerance; its example treats 61.8% as approximately 58%–66%. It also says "almost" and "close to" mean within 10% of the stated ratio.
- The same section says time retracements must be interpreted precisely, including the extra one-time-unit convention. Price tolerance must not be silently applied to time rules.
- The text explicitly says not to eliminate a possibility because a measured price ratio is slightly off an ideal level, and describes an Exception Rule elsewhere in the book.
- Because conditions can refer to m3, m4, m5, prior waves, trendline breaks and subsequent retracements, a Structure Label cannot be considered available merely when m1 or m2 first forms. Its `availableAt` must be no earlier than the latest confirmed endpoint needed by the full condition. Later evidence may remove an earlier hypothesis; the engine must preserve the hypothesis history and causal timestamps.
- A "missing" X-wave must remain a hypothesis with explicit evidence and alternative placements until later structure confirms or rejects it. The engine must not fabricate an invisible wave simply to force a preferred pattern.

## Implementation consequence
Keep `NW-RET-01..07` blocked. The next implementation unit is not a single numeric function; it is a source-backed Rule/Condition evaluator that emits candidate Structure Labels, evidence references, unresolved conditions, and a causal `availableAt`. The pattern engine then groups monowaves into higher-degree structures and applies post-constructive confirmation/invalidation rules.


## First-pass review of the Pre-Constructive section (PDF pp. 39–47)
The page images for scan PDF pp. 80–94 were visually checked. The Pre-Constructive section begins at printed p. 3-44 (scan PDF p. 95) and spans 65 pages; only selected pages and initial Rule/Condition label lists have been transcribed so far.

### Reliable methodological findings
- The section says Rule identifiers and their Condition identifiers are replaced by one or more candidate Structure Labels for each analyzed monowave.
- The candidate list is contextual and sequential: inspect actual surrounding price action and later waves, apply all conditions in a paragraph, and update the label list as evidence develops.
- Labels in parentheses/brackets indicate lower-probability or conditional alternatives, not equivalent-strength candidates.
- When m1 is the first observed monowave and there is no prior market action, the entire initial Structure list is carried forward; the method does not pretend that m0 or earlier context exists.
- When a label is being reassessed after a confirmed/compacted pattern, the source distinguishes the base structure from surrounding labels and warns against treating compacted waves as if they were ordinary individual waves.
- The section explicitly warns against reading the decision tree straight through without live chart context. It recommends working one wave at a time and repeatedly reassessing prior labels.
- Price/time calculations use wave termination points. Time comparisons may add one standard time unit to the measured wave duration; this convention must be applied only where the source specifies it.
- It describes an Exception Rule: if all but one of the listed conditions are followed and one is missed only slightly, the proposed label may still be used. This must not be generalized into permission to ignore hard invalidations elsewhere.
- The goal of reassessment includes identifying a possible “missing” wave/X-wave. Such a wave is a hypothesis with alternate locations, not a license to invent unobserved price data.

### Structure-label logic recovered at a high level
The opening Rule 1 and Rule 2 conditions demonstrate that a single activation band can produce several competing structural interpretations (including corrective, impulse/terminal, triangle, and complex-correction possibilities). The list is then pruned by later evidence such as:
- whether subsequent monowaves exceed the endpoint of m1;
- relative price/time length of preceding and following waves;
- whether a later wave is fully retraced, and whether that retracement is faster or slower than the wave took to form;
- overlap/shared price territory between nonadjacent waves;
- trendline breaks within specified time constraints;
- whether m3/m4/m5 are longer/shorter or meet stated retracement proportions;
- whether a proposed X-wave placement is plausible or remains missing/ambiguous.

These are not complete predicates and are not sufficient to reproduce the book's complete decision tables. Rule 4's extra m3/m2 categories add another branch dimension and a large number of context-dependent conditions.

### Engineering implications
1. The engine must represent a **set of competing hypotheses**, not a single deterministic wave label chosen from one ratio.
2. Each hypothesis needs evidence/provenance, conditional-vs-primary rank, source locator, unresolved predicates, and `availableAt` equal to the latest confirmed bar required by every condition used.
3. New waves can prune or alter the list; preserve versioned hypothesis history rather than rewriting history with future information.
4. Distinguish price retracement from time retracement. Time comparisons use bar/time units and source-specific +1 conventions; do not reuse price tolerance.
5. "Exception Rule" should be modeled as a separate, explicitly scoped override with a source locator and bounded tolerance, not a blanket pass.
6. Do not automatically certify a pattern because a Structure Label appears in a list. Later chapters define construction, grouping, completion, and confirmation.

## Production gate correction
The engine's previous public validator accepted caller-supplied `sourceVerified: true` and arbitrary callbacks, which could make synthetic test definitions appear tradable. That was not a safe production certification boundary. The engine now has an explicit closed certification manifest; the validator remains non-tradable regardless of caller-supplied fake provenance until the source-backed rulebook and independent rule tests are genuinely complete. Synthetic tests may test local evaluator behavior, but cannot certify production NeoWave.


## Additional source-boundary conflict: Rule 3 Condition e

The Persian scan's Rule 3 prose on printed Chapter 3 p. 3-32 states that Condition e covers m0 between 161.8% and 261.8% of m1, with Condition f above 261.8%. The summary diagram on the following rule-identification page labels the corresponding upper boundary as 2.168 (216.8%), not 2.618 (261.8%). This is a source-internal discrepancy, not a rounding issue. The engine therefore reports Rule 3 m0/m1 values above 216.8% and up to 261.8% as indeterminate; it does not silently choose the prose or diagram. The exact 216.8% endpoint follows the diagram's Condition e endpoint, while values above 261.8% follow the prose's Condition f range. This decision must be revisited against the English scan and surrounding source context before certification.

The same summary diagram groups Rules 5, 6, and 7 under the common m0/m1 condition bands: a below 100%; b from 100% to below 161.8%; c from 161.8% through 261.8%; d above 261.8%. These are identifiers only and do not replace the Pre-Constructive Structure Label decision tree.


## Monowave groups and endpoint measurement (Chapter 3, printed pp. 3-3 onward)

The source's Rules of Observation show that m0 and m2 may each consist of one monowave or a group of monowaves. Their start/end boundaries are determined from the surrounding confirmed price action; the internal zigzag does not change the definition of the group's overall price coverage. Ratios for grouped waves must therefore use the group's termination endpoints, not the sum of all internal up/down segments. The engine now exposes `aggregateMonowaveGroup` for contiguous constituent monowaves and reports the net endpoint coverage plus the latest constituent confirmation time. It does not decide which monowaves belong together; that grouping still requires the source's full observation and context rules.


## Structure Label notation sample (Rule 3, Condition a)

The supplied scan's Rule 3 Condition-a heading shows the slash-separated label list `{F3/c3/s5/5/(sL3)/[L5]}` (scan PDF p. 106, printed Chapter 3 p. 3-58). The engine now parses this notation while preserving unwrapped labels as primary candidates and parenthesized labels as lower-probability alternatives and bracketed labels as rare or highly unlikely alternatives. This parser only preserves source notation; it does not evaluate the conditions that select or eliminate any candidate label.


## Partial Pre-Constructive label seeds transcribed

The following heading-level candidate lists have been visually transcribed from the Persian scan and are exposed in code only as partial seeds:

| Rule/Condition | Source notation | Scan page |
|---|---|---:|
| 1:a | `{5/(c3)/(x:c3)/[sL3]/[s5]}` | 95 |
| 2:a | `{5/(sL3)/[c3]/[s5]}` | 96 |
| 3:a | `{F3/c3/s5/5/(sL3)/[L5]}` | 106 |

The parser preserves unwrapped labels as primary candidates and wrapped labels as alternatives. These seeds do **not** include the full condition predicates, subsequent-wave tests, or all other Rule/Condition combinations. They are not enough to emit a valid Structure Label or certify a count; all other combinations return indeterminate.


## Directional sequence checks

The retracement diagrams define m2 as a move opposite to m1. Rule 4's m3 follows m2 and moves opposite to it when measuring the next leg. The executable context analyzer now refuses to classify a same-direction m2/m1 pair and leaves Rule 4's category indeterminate unless m3 is measurable and reverses m2. These checks prevent magnitude-only ratios from being mislabeled as retracements.


The engine's `analyzeNeoWaveRetracement` wrapper attaches these partial seeds only when the measured Rule/Condition matches one of the three transcribed entries. Other combinations remain `indeterminate`; even a seed match is explicitly non-tradable and does not imply that its surrounding Pre-Constructive predicates passed.


## Separate time-coverage measurement

The engine now exposes `timeCoverageRatio` independently from price coverage. It supports explicit time-unit adjustments, but applies none by default. A caller must pass the adjustment only where the specific Pre-Constructive paragraph requires the source's additional one-time-unit convention. The function reports the exact adjustments and causal availability used.


For matching measured contexts, `analyzeNeoWaveRetracement` now turns the partial seed list into competing Structure Label hypotheses. Because the complete Pre-Constructive predicates have not been evaluated, every generated hypothesis remains conditional. This preserves alternatives without falsely selecting one.


## Probability notation verified from the Pre-Constructive introduction

The introductory page (printed p. 3-44; scan PDF p. 95) explicitly distinguishes the wrappers: unwrapped labels are the most likely; labels in parentheses have lower probability than unwrapped labels; labels in brackets are rare or very unlikely. The engine parser now preserves three separate ranks: `primary`, `conditional` and `rare`. The Pre-Constructive decision tree spans 65 pages, not 26; earlier draft notes stating 26 pages were incorrect and have been corrected.


## Scan completeness gap

The introductory text describes a 65-page Pre-Constructive section beginning at printed p. 3-44. The supplied scan reaches printed p. 3-99 at scan PDF p. 150, then jumps to Chapter 4 at scan PDF p. 151 (printed p. 4-10). Nine intermediate printed pages are absent from the supplied scan; their chapter assignment cannot be established from the available pages. No rules from those missing pages are inferred or implemented.


## Additional visual source pass: Rule 4, Conditions a and b (scan PDF pp. 116–119)

The Persian scan images for PDF pp. 115–119 were visually reviewed after the earlier first-pass extraction.

- **Rule 4:a** appears on scan PDF p. 116. Its heading-level Structure Label notation is `{F3/c3/s5/[sL3]}`. The page heading identifies the Rule 4 category as m3 at least 100% but below 161.8% of m2 (Category i). The following paragraphs continue the contextual pruning conditions; the heading list alone is not an executable mapping.
- **Rule 4:b** appears on scan PDF p. 119. Its heading-level notation is `{F3/c3/s5/(sL3)/(x:c3)/[L5]}`. This page also shows the 100%–below-161.8% m3/m2 category (Category i). The text again requires subsequent-wave and prior-wave context, time/price comparisons, and later pattern evidence.
- Rule 4 therefore cannot be represented by a Rule/Condition pair alone: its third dimension (Category i/ii/iii from m3/m2) must remain attached to the hypothesis key. These two visually recovered headings are recorded as **partial source observations**, not added to the executable `PRECONSTRUCTIVE_SEEDS` table, because the complete category-specific decision branches have not yet been extracted.
- Scan PDF pp. 117–118 continue Rule 4:a conditions; they are not a complete independent summary page. Rule 4:b begins on p. 119. No unshown Rule 4 categories or conditions are inferred from these pages.

This pass does not resolve the earlier Rule 3 prose/diagram discrepancy, the missing printed pages, or the full Rule 4 decision tree.
