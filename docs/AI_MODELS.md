# AI models

The app works with **mock providers** by default (`*_PROVIDER=mock`). Every mock result says `provider: "mock"` and
the UI shows "Demo mode: AI not connected". Local providers (`*_PROVIDER=local`) are in
`apps/api/app/ai/providers/local.py`. They are imported only when chosen, and fail with a clear message if the
package or service is missing. Install the Python packages with `cd apps/api && uv sync --group ai`.

Scores come from measurable signals only (SPEC 6.1). The LLM writes the feedback text and never sets a band.

| Capability | Default (local) | Licence | Size / RAM | Version locked |
|---|---|---|---|---|
| Speech-to-text | faster-whisper, model `small` (`WHISPER_MODEL=large-v3-turbo` on stronger computers) | MIT (code and weights) | ~500 MB (`small`, int8) | faster-whisper 1.2.1 |
| Voice activity | Silero VAD, built into faster-whisper (`vad_filter=True`) | MIT | small | bundled |
| Pronunciation | Whisper word confidence as a proxy (see DECISIONS) | MIT | none extra | — |
| Fluency | word timings from speech-to-text (pauses, rate, fillers) | our code (MIT) | none | — |
| Grammar | LanguageTool server, HTTP (`erikvl87/languagetool:6.6`, `docker compose --profile ai`) | LGPL-2.1 (separate process) | ~1 GB RAM | image 6.6 |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` | Apache-2.0 | ~90 MB | sentence-transformers 6.3.0 |
| LLM (feedback text) | Ollama `qwen3:4b` (`ollama/ollama:0.12.6`) | Apache-2.0 (Ollama MIT) | ~3 GB | image 0.12.6 |
| TTS (offline content only) | Kokoro-82M via `make audio` | Apache-2.0 | small | not run here |

**Not tested in this environment:** model downloads are blocked here, so the local providers have unit tests for
their error path only. The full flow (record → transcript → evaluation) is tested end to end with mocks.
Planned later: a wav2vec2 phoneme model for real pronunciation scoring (needs a licence check of the model card).
