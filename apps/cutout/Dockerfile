FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /bin/uv

ENV UV_PYTHON_DOWNLOADS=never \
    U2NET_HOME=/opt/models \
    NUMBA_CACHE_DIR=/opt/numba-cache \
    OMP_NUM_THREADS=2
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project --no-cache
COPY app.py cutout.py ./
# Prewarm Numba and leave its cache writable by the non-root runtime user.
RUN .venv/bin/python -c 'from cutout import load_model; load_model()' \
    && chmod -R a+rX "$U2NET_HOME" \
    && chown -R 10001:10001 "$NUMBA_CACHE_DIR"

USER 10001:10001
EXPOSE 7000
CMD ["/app/.venv/bin/uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7000"]
