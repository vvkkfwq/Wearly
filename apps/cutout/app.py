import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from starlette.concurrency import run_in_threadpool

from cutout import EmptyCutout, InvalidImage, load_model, make_cutout

MAX_INPUT_BYTES = 2 * 1024 * 1024
UPLOAD_TIMEOUT_SECONDS = 5


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load once before reporting readiness so requests can reuse the same model session.
    app.state.session = await run_in_threadpool(load_model)
    app.state.processing = asyncio.Lock()
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ready"}


@app.post(
    "/cutout",
    response_class=Response,
    responses={200: {"content": {"image/webp": {}}}},
)
async def cutout(request: Request):
    content_type = (
        request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    )
    if content_type != "image/jpeg":
        raise HTTPException(415, "Expected Content-Type: image/jpeg.")

    # Limit each process to one upload and inference at a time to bound memory use.
    processing = request.app.state.processing
    if processing.locked():
        raise HTTPException(
            503, "The cutout service is busy.", headers={"Retry-After": "1"}
        )

    async with processing:
        body = bytearray()
        try:
            # Bound the entire upload so a stalled caller releases the processing slot.
            async with asyncio.timeout(UPLOAD_TIMEOUT_SECONDS):
                async for chunk in request.stream():
                    if len(body) + len(chunk) > MAX_INPUT_BYTES:
                        raise HTTPException(413, "The JPEG must be at most 2 MiB.")
                    body.extend(chunk)
        except TimeoutError as error:
            raise HTTPException(408, "Timed out reading the JPEG.") from error

        try:
            webp = await run_in_threadpool(
                make_cutout, bytes(body), request.app.state.session
            )
        except InvalidImage as error:
            raise HTTPException(400, str(error)) from error
        except EmptyCutout as error:
            raise HTTPException(422, str(error)) from error
    return Response(webp, media_type="image/webp")
