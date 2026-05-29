from PIL import Image, ImageDraw

ICON_DIR = r"D:\homework\dazhaohu\miniprogram\images"
SIZE = 48

icons = [
    ("tab-home.png", (150, 150, 150)),
    ("tab-home-active.png", (79, 70, 229)),
    ("tab-profile.png", (150, 150, 150)),
    ("tab-profile-active.png", (79, 70, 229)),
]

for name, color in icons:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if "home" in name:
        d.rectangle([12, 18, 36, 44], fill=color + (255,))
        d.polygon([(24, 6), (8, 18), (40, 18)], fill=color + (255,))
    else:
        d.ellipse([14, 6, 34, 26], fill=color + (255,))
        d.ellipse([8, 30, 40, 48], fill=color + (255,))

    path = ICON_DIR + "\\" + name
    img.save(path)
    print(f"Created: {path}")

print("Done - 4 icons generated")
