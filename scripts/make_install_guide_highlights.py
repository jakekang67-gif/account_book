"""
원본 → 핵심 영역 크롭 → 크롭 좌표계로 분홍 박스 그리기.
(전체 화면에서 박스를 그린 뒤 자르면 위치가 어긋나 보이기 쉬움)
"""

from __future__ import annotations

import os

from PIL import Image, ImageDraw

RAW = r"c:\Users\바로에코\Desktop\account_book\public\install-guide\raw"
OUT = r"c:\Users\바로에코\Desktop\account_book\public\install-guide"

# 모든 단계 동일 스타일
PINK = (255, 45, 120, 255)
FILL = (255, 45, 120, 48)
STROKE = 8
RADIUS = 18


def draw_hl(
    cropped: Image.Image, box: tuple[int, int, int, int]
) -> Image.Image:
    base = cropped.convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    x0, y0, x1, y1 = box
    # 안전 클램프
    x0 = max(2, min(x0, base.width - 3))
    y0 = max(2, min(y0, base.height - 3))
    x1 = max(x0 + 10, min(x1, base.width - 2))
    y1 = max(y0 + 10, min(y1, base.height - 2))
    d.rounded_rectangle(
        (x0, y0, x1, y1),
        radius=RADIUS,
        fill=FILL,
        outline=PINK,
        width=STROKE,
    )
    return Image.alpha_composite(base, overlay).convert("RGB")


# src, dest, crop(절대 LTRB), highlight(크롭 상대 LTRB)
# highlight 좌표는 원본 픽셀 검출(파란 글자/흰/아이콘) 기준으로 맞춤.
JOBS: list[
    tuple[str, str, tuple[int, int, int, int], tuple[int, int, int, int]]
] = [
    # 1 Chrome 흰 아이콘 95-268,20-245 + 라벨
    (
        "KakaoTalk_20261122_114259032.jpg",
        "step-01.jpg",
        (40, 240, 420, 620),
        (82, 8, 282, 275),
    ),
    # 2 URL 두 번째 행
    (
        "KakaoTalk_20261122_114259032_01.jpg",
        "step-02.jpg",
        (0, 700, 1080, 1100),
        (20, 170, 1060, 380),
    ),
    # 3 ⋮ 점 클러스터 377-389,24-74
    (
        "KakaoTalk_20261122_114259032_02.jpg",
        "step-03.jpg",
        (620, 40, 1080, 420),
        (350, 12, 410, 90),
    ),
    # 4 메뉴 글자 75-544,244-286 + 왼쪽 아이콘
    (
        "KakaoTalk_20261122_114259032_03.jpg",
        "step-04.jpg",
        (300, 1100, 1080, 1600),
        (5, 195, 720, 335),
    ),
    # 5 「설치」 카드 행
    (
        "KakaoTalk_20261122_114259032_04.jpg",
        "step-05.jpg",
        (0, 1380, 1080, 1850),
        (40, 155, 1040, 400),
    ),
    # 6 「설치」 파란 글자 304-374,262-300
    (
        "KakaoTalk_20261122_114259032_05.jpg",
        "step-06.jpg",
        (520, 1050, 1040, 1480),
        (265, 240, 400, 325),
    ),
    # 7 아이콘 103-255,55-204 + 라벨(~221-250, 더 넓음)
    (
        "KakaoTalk_20261122_114259032_06.jpg",
        "step-07.jpg",
        (560, 700, 920, 1060),
        (72, 42, 275, 255),
    ),
    # 8 홈 화면에 추가 글자 ~278-408,270 + 아이콘
    (
        "KakaoTalk_20261122_114259032_07.jpg",
        "step-08.jpg",
        (300, 400, 900, 900),
        (255, 175, 435, 350),
    ),
]


def main() -> None:
    for src, dest, crop, hl in JOBS:
        im = Image.open(os.path.join(RAW, src)).convert("RGB")
        cropped = im.crop(crop)
        out = draw_hl(cropped, hl)
        path = os.path.join(OUT, dest)
        out.save(path, "JPEG", quality=90, optimize=True)
        print("saved", dest, out.size, "crop", crop, "hl", hl)

    url_src = os.path.join(RAW, "KakaoTalk_20261122_114259032_08.jpg")
    Image.open(url_src).convert("RGB").save(
        os.path.join(OUT, "url.jpg"), "JPEG", quality=90, optimize=True
    )
    print("url.jpg ok")

    # 디버그 파일 정리
    for name in ("_debug7.jpg", "_debug8.jpg"):
        p = os.path.join(OUT, name)
        if os.path.exists(p):
            os.remove(p)


if __name__ == "__main__":
    main()
