ACADEMY_MEDIA_FILE_LIMIT = 100 * 1024 * 1024

ALLOWED_MEDIA_MIMES = {
    "image/jpeg", "image/png", "image/webp",
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm",
    "video/mp4", "video/webm",
    "text/vtt", "application/pdf",
}


def validate_academy_media_file(mime_type, leading_bytes, size):
    if mime_type not in ALLOWED_MEDIA_MIMES:
        raise ValueError("Choose a supported image, audio, video, caption, or PDF file.")
    if not isinstance(size, int) or size < 1 or size > ACADEMY_MEDIA_FILE_LIMIT:
        raise ValueError("Academy media files must be between 1 byte and 100 MB.")
    signatures = {
        "image/jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
        "image/png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP",
        "audio/mpeg": lambda data: data.startswith(b"ID3") or (len(data) > 1 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0),
        "audio/wav": lambda data: data.startswith(b"RIFF") and data[8:12] == b"WAVE",
        "audio/ogg": lambda data: data.startswith(b"OggS"),
        "audio/mp4": _is_mp4,
        "audio/webm": lambda data: data.startswith(b"\x1a\x45\xdf\xa3"),
        "video/mp4": _is_mp4,
        "video/webm": lambda data: data.startswith(b"\x1a\x45\xdf\xa3"),
        "text/vtt": lambda data: data.lstrip(b"\xef\xbb\xbf \t\r\n").startswith(b"WEBVTT"),
        "application/pdf": lambda data: data.startswith(b"%PDF-"),
    }
    if not signatures[mime_type](leading_bytes):
        raise ValueError("The file contents do not match the selected media type.")
    return mime_type


def parse_byte_range(header, length):
    if not header:
        return None
    if not isinstance(length, int) or length < 1 or not header.startswith("bytes=") or "," in header:
        raise ValueError("Unsupported byte range.")
    start_text, separator, end_text = header[6:].partition("-")
    if not separator or (not start_text and not end_text):
        raise ValueError("Unsupported byte range.")
    try:
        if not start_text:
            suffix = int(end_text)
            if suffix < 1:
                raise ValueError
            start, end = max(0, length - suffix), length - 1
        else:
            start = int(start_text)
            end = int(end_text) if end_text else length - 1
            if start < 0 or start >= length or end < start:
                raise ValueError
            end = min(end, length - 1)
    except (TypeError, ValueError):
        raise ValueError("Unsupported byte range.") from None
    return start, end


def _is_mp4(data):
    return len(data) >= 12 and data[4:8] == b"ftyp"
