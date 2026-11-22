"""Standalone evaluation worker: `uv run python -m app.workers` (set EVALUATION_WORKER=false on the API then)."""

import asyncio
import signal

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.services.evaluate import worker_loop


async def main() -> None:
    configure_logging(get_settings().log_level)
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    await worker_loop(stop)


if __name__ == "__main__":
    asyncio.run(main())
