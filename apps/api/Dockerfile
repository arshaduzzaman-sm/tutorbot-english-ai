# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
RUN pip install --no-cache-dir uv==0.8.22
WORKDIR /app
COPY pyproject.toml uv.lock ./
# INSTALL_AI=1 adds the optional local AI packages (faster-whisper, sentence-transformers; several GB)
ARG INSTALL_AI=0
RUN if [ "$INSTALL_AI" = "1" ]; then uv sync --frozen --no-dev --group ai --no-install-project; \
    else uv sync --frozen --no-dev --no-install-project; fi
COPY app ./app
RUN useradd --create-home --uid 10001 appuser
USER appuser
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
