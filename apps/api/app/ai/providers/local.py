"""Local providers (faster-whisper, Silero VAD, wav2vec2, LanguageTool, Ollama ...).

They arrive in Milestone 3 (SPEC 14). Until then selecting `local` fails loudly
instead of silently pretending, so nothing fake is shown as real AI.
"""


class LocalProviderNotInstalled(RuntimeError):
    def __init__(self, capability: str) -> None:
        super().__init__(
            f"The local '{capability}' provider is not available yet (planned for Milestone 3). "
            f"Set {capability.upper()}_PROVIDER=mock."
        )
