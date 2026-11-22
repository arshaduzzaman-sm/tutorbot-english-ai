#!/usr/bin/env bash
# Downloads local AI models into ./models (git-ignored) for the detected hardware tier.
# Milestone 1 uses mock AI only, so this script only records the plan. Real downloads
# (faster-whisper, Silero VAD, wav2vec2, embeddings, Ollama model) are added in Milestone 3.
set -euo pipefail
cd "$(dirname "$0")/.."
tier="${1:-$(scripts/detect-hardware.sh)}"
mkdir -p models
case "$tier" in
  recommended) plan="whisper=large-v3-turbo llm=~7-8B" ;;
  minimum)     plan="whisper=small llm=~3-4B" ;;
  *)           plan="mock providers only" ;;
esac
echo "Hardware tier: $tier ($plan)"
echo "$tier" > models/.tier
echo "Model downloads start in Milestone 3. The app runs now with mock AI (no models needed)."
