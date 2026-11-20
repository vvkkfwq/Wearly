from io import BytesIO

from PIL import Image, ImageOps
from rembg import new_session, remove
from rembg.sessions.base import BaseSession

MAX_INPUT_EDGE = 1024
MAX_OUTPUT_EDGE = 320
ALPHA_BOUNDS_THRESHOLD = 16
PADDING_RATIO = 0.05


class InvalidImage(ValueError):
    pass


class EmptyCutout(ValueError):
    pass


def load_model() -> BaseSession:
    return new_session("u2netp", providers=["CPUExecutionProvider"])


def make_cutout(jpeg: bytes, session: BaseSession) -> bytes:
    try:
        with Image.open(BytesIO(jpeg), formats=["JPEG"]) as source:
            if max(source.size) > MAX_INPUT_EDGE:
                raise InvalidImage(
                    "The JPEG must be at most 1024 px on its longest edge."
                )
            image = ImageOps.exif_transpose(source).convert("RGB")
    except (OSError, Image.DecompressionBombError) as error:
        raise InvalidImage("The request body must contain a valid JPEG.") from error

    cutout = remove(image, session=session)
    alpha = cutout.getchannel("A")
    # Ignore faint pixels when finding the bounds, but keep the soft alpha inside the crop.
    bounds = alpha.point(
        lambda value: 255 if value >= ALPHA_BOUNDS_THRESHOLD else 0
    ).getbbox()
    if bounds is None:
        raise EmptyCutout("No foreground was found.")

    cropped = cutout.crop(bounds)
    padding = round(max(cropped.size) * PADDING_RATIO)
    padded = ImageOps.expand(cropped, border=padding, fill=(0, 0, 0, 0))
    # Match the scale of the seed assets without enlarging smaller sources.
    padded.thumbnail((MAX_OUTPUT_EDGE, MAX_OUTPUT_EDGE), Image.Resampling.LANCZOS)
    output = BytesIO()
    padded.save(output, format="WEBP", lossless=True)
    return output.getvalue()
