#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""优化网格：对称地从边缘移除多余格子"""
from collections import Counter
import numpy as np
from PIL import Image

LEGEND = {
    "A22": ["#fff280", 268],
    "E15": ["#ffccd5", 12],
    "H2":  ["#feffff", 396],
    "H7":  ["#000000", 224],
}
CODEMAP = {"A": "A22", "E": "E15", "2": "H2", "7": "H7", ".": None}
REV = {v: k for k, v in CODEMAP.items() if v}

def build_row(segments):
    row = ['.'] * 40
    for s, e, code in segments:
        ch = REV[code]
        for c in range(s, e + 1):
            if 1 <= c <= 40:
                row[c - 1] = ch
    return ''.join(row)

ROWS_SEG = [
    [],  # 1
    [(20, 25, "H7")],  # 2
    [(18, 19, "H7"), (20, 25, "H2"), (26, 27, "H7")],  # 3
    [(15, 18, "H7"), (19, 30, "H2"), (31, 32, "H7")],  # 4
    [(13, 14, "H7"), (15, 28, "H2"), (29, 30, "H7")],  # 5
    [(11, 11, "H7"), (12, 29, "H2"), (30, 32, "H7")],  # 6
    [(10, 10, "H7"), (11, 30, "H2"), (31, 33, "H7")],  # 7
    [(9, 9, "H7"), (10, 14, "H2"), (15, 15, "H7"), (16, 29, "H2"),
     (30, 31, "H7"), (32, 33, "A22"), (34, 34, "H7")],  # 8
    [(9, 9, "H7"), (10, 13, "H2"), (14, 14, "H7"), (15, 28, "H2"),
     (29, 30, "H7"), (31, 32, "A22"), (33, 33, "H7")],  # 9
    [(9, 9, "H7"), (10, 12, "H2"), (13, 14, "H7"), (15, 17, "E15"),
     (18, 18, "H2"), (19, 19, "H7"), (20, 28, "H2"), (29, 29, "H7"),
     (30, 32, "A22"), (33, 33, "H7")],  # 10
    [(7, 8, "H7"), (9, 9, "A22"), (10, 11, "H7"), (12, 13, "H2"),
     (14, 16, "E15"), (17, 19, "H2"), (20, 20, "H7"), (21, 21, "H2"),
     (22, 22, "H7"), (23, 28, "H2"), (29, 29, "H7"), (30, 31, "A22"),
     (32, 32, "H7")],  # 11
    [(7, 7, "H7"), (8, 9, "A22"), (10, 10, "H7"), (11, 28, "H2"),
     (29, 29, "H7"), (30, 31, "A22"), (32, 32, "H7")],  # 12
    [(5, 7, "H7"), (8, 10, "A22"), (11, 22, "H2"), (23, 25, "E15"),
     (26, 29, "H2"), (30, 31, "H7"), (32, 33, "A22"), (34, 34, "H7")],  # 13
    [(3, 4, "H7"), (5, 6, "A22"), (7, 17, "H7"), (18, 23, "H2"),
     (24, 26, "E15"), (27, 28, "H2"), (29, 29, "H7"), (30, 33, "H2"),
     (34, 35, "H7"), (36, 37, "A22"), (38, 38, "H7")],  # 14
    [(2, 3, "H7"), (4, 5, "A22"), (6, 6, "H2"), (7, 8, "H7"),
     (9, 16, "H2"), (17, 18, "H7"), (19, 26, "H2"), (27, 27, "H7"),
     (28, 34, "H2"), (35, 36, "H7"), (37, 38, "A22"), (39, 39, "H7")],  # 15
    [(2, 2, "H7"), (3, 4, "A22"), (5, 5, "H7"), (6, 7, "H2"), (8, 8, "H7"),
     (9, 18, "H2"), (19, 20, "H7"), (21, 28, "H2"), (29, 29, "H7"),
     (30, 36, "H2"), (37, 37, "H7"), (38, 40, "A22")],  # 16
    [(1, 1, "H7"), (2, 5, "A22"), (6, 8, "H7"), (9, 22, "H2"),
     (23, 23, "H7"), (24, 30, "H2"), (31, 31, "H7"), (32, 38, "H2"),
     (39, 39, "H7"), (40, 40, "A22")],  # 17
    [(1, 1, "H7"), (2, 6, "A22"), (7, 9, "H7"), (10, 27, "H2"),
     (28, 34, "H7"), (35, 36, "A22"), (37, 37, "H7"), (38, 40, "A22")],  # 18
    [(1, 1, "H7"), (2, 4, "A22"), (5, 5, "H7"), (6, 28, "H2"),
     (29, 29, "H7"), (30, 35, "A22"), (36, 37, "H7"), (38, 40, "A22")],  # 19
    [(1, 1, "H7"), (2, 4, "A22"), (5, 5, "H7"), (6, 29, "H2"),
     (30, 30, "H7"), (31, 36, "A22"), (37, 38, "H7"), (39, 40, "A22")],  # 20
    [(1, 1, "H7"), (2, 4, "A22"), (5, 5, "H7"), (6, 8, "H2"),
     (9, 10, "H7"), (11, 11, "H2"), (12, 16, "H7"), (17, 28, "H2"),
     (29, 29, "H7"), (30, 38, "A22"), (39, 39, "H7")],  # 21
    [(1, 1, "H7"), (2, 4, "A22"), (5, 5, "H7"), (6, 8, "H2"),
     (9, 10, "H7"), (11, 11, "H2"), (12, 13, "H7"), (14, 19, "H2"),
     (20, 20, "H7"), (21, 28, "H2"), (29, 29, "H7"), (30, 38, "A22"),
     (39, 39, "H7")],  # 22
    [(1, 1, "H7"), (2, 4, "A22"), (5, 5, "H7"), (6, 10, "H2"),
     (11, 11, "H7"), (12, 19, "H2"), (20, 20, "H7"), (21, 22, "H2"),
     (23, 24, "H7"), (25, 29, "H2"), (30, 30, "H7"), (31, 38, "A22"),
     (39, 39, "H7")],  # 23
    [(1, 1, "H7"), (2, 5, "A22"), (6, 6, "H7"), (7, 12, "H2"),
     (13, 13, "H7"), (14, 14, "H2"), (15, 16, "H7"), (17, 22, "H2"),
     (23, 24, "H7"), (25, 25, "H2"), (26, 27, "H7"), (28, 30, "A22"),
     (31, 33, "H7"), (34, 38, "A22"), (39, 39, "H7")],  # 24
    [(1, 1, "H7"), (2, 6, "A22"), (7, 14, "H7"), (15, 15, "H2"),
     (16, 17, "H7"), (18, 24, "H2"), (25, 25, "H7"), (26, 38, "A22"),
     (39, 39, "H7")],  # 25
    [(1, 1, "H7"), (2, 8, "A22"), (9, 10, "H7"), (11, 12, "H2"),
     (13, 13, "H7"), (14, 19, "H2"), (20, 20, "H7"), (21, 27, "H7"),
     (28, 38, "A22"), (39, 39, "H7")],  # 26
    [(1, 1, "H7"), (2, 9, "A22"), (10, 16, "H7"), (17, 25, "A22"),
     (26, 26, "H7"), (27, 38, "A22"), (39, 39, "H7")],  # 27
    [(1, 1, "H7"), (2, 14, "A22"), (15, 17, "H7"), (18, 38, "A22"),
     (39, 39, "H7")],  # 28
    [(1, 2, "H7"), (3, 38, "A22"), (39, 39, "H7")],  # 29
    [(1, 3, "H7"), (4, 37, "A22"), (38, 39, "H7")],  # 30
    [(1, 2, "H7"), (3, 38, "A22"), (39, 39, "H7")],  # 31
    [(1, 1, "H7"), (2, 39, "A22"), (40, 40, "H7")],  # 32
    [(18, 26, "H7")],  # 33
]

def main():
    grid = [list(build_row(segs)) for segs in ROWS_SEG]

    def count():
        cnt = Counter()
        for r in range(33):
            for c in range(40):
                code = CODEMAP[grid[r][c]]
                if code:
                    cnt[code] += 1
        return cnt

    target = {"A22": 268, "E15": 12, "H2": 396, "H7": 224}
    cnt = count()
    print("Before:")
    for code in ["H2", "A22", "H7", "E15"]:
        print(f"  {code}: {cnt[code]} (target {target[code]}, diff {cnt[code]-target[code]:+d})")

    # Remove from BOTH edges, alternating, only for rows 17-32 (body/dress area)
    for code, n_remove in [(CODEMAP[grid[r][c]], 0) for r in range(33) for c in range(40) if CODEMAP[grid[r][c]]]:
        pass

    to_remove = {}
    for code in target:
        diff = cnt[code] - target[code]
        if diff > 0:
            to_remove[code] = diff

    # Remove from edges of body area (rows 17-32), alternating left/right
    for code, n_remove in to_remove.items():
        ch = REV[code]
        removed = 0
        # Body rows: 17-32 (0-indexed: 16-31)
        body_rows = list(range(16, 32))
        side = 0  # 0=right, 1=left
        while removed < n_remove:
            progress = False
            for r in body_rows:
                if removed >= n_remove:
                    break
                filled = [c for c in range(40) if grid[r][c] == ch]
                if not filled:
                    continue
                if side == 0:
                    # Remove rightmost
                    c = filled[-1]
                else:
                    # Remove leftmost
                    c = filled[0]
                grid[r][c] = '.'
                removed += 1
                progress = True
            side = 1 - side
            if not progress:
                break
        print(f"  Removed {removed} {code}")

    cnt = count()
    print("\nAfter:")
    ok = True
    total = 0
    for code in ["H2", "A22", "H7", "E15"]:
        got = cnt[code]
        exp = target[code]
        s = "OK" if got == exp else "XX"
        if got != exp:
            ok = False
        total += got
        print(f"  {code}: {got} (target {exp}, diff {got-exp:+d}) {s}")
    print(f"  TOTAL: {total}")

    print()
    for i, r in enumerate(grid, 1):
        print(f"{i:2d}: {''.join(r)}")

    # Save
    HEX = {k: v[0] for k, v in LEGEND.items()}
    def hex2rgb(h):
        h = h.lstrip('#')
        return [int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)]
    S = 20
    g = np.full((33 * S, 40 * S, 3), 240, dtype=np.uint8)
    for r in range(33):
        for c in range(40):
            code = CODEMAP[grid[r][c]]
            if code:
                g[r*S:(r+1)*S, c*S:(c+1)*S] = hex2rgb(HEX[code])
    Image.fromarray(g).save('/workspace/grid_preview.png')

    # Save grid text
    with open('/workspace/grid_final.txt', 'w') as f:
        for r in grid:
            f.write(''.join(r) + '\n')

if __name__ == "__main__":
    main()
