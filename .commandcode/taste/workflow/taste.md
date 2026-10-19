# Workflow Preferences

- Before coding a non-trivial project, wants a planning phase: inspect the existing project structure, pick the simplest suitable stack, research/validate data sources, design the approach, and produce a worked example — then implement. Confidence: 0.85
- Prefers the simplest stack that fits the task (e.g. favoring a single-process localhost setup) over heavier setups. Confidence: 0.65
- Prefers minimal scope first: build the core requested functionality and deliberately avoid adding many extra features up front. Confidence: 0.7
- After implementation, wants verification: run lint/typecheck/tests (and a production build) if available and fix any errors that surface. Confidence: 0.85
- When refactoring, wants existing tests kept intact and new tests added to cover the new logic. Confidence: 0.8
- Prefers deterministic fixtures for unit tests rather than nondeterministic or live data. Confidence: 0.75
- After finishing, wants a summary of files created/changed, the final approach/design, and run instructions. Confidence: 0.85
- Do not commit or push to Git without an explicit instruction to do so. Confidence: 0.9
- Wants changes strictly scoped to the ticket's stated scope: keep edits 100% isolated to the named area, and do not touch unrelated functionality (even closely related pieces) that is assigned to someone else or a different ticket. Confidence: 0.8
- For out-of-scope parts, wants existing behavior preserved exactly as before — same event names (exact match), same payloads, no incidental "improvements" or refactors. Confidence: 0.8
