# AI models

**Milestone 1 uses mock providers only.** No models are downloaded. Every response says `provider: "mock"` and the
UI shows "Demo mode: AI not connected".

Planned for Milestone 3 (check current version and licence before installing, then fill in this table):

| Capability | Planned default | Licence | Size / RAM | Version checked |
|---|---|---|---|---|
| Speech-to-text | faster-whisper (`small` / `large-v3-turbo`) | MIT (code), Whisper weights MIT | TBD | TBD |
| Voice activity | Silero VAD | MIT | small | TBD |
| Pronunciation | wav2vec2 phoneme CTC model | check model card | TBD | TBD |
| Phonemiser | espeak-ng (separate container) | GPL-3.0 (run as separate process) | small | TBD |
| Grammar | LanguageTool server (`erikvl87/languagetool:6.6` image) | LGPL-2.1 | ~1 GB RAM | image tag only |
| Vocabulary | wordfreq + open academic word list | check | small | TBD |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` | Apache-2.0 | ~90 MB | TBD |
| LLM | Ollama + small Apache-2.0 model (e.g. Qwen 4B-8B) | check model licence | 3-8 GB | TBD |
| TTS (offline content only) | Kokoro-82M | Apache-2.0 | small | TBD |
