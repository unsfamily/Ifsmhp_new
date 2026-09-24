# Chat transfer fixtures

Small local fixtures contain no production files or personal data. PNG/JPEG/WebP were generated with Sharp, TXT/CSV contain sample text, DOC was generated from the TXT with macOS textutil, and PDF is a minimal paged document with a Helvetica text stream. DOCX/XLSX/PPTX are minimal ZIP packages with content types, package relationships and an appropriate main XML part.

`sample.ppt` is Apache POI's unmodified public `basic_test_ppt_file.ppt` test presentation, downloaded from https://raw.githubusercontent.com/apache/poi/trunk/test-data/slideshow/basic_test_ppt_file.ppt on 2026-09-24. The upstream license and notice are retained as `APACHE-POI-LICENSE` and `APACHE-POI-NOTICE` (from the repository's `legal` directory). It is test data only, never served as application content outside isolated tests.

These tests verify file transfer and byte preservation. In-app previews are limited to PDF and the supported image types; native Office rendering is outside this workflow.
