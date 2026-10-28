#!/usr/bin/env python3
"""
Texturen für ErdeMond3D.html aus den NASA-Downloads in textures/src/ erzeugen (Konzept-ErdeMond3D.md).

Benötigt Pillow und NumPy. Aufruf aus dem Projektordner:  python3 prepareTextures3d.py

Downloads (gemeinfrei, NASA):
  Blue Marble Next Generation, Mai 2004, mit Relief und Meeresboden
    https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73701/world.topo.bathy.200405.3x5400x2700.jpg
  Black Marble 2016, 0,1°
    https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg
  Topographie (GEBCO 2008, Landhöhen, Meer = 0)
    https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73934/gebco_08_rev_elev_21600x10800.png
  Mondhöhen LOLA aus dem CGI Moon Kit (16 Pixel/°, Halbmeter, Versatz +10 km)
    https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif

Einzelne Schritte: python3 prepareTextures3d.py moon_normal

Die Mondfarbe (lroc_color_2k.jpg aus dem CGI Moon Kit) liegt schon im Projektordner und wird direkt verwendet.
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None

MOON_RADIUS_M = 1737400
MOON_RELIEF = 3.0         # Überhöhung der Normal-Map (2k glättet Kraterwände stark)

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, 'textures', 'src')
OUT = os.path.join(BASE, 'textures')


def earth_day():
    """Tagseite: Blue Marble auf 4096×2048"""
    im = Image.open(os.path.join(SRC, 'world.topo.bathy.200405.3x5400x2700.jpg')).convert('RGB')
    im.resize((4096, 2048), Image.LANCZOS).save(os.path.join(OUT, 'earth_day_4k.jpg'), quality=88)


def earth_day_small():
    """Tagseite für die datensparende Version (ErdeMond3D.html?klein): 2048×1024"""
    im = Image.open(os.path.join(SRC, 'world.topo.bathy.200405.3x5400x2700.jpg')).convert('RGB')
    im.resize((2048, 1024), Image.LANCZOS).save(os.path.join(OUT, 'earth_day_2k.jpg'), quality=85)


def earth_night():
    """Nachtseite: Black Marble auf 2048×1024"""
    im = Image.open(os.path.join(SRC, 'BlackMarble_2016_01deg.jpg')).convert('RGB')
    im.resize((2048, 1024), Image.LANCZOS).save(os.path.join(OUT, 'earth_night_2k.jpg'), quality=90)


def earth_water():
    """
    Wassermaske 2048×1024 (255 = Wasser). Die Landhöhen sind im Meer 0, aber auch in tiefem Land
    (Niederlande). Deshalb zusätzlich: Wasser ist in Blue Marble viel blauer als rot (auch im sehr
    dunklen Tiefseeblau, daher Verhältnis statt Differenz). Seen über dem Meeresspiegel (Große Seen)
    zählen, wenn sie dunkel und deutlich blau sind.
    """
    size = (2048, 1024)
    elev = Image.open(os.path.join(SRC, 'gebco_08_rev_elev_21600x10800.png')).convert('L')
    # Anteil der Pixel mit Höhe 0 je Zielpixel
    zero = Image.fromarray(((np.asarray(elev) == 0) * 255).astype(np.uint8))
    zero = np.asarray(zero.resize(size, Image.BOX), dtype=np.float32) / 255
    color = np.asarray(Image.open(os.path.join(SRC, 'world.topo.bathy.200405.3x5400x2700.jpg'))
                       .convert('RGB').resize(size, Image.BOX), dtype=np.float32)
    ratio = (color[..., 2] + 2) / (color[..., 0] + 2)
    sea = zero * np.clip((ratio - 1.3) / 0.7, 0, 1)
    lake = np.clip((ratio - 2.0) / 0.5, 0, 1) * (color[..., 2] < 90)
    water = np.maximum(sea, lake)
    water = Image.fromarray((water * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    water.save(os.path.join(OUT, 'earth_water_2k.png'), optimize=True)


def moon_normal():
    """Mond-Normal-Map 2048×1024 aus den LOLA-Höhen (Einzelheiten in make_moon_normal)"""
    make_moon_normal(2048, 90, 'moon_normal_2k.jpg')


def moon_normal_small():
    """Mond-Normal-Map für die datensparende Version (ErdeMond3D.html?klein): 1024×512"""
    make_moon_normal(1024, 88, 'moon_normal_1k.jpg')


def make_moon_normal(w, quality, name):
    """
    Mond-Normal-Map w×w/2 aus den LOLA-Höhen. Kanäle: Ost, Nord, oben (je ·0,5 + 0,5), also
    tangential zur Kugel. Der Abstand in Ost-Richtung schrumpft mit cos(Breite).
    Als JPG ohne Farbunterabtastung (1,2 MB statt 3,8 MB als PNG); der Shader rechnet „oben“ aus Ost
    und Nord neu, das gleicht einen Teil der JPG-Fehler aus.
    """
    h = w // 2
    im = Image.open(os.path.join(SRC, 'ldem_16_uint.tif'))
    heights = np.asarray(im, dtype=np.float32) * 0.5 - 10000           # Meter
    heights = np.asarray(Image.fromarray(heights, mode='F').resize((w, h), Image.BOX), dtype=np.float64)
    lat = (0.5 - (np.arange(h) + 0.5) / h) * np.pi
    dx = 2 * np.pi * MOON_RADIUS_M * np.maximum(np.cos(lat), 0.02) / w  # Meter je Pixel nach Osten
    dy = np.pi * MOON_RADIUS_M / h                                      # Meter je Pixel nach Norden
    # Länge ist ringsum geschlossen, Bildzeilen laufen nach Süden
    east = (np.roll(heights, -1, axis=1) - np.roll(heights, 1, axis=1)) / (2 * dx[:, None])
    north = -np.gradient(heights, axis=0) / dy
    n = np.stack([-MOON_RELIEF * east, -MOON_RELIEF * north, np.ones_like(east)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    rgb = np.clip(np.round((n * 0.5 + 0.5) * 255), 0, 255).astype(np.uint8)
    Image.fromarray(rgb, 'RGB').save(os.path.join(OUT, name), quality=quality, subsampling=0)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    steps = (earth_day, earth_day_small, earth_night, earth_water, moon_normal, moon_normal_small)
    wanted = sys.argv[1:]
    for step in steps:
        if wanted and step.__name__ not in wanted:
            continue
        print(step.__doc__.strip().splitlines()[0])
        step()
    for name in sorted(os.listdir(OUT)):
        path = os.path.join(OUT, name)
        if os.path.isfile(path):
            print(f'  {name}: {os.path.getsize(path) / 1e6:.2f} MB')
