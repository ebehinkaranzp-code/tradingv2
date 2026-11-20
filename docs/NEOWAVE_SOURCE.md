# NeoWave primary-source reference

## Bibliographic reference
- Title: Mastering Elliott Wave, Version 2.0
- Author: Glenn Neely, with Eric Hall
- Copyright: © 1990 Glenn Neely; revised edition of a work first published in 1988.
- English scan: user-provided archive extracted on 2026-11-20; 169 PDF pages; scanned/image-based.
- Persian scan: user-provided archive extracted on 2026-11-20; 446 PDF pages.
- Persian source URL: https://shirazneowave.ir/Download/Mastering%20Elliott%20Wave%20(persian).pdf
- Alternate Persian URL: https://shirazneowave.ir/Download/mastering-elliot-wave%20%28Glenn%20Neely%29.pdf
- Reference added: 2026-11-20

## Actual file availability and review status
The user supplied a ZIP containing both PDFs. The files were extracted in the working session:
- `Glenn-Neely-Mastering-Elliott-Waves.pdf` (English, 169 pages)
- `Glenn-Neely-Mastering-Elliott-Wave__Persian_.pdf` (Persian, 446 pages)

The English PDF is an image scan. OCR has been performed on the cover, copyright/acknowledgments, table-of-contents pages, preface, and selected opening pages of Chapter 1. The Persian PDF's extracted text layer is not reliably readable due to font/encoding problems; only a small number of introductory/contents pages have been inspected with OCR. Neither edition has yet been read and verified end-to-end. See `research/neowave_source_extraction_v1.md` for the limited first-pass outline and page locators.

## Supplementary Persian Q&A source
- Category: پرسش‌وپاسخ‌های گلن نیلی (Neely FAQ)
- URL: https://shirazneowave.ir/category/amoozesh/neely-faq/
- Intended use: supplementary source for clarifications, edge cases, pattern identification, and rule interpretation.
- Access status on 2026-11-20: the category page timed out when accessed; its contents have not yet been retrieved or reviewed. Do not treat this link as already-read material.

## Archival and copyright policy
This repository stores bibliographic references, concise original research notes, source locators, and implementation tests—not copies of the book or website articles. The English scan states that all rights are reserved, including reproduction in whole or part without publisher permission. The Persian scan's front matter also indicates translation rights are reserved. Do not commit either PDF, complete OCR dumps, verbatim chapters, or substantial transcriptions. Do not assume that the availability of a user-provided copy grants redistribution rights.

## Trading v2 research use
Use the book as the intended primary reference and the Persian FAQ as a supplementary source for a complete NeoWave rule-engine research effort. Do not claim complete rule coverage until each rule has:
1. A stable rule ID and exact source locator (chapter/section/printed page and PDF page; FAQ article URL/title where applicable).
2. A precise, testable condition, including exceptions, prerequisites, applicable pattern/degree, and required data.
3. Explicit pass/fail/indeterminate semantics.
4. Positive, negative, boundary, and missing-data unit tests.
5. A causal implementation using only information available at the decision time.
6. Defined invalidation, post-completion confirmation, and recount behavior where applicable.
7. An explicit status: implemented, partially implemented, pending source verification, or not applicable.

Indicators (RSI, MACD, Stochastic, ATR, volume) may be used as secondary confirmation only. They must never override a mandatory NeoWave rule violation. If a rule cannot be evaluated from available data, the pattern must remain unknown/unconfirmed rather than being accepted.

## Current evidence boundary
The existing engine is a research scaffold. It contains confirmed-pivot/monowave diagnostics and a fail-closed validation gate; its seven retracement-rule entries are placeholders, not implemented predicates. Pattern family names in the catalog are not proof of rule coverage. No complete NeoWave count, NeoWave-qualified backtest, or live-trading authorization is established by the current code.

## Next steps
Continue OCR and source verification chapter by chapter, beginning with the complete Preliminary Analysis and Central Considerations chapters. Convert verified rules into concise original rule cards with source locators and independent tests. Keep the original PDFs and full OCR output outside this repository unless redistribution rights are documented.
