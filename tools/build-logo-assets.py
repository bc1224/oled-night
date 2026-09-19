"""Build transparent OLED Night masters, Chrome icons, and a legibility proof."""

from pathlib import Path
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter


def extract_alpha(source: Path) -> Image.Image:
    rgb = Image.open(source).convert("RGB")
    rgba = Image.new("RGBA", rgb.size)
    output = []
    for red, green, blue in rgb.get_flattened_data():
        maximum, minimum = max(red, green, blue), min(red, green, blue)
        mean = (red + green + blue) / 3
        if maximum - minimum > 24:
            alpha = 255
            color = (red, green, blue)
        elif mean >= 226:
            alpha = 0
            color = (0, 0, 0)
        elif mean <= 40:
            alpha = 255
            color = (red, green, blue)
        else:
            alpha = round(255 * (226 - mean) / 186)
            color = tuple(max(0, min(255, round((channel - 226 * (1 - alpha / 255)) / max(alpha / 255, 0.01)))) for channel in (red, green, blue))
        output.append((*color, alpha))
    rgba.putdata(output)
    bounds = rgba.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError("No logo foreground detected")
    left, top, right, bottom = bounds
    margin = 24
    crop = rgba.crop((max(0, left - margin), max(0, top - margin), min(rgb.width, right + margin), min(rgb.height, bottom + margin)))
    square = max(crop.size)
    centered = Image.new("RGBA", (square, square))
    centered.alpha_composite(crop, ((square - crop.width) // 2, (square - crop.height) // 2))
    master = Image.new("RGBA", (1024, 1024))
    mark = centered.resize((896, 896), Image.Resampling.LANCZOS)
    master.alpha_composite(mark, (64, 64))
    return master


def icon_from(master: Image.Image, size: int) -> Image.Image:
    inset = 1 if size <= 32 else 2
    mark = master.resize((size - inset * 2, size - inset * 2), Image.Resampling.LANCZOS)
    icon = Image.new("RGBA", (size, size))
    alpha = mark.getchannel("A")
    radius = 3 if size >= 48 else 1
    expanded = alpha.filter(ImageFilter.MaxFilter(radius * 2 + 1))
    outline = ImageChops.subtract(expanded, alpha)
    stroke = Image.new("RGBA", mark.size, (112, 122, 140, 185))
    stroke.putalpha(outline.point(lambda value: round(value * 0.72)))
    icon.alpha_composite(stroke, (inset, inset))
    icon.alpha_composite(mark, (inset, inset))
    return icon


def preview(icons: dict[int, Image.Image], destination: Path) -> None:
    canvas = Image.new("RGB", (720, 300), "#151519")
    draw = ImageDraw.Draw(canvas)
    draw.text((24, 18), "OLED Night - actual-size Chrome icon proof", fill="#f2f2f5")
    for row, (name, background, foreground) in enumerate((("dark toolbar", "#000000", "#eeeeF2"), ("light toolbar", "#f3f3f5", "#202028"))):
        y = 56 + row * 72
        draw.rounded_rectangle((20, y, 700, y + 54), radius=10, fill=background, outline="#34343c")
        draw.text((34, y + 19), name, fill=foreground)
        x = 190
        for size in (16, 32, 48):
            canvas.paste(icons[size], (x, y + (54 - size) // 2), icons[size])
            draw.text((x + size + 8, y + 19), f"{size}px", fill=foreground)
            x += size + 78
    draw.text((24, 216), "16px nearest-neighbor inspection", fill="#f2f2f5")
    enlarged = icons[16].resize((64, 64), Image.Resampling.NEAREST)
    canvas.paste(enlarged, (250, 208), enlarged)
    canvas.save(destination, optimize=True)


def main() -> None:
    source, extension_root, theme_root, preview_path = map(Path, sys.argv[1:5])
    master = extract_alpha(source)
    icons = {size: icon_from(master, size) for size in (16, 32, 48, 128)}
    for root in (extension_root, theme_root):
        assets = root / "assets"
        assets.mkdir(parents=True, exist_ok=True)
        master.save(assets / "oled-night-logo-master-1024.png", optimize=True)
        for size, icon in icons.items():
            icon.save(assets / f"icon-{size}.png", optimize=True)
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    preview(icons, preview_path)


if __name__ == "__main__":
    main()
