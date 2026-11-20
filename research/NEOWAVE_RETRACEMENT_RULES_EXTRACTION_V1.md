# NeoWave Retracement Rules — first-pass extraction

**Status: extracted activation map, NOT an executable rulebook.**  
Primary source: Glenn Neely, *Mastering Elliott Wave*, Version 2.0, 1990.  
Reviewed scan: English image PDF.  
Source locators: printed Chapter 3 pages 3-23 through 3-32; supplied PDF pages 34–39. Rule 1 begins on printed p. 3-23/PDF p. 34. Rules 2–7 are printed pp. 3-24–3-30/PDF pp. 35–38. The graphical summary is printed pp. 3-30–3-31/PDF p. 38. The Pre-Constructive Rules of Logic begin printed p. 3-32/PDF p. 39.

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

- Rule 1: (a) below 61.8%; (b) at least 61.8% but below 100%; (c) 100% through 161.8% inclusive; (d) above 161.8%. The wording around the 161.8% boundary on printed p. 3-23 needs verification because the scan/OCR appears to append “inclusive” ambiguously.
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
1. **Pre-Constructive Logic is integral.** Printed p. 3-32 says the Rule identifiers and their Condition identifiers must be transformed into Structure Labels using the following 26 pages of instructions. The book warns not to read that section straight through and requires real-time chart context. The activation map alone is not sufficient to implement the seven rules.
2. **Tolerance conflict requires resolution.** Printed p. 3-23 labels Rule 3 as an “exactly 61.8%” retracement, while the beginning of the Pre-Constructive section (printed p. 3-33/PDF p. 40) says Fibonacci relationships should receive a slight range, giving 61.8% as approximately 58%–66% (about ±4 percentage points). The engine must not use floating-point exact equality or assume a tolerance policy without reconciling the full rule text and diagrams.
3. **Boundary semantics need explicit verification.** Several bands use “at least”, “less than”, “between”, “inclusive”, and “more than”. Rule 1's 161.8% boundary is unclear in the scan. Overlap/gap tests are required before coding.
4. **Monowave identity comes first.** The source says the terminal points of m0, m1, m2 and m3 must be determined using Rules of Observation before applying retracement rules. It also allows some labeled waves to consist of one or more monowaves.
5. **Context matters.** m0 may be composed of multiple monowaves; the source's diagrams show it can vary widely in length. Rule 4's m3/m2 category is an extra dimension.
6. **No implementation yet.** The existing `NW-RET-01..07` entries remain blocked placeholders. No retracement predicate or pattern conclusion is certified by this note.

## Required next extraction
- Complete the 26-page Pre-Constructive Rules of Logic section (printed pp. 3-32 onward) and transcribe the rule/condition-to-Structure-Label mappings as concise original logic tables.
- Review the full Rule 1–7 pages and diagrams at higher resolution to settle boundary/tolerance details.
- Extract Rules of Observation and the complete Rule of Proportion/Neutrality definitions.
- Build synthetic fixtures for every activation boundary, each condition, Rule 4 categories, unknown context, and ambiguous monowave termination.
- Only then implement the retracement rule module and enable its certification tests.


## Pre-Constructive Rules of Logic — what the next section changes
The section begins on printed p. 3-32 (PDF p. 39) and is described as spanning the next 26 pages. It explicitly transforms each Rule plus its lettered Condition into one or more candidate Structure Labels. The analyst must compare multiple surrounding waves and apply all conditions in each relevant paragraph; the activation band is only the entry point into this decision process.

The first Rule 1 / Condition "a" material begins on printed p. 3-35 (PDF p. 40). The opening examples already refer to:
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
