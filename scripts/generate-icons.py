"""
Generate Luna Travel PWA icons.
- icon-192.png       : standard 192x192
- icon-512.png       : standard 512x512
- icon-maskable-512.png : 512x512 with safe-zone padding for Android adaptive icons
- favicon.ico        : multi-size favicon
- apple-touch.png    : 180x180 for iOS home-screen
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
import math

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(OUT, exist_ok=True)


def radial_gradient(size, center, inner, outer, inner_color, outer_color):
    """Paint a radial gradient onto an RGBA image."""
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    px = img.load()
    cx, cy = center
    for y in range(size[1]):
        for x in range(size[0]):
            d = math.hypot(x - cx, y - cy)
            if d <= inner:
                t = 0
            elif d >= outer:
                t = 1
            else:
                t = (d - inner) / (outer - inner)
            r = int(inner_color[0] * (1 - t) + outer_color[0] * t)
            g = int(inner_color[1] * (1 - t) + outer_color[1] * t)
            b = int(inner_color[2] * (1 - t) + outer_color[2] * t)
            a = int(inner_color[3] * (1 - t) + outer_color[3] * t)
            px[x, y] = (r, g, b, a)
    return img


def linear_gradient(size, start_color, end_color):
    """Diagonal linear gradient top-left -> bottom-right."""
    img = Image.new('RGB', size, start_color)
    px = img.load()
    w, h = size
    for y in range(h):
        for x in range(w):
            t = (x + y) / (w + h - 2)
            r = int(start_color[0] * (1 - t) + end_color[0] * t)
            g = int(start_color[1] * (1 - t) + end_color[1] * t)
            b = int(start_color[2] * (1 - t) + end_color[2] * t)
            px[x, y] = (r, g, b)
    return img


def rounded_mask(size, radius):
    """Square rounded mask."""
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return m


def make_icon(size, padding_ratio=0.0):
    """
    Build the Luna Travel icon at `size`x`size`.
    `padding_ratio` shrinks the design inside a transparent canvas for maskable icons.
    """
    full = size
    inner_size = int(full * (1 - 2 * padding_ratio))
    offset = (full - inner_size) // 2

    # Final transparent canvas
    canvas = Image.new('RGBA', (full, full), (0, 0, 0, 0))

    # Background: navy -> teal gradient
    bg = linear_gradient((inner_size, inner_size), (27, 43, 91), (0, 180, 216))

    # Teal glow in top-right
    glow = radial_gradient(
        (inner_size, inner_size),
        (int(inner_size * 0.72), int(inner_size * 0.28)),
        0,
        int(inner_size * 0.55),
        (72, 202, 228, 130),
        (72, 202, 228, 0),
    )
    bg = bg.convert('RGBA')
    bg.alpha_composite(glow)

    # Rounded mask for app-icon look (only for non-maskable; maskable is square)
    if padding_ratio == 0:
        radius = int(inner_size * 0.22)
        bg.putalpha(rounded_mask((inner_size, inner_size), radius))

    # Text: "LT" wordmark
    try:
        # Try common system font paths
        for candidate in [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
            '/System/Library/Fonts/Helvetica.ttc',
        ]:
            if os.path.exists(candidate):
                font_path = candidate
                break
        else:
            font_path = None
        font_size = int(inner_size * 0.48)
        font = ImageFont.truetype(font_path, font_size) if font_path else ImageFont.load_default()
    except Exception:
        font = ImageFont.load_default()

    overlay = Image.new('RGBA', (inner_size, inner_size), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    text = 'LT'
    try:
        bbox = od.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = (inner_size - tw) // 2 - bbox[0]
        ty = (inner_size - th) // 2 - bbox[1]
    except AttributeError:
        tw, th = od.textsize(text, font=font)
        tx = (inner_size - tw) // 2
        ty = (inner_size - th) // 2

    # Subtle shadow under the text
    shadow = Image.new('RGBA', (inner_size, inner_size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.text((tx + int(inner_size * 0.01), ty + int(inner_size * 0.02)), text, font=font, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=int(inner_size * 0.02)))
    bg = Image.alpha_composite(bg, shadow)

    od.text((tx, ty), text, font=font, fill=(255, 255, 255, 255))
    bg = Image.alpha_composite(bg, overlay)

    canvas.paste(bg, (offset, offset), bg)
    return canvas


def main():
    # Standard icons
    for size in (192, 512):
        ic = make_icon(size)
        ic.save(os.path.join(OUT, f'icon-{size}.png'))
        print(f'wrote icon-{size}.png')

    # Maskable (with 10% safe padding all round → 80% inner content)
    mask = make_icon(512, padding_ratio=0.1)
    mask.save(os.path.join(OUT, 'icon-maskable-512.png'))
    print('wrote icon-maskable-512.png')

    # Apple touch icon (180x180)
    apple = make_icon(180)
    apple.save(os.path.join(OUT, 'apple-touch-icon.png'))
    print('wrote apple-touch-icon.png')

    # Favicon (multi-size .ico)
    fav = make_icon(64)
    fav.save(os.path.join(OUT, 'favicon.ico'), format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print('wrote favicon.ico')


if __name__ == '__main__':
    main()
