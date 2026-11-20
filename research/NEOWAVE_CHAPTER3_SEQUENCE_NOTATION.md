# NeoWave Chapter 3 — structure-sequence notation

**Status:** partial source transcription from the Persian scan, printed Chapter 3 pp. 3-96–3-99 (scan PDF pp. 147–150). The parser is a notation helper, not a complete pattern recognizer.

## Basic versus established labels

The source distinguishes a basic Structure Label (for example, `3:` or `5:` alone) from an established Structure Label that includes one or more status indicators. Status indicators are required when a wave sequence has multiple possible structural labels.

## Sequence separators

- A single dash (`-`) separates labels that remain within the same standard-pattern sequence.
- A double plus (`++`) marks the end of one standard pattern and the beginning of another. The movement between the two patterns is an X-wave.
- When the source explicitly writes `x:c3` between `++` separators, it is the Structure Label for that X-wave connector, not a standard-pattern component.

## Three source-defined labels

- **F3 — First Three:** starts a series after an X-wave or between two 5-wave labels. If two F3 labels occur adjacent to one another, the second begins a new pattern at a larger degree.
- **c3 — Center Three:** cannot start or end a series. The source allows it to describe an X-wave in certain complex corrections, but it is not interchangeable with `x:c3`.
- **x:c3 — Center Three in X-wave Position:** cannot start or end a series. It is a connector used to join separate corrective structures into a larger standard Elliott structure. Its complexity is generally one degree below both structures it connects; the source notes rare exceptions. The engine exposes this as a diagnostic relation, not a hard invalidation rule.

## Implementation

The engine's `parseStructureSequenceNotation`:
- groups labels separated by single dashes into one pattern;
- creates an X-wave connector at `++`;
- preserves an explicit `x:c3` connector label;
- recognizes a second adjacent F3 as a higher-degree start;
- rejects c3 at the start of a series and, when `completeSeries: true`, at the end;
- rejects x:c3 outside an explicit `++` connector position.

This parser does not prove that the price/time conditions for any label are satisfied, does not determine pattern family, and does not certify a completed NeoWave count. The remaining status indicators and all surrounding contextual conditions still need source extraction.


## Additional status labels (Chapter 4 opening, printed pp. 4-1–4-3; scan PDF pp. 151–153)

The next chapter defines additional labels used in structural sequences:

- `s5`: Special Five.
- `L5`: Last Five.
- `sL3`: Special Last Three.
- `L3`: Last Three.

The engine now exposes these meanings alongside F3, c3 and x:c3 through `describeStructureLabel`. These are source semantics only; their contextual conditions and full pattern-boundary logic are not yet implemented.
