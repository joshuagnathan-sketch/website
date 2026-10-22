"""Prepare every photo in /images for the website: turn it the right way up,
shrink it to web size, and stamp the copyright watermark.

Runs automatically on GitHub (see .github/workflows/watermark.yml) whenever
photos are uploaded or a photo is listed under "Fix a sideways photo" in /admin.

A clean, unstamped copy of each upload is kept in /originals, so a photo can be
re-turned (or the watermark changed) without stamping it twice. The website
never serves /originals (see functions/_middleware.js).
"""
import hashlib
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

TEXT = "© JGN Photography"
VERSION = 2          # bump to re-render every photo (e.g. after changing TEXT)
MAX_SIDE = 2400      # longest side on the website, in pixels
EXTS = (".jpg", ".jpeg", ".png", ".webp")
TURNS = {"clockwise": 270, "counterclockwise": 90, "upside-down": 180}
FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # GitHub's servers
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",     # Mac, for previews
]


def font(size):
    for path in FONTS:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def stamp(img):
    img = img.convert("RGBA")
    w, h = img.size
    f = font(max(14, round(min(w, h) * 0.032)))
    margin = round(min(w, h) * 0.03)
    box = ImageDraw.Draw(img).textbbox((0, 0), TEXT, font=f)
    x = w - margin - (box[2] - box[0]) - box[0]
    y = h - margin - (box[3] - box[1]) - box[1]

    # A soft shadow keeps the white text readable on bright skies.
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).text((x, y), TEXT, font=f, fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(1, f.size // 12)))
    text = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(text).text((x, y), TEXT, font=f, fill=(255, 255, 255, 170))
    return Image.alpha_composite(Image.alpha_composite(img, shadow), text)


def render(src, turn):
    with Image.open(src) as img:
        img = ImageOps.exif_transpose(img)
        if TURNS.get(turn):
            img = img.rotate(TURNS[turn], expand=True)
        img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        return stamp(img)


def save(img, path):
    ext = path.lower().rsplit(".", 1)[-1]
    if ext == "png":
        img.save(path, optimize=True)
    elif ext == "webp":
        img.convert("RGB").save(path, quality=86, method=6)
    else:
        img.convert("RGB").save(path, quality=88, optimize=True, progressive=True)


def digest(path):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def main(root="."):
    images = os.path.join(root, "images")
    originals = os.path.join(root, "originals")
    state_path = os.path.join(root, ".github", "watermarked.json")
    os.makedirs(originals, exist_ok=True)
    state = load_json(state_path, {})

    turns = {}
    for fix in load_json(os.path.join(root, "content", "fixes.json"), {}).get("fixes", []) or []:
        if fix and fix.get("photo"):
            turns[os.path.basename(fix["photo"])] = fix.get("turn") or "none"

    changed = 0
    for name in sorted(os.listdir(images)):
        if not name.lower().endswith(EXTS):
            continue
        path, master = os.path.join(images, name), os.path.join(originals, name)
        known = state.get(name)
        # A file we didn't produce is a fresh upload: keep it as the clean original.
        if not known or known.get("output") != digest(path) or not os.path.exists(master):
            if not known or known.get("output") != digest(path):
                with open(path, "rb") as a, open(master, "wb") as b:
                    b.write(a.read())
            known = None
        want = {"turn": turns.get(name, "none"), "version": VERSION}
        if known and {k: known.get(k) for k in want} == want:
            continue
        save(render(master, want["turn"]), path)
        state[name] = dict(want, output=digest(path))
        changed += 1
        print("Prepared", name, "(turned " + want["turn"] + ")" if want["turn"] != "none" else "")

    # Forget photos that were deleted from /images.
    for name in list(state):
        if not os.path.exists(os.path.join(images, name)):
            state.pop(name)
            if os.path.exists(os.path.join(originals, name)):
                os.remove(os.path.join(originals, name))
    with open(state_path, "w", encoding="utf-8") as fh:
        json.dump(state, fh, indent=1, sort_keys=True)
        fh.write("\n")
    print(changed and f"{changed} photo(s) updated." or "Nothing to do.")


if __name__ == "__main__":
    main(*sys.argv[1:])
