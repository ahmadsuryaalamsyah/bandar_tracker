# Security & Safety Preferences

- Never place API keys, tokens, or passwords in source code; use environment variables instead. Confidence: 0.9
- Provide a `.env.example` to document required environment variables (without real secrets). Confidence: 0.9
- Do not read or modify credential/secret files. Confidence: 0.85
- Do not change global configuration that is unrelated to the current feature. Confidence: 0.7
