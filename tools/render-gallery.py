#!/usr/bin/env python3
"""Render the deterministic 18-theme README gallery from bundled theme assets."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
THEMES_ROOT = ROOT / "plugins" / "codex-theme-studio" / "themes"
OUTPUT = ROOT / "docs" / "images" / "gallery.jpg"

# Product order is intentional: the featured licensed theme leads, followed by character themes,
# the rest of the 万妖 series, and finally the quieter environment presets.
THEME_ORDER = (
    "wan-yao-longyuan-lingji",
    "fortune-guardian",
    "moonlit-erlang",
    "dawn-monkey-king",
    "lotus-fire-nezha",
    "star-river-spirit",
    "clockwork-fox-spirit",
    "wan-yao-liuli-lianmeng",
    "wan-yao-yuelun-xuanjun",
    "wan-yao-jinye-yaohuang",
    "wan-yao-yuepu-sanji",
    "wan-yao-chimen-tiannu",
    "aurora-glass",
    "cyber-changan",
    "quantum-core",
    "cosmic-taixu",
    "obsidian-gold",
    "verdant-sanctuary",
)

CANVAS = (1600, 760)
CARD = (235, 146)
CARD_X = (52, 302, 552, 802, 1052, 1302)
CARD_Y = (152, 318, 484)
BACKGROUND = "#05110F"
TEXT = "#F4F7F6"
MUTED = "#92A5A0"
ACCENT = "#72D6C9"


def font(size: int, *, latin: bool = False) -> ImageFont.FreeTypeFont:
    """Load bundled macOS fonts that cover exact Chinese and Latin gallery labels."""

    path = "/System/Library/Fonts/SFNS.ttf" if latin else "/System/Library/Fonts/Hiragino Sans GB.ttc"
    return ImageFont.truetype(path, size=size)


def theme_metadata(theme_id: str) -> tuple[dict, Path]:
    """Read one bundled manifest and resolve its validated local image path."""

    directory = THEMES_ROOT / theme_id
    manifest = json.loads((directory / "theme.json").read_text(encoding="utf-8"))
    image_path = directory / manifest["image"]
    if not image_path.is_file():
        raise FileNotFoundError(f"Missing bundled image for {theme_id}: {image_path}")
    return manifest, image_path


def cover(source: Image.Image, manifest: dict) -> Image.Image:
    """Crop a background into a card while preserving the theme's declared focal point."""

    width, height = CARD
    scale = max(width / source.width, height / source.height)
    resized = source.resize(
        (round(source.width * scale), round(source.height * scale)),
        Image.Resampling.LANCZOS,
    )
    focus_x = float(manifest.get("art", {}).get("focusX", 0.78))
    focus_y = float(manifest.get("art", {}).get("focusY", 0.5))
    left = round((resized.width - width) * focus_x)
    top = round((resized.height - height) * focus_y)
    left = max(0, min(left, resized.width - width))
    top = max(0, min(top, resized.height - height))
    return resized.crop((left, top, left + width, top + height)).convert("RGBA")


def add_label_gradient(card: Image.Image) -> None:
    """Keep exact theme labels readable without flattening the artwork above them."""

    overlay = Image.new("RGBA", CARD, (0, 0, 0, 0))
    pixels = overlay.load()
    start = CARD[1] - 62
    for y in range(start, CARD[1]):
        alpha = round(30 + 190 * ((y - start) / (CARD[1] - start)))
        for x in range(CARD[0]):
            pixels[x, y] = (2, 8, 8, alpha)
    card.alpha_composite(overlay)


def render() -> None:
    """Render the complete README gallery with exact names and a compact editorial layout."""

    canvas = Image.new("RGB", CANVAS, BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    title_font = font(40)
    brand_font = font(23, latin=True)
    label_font = font(16)
    slug_font = font(10, latin=True)
    meta_font = font(16)
    number_font = font(10, latin=True)

    draw.text((64, 47), "C", font=brand_font, fill=ACCENT)
    draw.text((106, 48), "Theme Studio for Codex", font=brand_font, fill=TEXT)
    draw.text((64, 89), "十八种氛围，一个专注空间", font=title_font, fill=TEXT)
    draw.text((1130, 111), "18 THEMES  ·  macOS  ·  MIT", font=meta_font, fill=MUTED)

    for index, theme_id in enumerate(THEME_ORDER):
        manifest, image_path = theme_metadata(theme_id)
        x = CARD_X[index % 6]
        y = CARD_Y[index // 6]
        with Image.open(image_path) as source:
            card = cover(source.convert("RGB"), manifest)
        add_label_gradient(card)

        mask = Image.new("L", CARD, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, CARD[0] - 1, CARD[1] - 1), radius=14, fill=255)
        canvas.paste(card.convert("RGB"), (x, y), mask)
        draw.rounded_rectangle(
            (x, y, x + CARD[0] - 1, y + CARD[1] - 1),
            radius=14,
            outline=(218, 232, 227),
            width=1,
        )
        draw.text((x + 12, y + 103), manifest["name"], font=label_font, fill=TEXT)
        draw.text((x + 12, y + 128), theme_id, font=slug_font, fill=(158, 177, 171))
        draw.text((x + CARD[0] - 27, y + 10), f"{index + 1:02d}", font=number_font, fill=(220, 231, 227))

    draw.text((64, 704), "一张图，换一种 Codex 工作氛围", font=meta_font, fill=MUTED)
    draw.text((1330, 704), "v0.1.0", font=meta_font, fill=MUTED)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT, "JPEG", quality=92, optimize=True, progressive=True)
    print(f"Rendered {OUTPUT.relative_to(ROOT)} ({CANVAS[0]}x{CANVAS[1]})")


if __name__ == "__main__":
    render()
