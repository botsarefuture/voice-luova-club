import unittest

from academy_media_files import ACADEMY_MEDIA_FILE_LIMIT, parse_byte_range, validate_academy_media_file


class AcademyMediaFileTests(unittest.TestCase):
    def test_accepts_supported_file_signatures(self):
        self.assertEqual(validate_academy_media_file("image/jpeg", b"\xff\xd8\xff\xe0", 4), "image/jpeg")
        self.assertEqual(validate_academy_media_file("image/png", b"\x89PNG\r\n\x1a\n", 8), "image/png")
        self.assertEqual(validate_academy_media_file("video/mp4", b"\x00\x00\x00\x18ftypisom", 12), "video/mp4")
        self.assertEqual(validate_academy_media_file("text/vtt", b"WEBVTT\n\n", 8), "text/vtt")

    def test_rejects_unsupported_mime_or_mismatched_contents(self):
        with self.assertRaisesRegex(ValueError, "supported"):
            validate_academy_media_file("image/svg+xml", b"<svg", 4)
        with self.assertRaisesRegex(ValueError, "do not match"):
            validate_academy_media_file("image/jpeg", b"not a jpeg", 10)

    def test_rejects_empty_and_oversized_files(self):
        with self.assertRaisesRegex(ValueError, "between"):
            validate_academy_media_file("image/jpeg", b"\xff\xd8\xff", 0)
        with self.assertRaisesRegex(ValueError, "between"):
            validate_academy_media_file("image/jpeg", b"\xff\xd8\xff", ACADEMY_MEDIA_FILE_LIMIT + 1)

    def test_byte_ranges_support_seeking_and_suffix_requests(self):
        self.assertEqual(parse_byte_range(None, 100), None)
        self.assertEqual(parse_byte_range("bytes=10-19", 100), (10, 19))
        self.assertEqual(parse_byte_range("bytes=90-", 100), (90, 99))
        self.assertEqual(parse_byte_range("bytes=-10", 100), (90, 99))
        with self.assertRaises(ValueError):
            parse_byte_range("bytes=100-101", 100)
        with self.assertRaises(ValueError):
            parse_byte_range("bytes=0-1,5-6", 100)
