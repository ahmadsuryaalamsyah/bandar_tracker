# Code Style & Architecture Preferences

- Prefers TypeScript when using JavaScript / a JS framework such as Next.js. Confidence: 0.85
- Wants concerns cleanly separated into layers — data-fetching, calculation/domain logic, and UI — so the code is easy to extend. Confidence: 0.8
- When integrating external APIs, wants an abstraction/service layer so the provider can be easily swapped. Confidence: 0.75
- Wants pure, testable domain logic separated from I/O. Confidence: 0.65
- Avoids using dummy/mock data for final results when a real, accessible data source is available. Confidence: 0.7
- Values transparent, explainable logic over black-box behavior, and never wants a claim that something replicates a proprietary/undisclosed formula; document the actual approach and its limitations. Confidence: 0.7
- Prefers outputs normalized to a consistent, human-readable scale (e.g. 0–100) with simple interpretations. Confidence: 0.65
- Wants changes to be diagnosis-driven, not tuned to produce a favorable-looking result; explicitly does not want formulas/logic altered just so outputs "look bullish" — keep the underlying logic honest and transparent. Confidence: 0.8
- Avoids hardcoding content keyed to specific inputs (e.g. per-ticker text); wants derived values/UI text computed from the actual data and calculation. Confidence: 0.75
- Expects tools/features to operate over the complete dataset (e.g. the whole market), not a small hardcoded/curated subset, and questions opaque caps or silent limits on coverage. Confidence: 0.55
- Explicitly wants code that is not "AI slop": no generic, generated-looking boilerplate and no over-confident/unsubstantiated claims — each piece should be grounded in the actual implementation and evidence. Confidence: 0.7
