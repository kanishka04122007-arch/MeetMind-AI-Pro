import os
import sys
import glob
import json
import shutil
import hashlib
import logging
from typing import Optional, Tuple, Dict, Any

logger = logging.getLogger("uvicorn.error")

# Ensure UTF-8 output encoding for progress or logs
os.environ["PYTHONIOENCODING"] = "utf-8"

_easyocr_reader = None

POPPLER_KNOWN_DIRS = [
    os.path.join(
        os.environ.get("LOCALAPPDATA", ""),
        r"Microsoft\WinGet\Packages\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\poppler-25.07.0\Library\bin"
    ),
    r"C:\Program Files\poppler\bin",
    r"C:\Program Files (x86)\poppler\bin",
]

def get_poppler_path() -> Optional[str]:
    """
    Locates poppler bin folder on Windows.
    Adds it to PATH if found and returns the directory path.
    """
    if shutil.which("pdftoppm"):
        return None

    # Check known directories
    for p in POPPLER_KNOWN_DIRS:
        if os.path.exists(os.path.join(p, "pdftoppm.exe")):
            if p not in os.environ.get("PATH", ""):
                os.environ["PATH"] = p + os.pathsep + os.environ.get("PATH", "")
            return p

    # Search WinGet Packages dynamically
    appdata = os.environ.get("LOCALAPPDATA", "")
    if appdata:
        winget_pattern = os.path.join(appdata, "Microsoft", "WinGet", "Packages", "*poppler*", "**", "pdftoppm.exe")
        matches = glob.glob(winget_pattern, recursive=True)
        if matches:
            bin_dir = os.path.dirname(matches[0])
            if bin_dir not in os.environ.get("PATH", ""):
                os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")
            return bin_dir

    return None

def get_easyocr_reader():
    """
    Lazily initializes and caches the EasyOCR Reader instance.
    """
    global _easyocr_reader
    if _easyocr_reader is None:
        import easyocr
        import torch
        use_gpu = torch.cuda.is_available()
        logger.info(f"Initializing EasyOCR Reader (gpu={use_gpu})...")
        _easyocr_reader = easyocr.Reader(['en'], gpu=use_gpu, verbose=False)
        logger.info("EasyOCR Reader ready.")
    return _easyocr_reader

def compute_file_sha256(file_path: str) -> str:
    """
    Computes SHA-256 hash of a file for caching.
    """
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def get_cache_dir() -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cache_dir = os.path.join(base_dir, "uploads", "cache")
    os.makedirs(cache_dir, exist_ok=True)
    return cache_dir

def get_cached_ocr(file_hash: str) -> Optional[Dict[str, Any]]:
    cache_file = os.path.join(get_cache_dir(), f"ocr_cache_{file_hash}.json")
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("text") and len(data["text"].strip()) > 0 and not is_placeholder_text(data["text"]):
                    return data
        except Exception as e:
            logger.warning(f"Error reading OCR cache file: {e}")
    return None

def save_cached_ocr(file_hash: str, text: str, page_count: int, word_count: int, char_count: int):
    cache_file = os.path.join(get_cache_dir(), f"ocr_cache_{file_hash}.json")
    try:
        data = {
            "text": text,
            "page_count": page_count,
            "word_count": word_count,
            "char_count": char_count,
            "extracted_at": json.dumps(os.path.getmtime(cache_file) if os.path.exists(cache_file) else 0)
        }
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"Error writing OCR cache file: {e}")

def is_placeholder_text(text: Optional[str]) -> bool:
    """
    Checks if the given text matches the old placeholder pattern.
    """
    if not text or len(text.strip()) == 0:
        return True
    t_lower = text.lower()
    placeholders = [
        "scanned document",
        "visual materials indexed",
        "document overview",
        "[extracted document overview]"
    ]
    for ph in placeholders:
        if ph in t_lower:
            return True
    return False

def extract_ocr_from_pdf(
    file_path: str,
    max_pages: Optional[int] = None
) -> Tuple[str, int, int, int]:
    """
    Extracts text from a scanned PDF using pdf2image and EasyOCR.
    Converts every PDF page to image, runs EasyOCR on all pages,
    combines text from all pages, and caches the result.
    """
    import numpy as np
    import pdf2image

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    file_hash = compute_file_sha256(file_path)

    # 1. Check local OCR cache
    cached = get_cached_ocr(file_hash)
    if cached:
        logger.info(f"Loaded OCR result from cache for {os.path.basename(file_path)} (hash: {file_hash[:8]})")
        return (
            cached["text"],
            cached["page_count"],
            cached["word_count"],
            cached["char_count"]
        )

    poppler_dir = get_poppler_path()

    # 2. Convert every PDF page to image with pdf2image
    logger.info(f"Converting PDF pages to images using pdf2image: {file_path}")
    try:
        images = pdf2image.convert_from_path(
            file_path,
            poppler_path=poppler_dir,
            dpi=72  # 72 dpi provides high OCR accuracy and speed
        )
    except Exception as e:
        logger.error(f"Failed to convert PDF to images: {e}")
        raise RuntimeError(f"pdf2image conversion failed: {e}")

    total_pages = len(images)
    logger.info(f"Converted {total_pages} page(s) to images successfully.")

    if max_pages and max_pages > 0:
        images_to_process = images[:max_pages]
    else:
        images_to_process = images

    # 3. Extract text using EasyOCR for every page
    reader = get_easyocr_reader()
    page_texts = []

    for i, img in enumerate(images_to_process, start=1):
        try:
            arr = np.array(img)
            # Use paragraph=True and batch_size=8 for clean paragraph grouping and speed
            res = reader.readtext(arr, detail=0, paragraph=True, batch_size=8)
            clean_page = "\n".join(res).strip()
            if clean_page:
                page_texts.append(clean_page)
            logger.info(f"OCR processed page {i}/{len(images_to_process)} ({len(clean_page)} chars)")
        except Exception as e:
            logger.warning(f"Error processing page {i} with EasyOCR: {e}")

    # 4. Combine text from all pages
    combined_text = "\n\n".join(page_texts).strip()

    word_count = len(combined_text.split()) if combined_text else 0
    char_count = len(combined_text)

    # 5. Cache result
    save_cached_ocr(file_hash, combined_text, total_pages, word_count, char_count)

    return combined_text, total_pages, word_count, char_count
