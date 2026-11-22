"""원본 스크린샷에 분홍 강조를 그리고, 해당 부분만 잘라 저장합니다."""

from __future__ import annotations

import os

from PIL import Image, ImageDraw

RAW = r"c:\Users\바로에코\Desktop\account_book\public\install-guide\raw"
OUT = r"c:\Users\바로에코\Desktop\account_book\public\install-guide"

PINK = (255, 45, 120, 255)
FILL = (255, 45, 120, 60)
WIDTH = 14
RADIUS = 26


def clamp_box(
    box: tuple[int, int, int, int], w: int, h: int
) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = box
    return (
        max(0, min(x0, w - 1)),
        max(0, min(y0, h - 1)),
        max(1, min(x1, w)),
        max(1, min(y1, h)),
    )


def highlight_and_crop(
    src_path: str,
    dest_path: str,
    box: tuple[int, int, int, int],
    pad: tuple[int, int, int, int],
) -> None:
    """box=강조 영역, pad=(left, top, right, bottom) 크롭 여백."""
    im = Image.open(src_path).convert("RGBA")
    w, h = im.size
    box = clamp_box(box, w, h)

    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.rounded_rectangle(box, radius=RADIUS, fill=FILL, outline=PINK, width=WIDTH)
    marked = Image.alpha_composite(im, overlay).convert("RGB")

    pl, pt, pr, pb = pad
    x0, y0, x1, y1 = box
    crop = (
        max(0, x0 - pl),
        max(0, y0 - pt),
        min(w, x1 + pr),
        min(h, y1 + pb),
    )
    out = marked.crop(crop)
    out.save(dest_path, "JPEG", quality=88, optimize=True)
    print("saved", os.path.basename(dest_path), out.size, "from", crop)


# (원본파일, 출력, 강조박스, 크롭패딩 LTRB)
# 좌표는 원본 1080x2072 기준. 감지·피드백으로 보정함.
JOBS: list[
    tuple[str, str, tuple[int, int, int, int], tuple[int, int, int, int]]
] = [
    # 1 Chrome 앱
    (
        "KakaoTalk_20261122_114259032.jpg",
        "step-01.jpg",
        (50, 280, 310, 560),
        (40, 80, 400, 120),
    ),
    # 2 가계부 URL (두 줄 전체)
    (
        "KakaoTalk_20261122_114259032_01.jpg",
        "step-02.jpg",
        (36, 835, 1044, 1005),
        (20, 160, 20, 80),
    ),
    # 3 ⋮ 메뉴
    (
        "KakaoTalk_20261122_114259032_02.jpg",
        "step-03.jpg",
        (965, 72, 1065, 175),
        (420, 40, 20, 280),
    ),
    # 4 설치 및 바로가기 만들기
    (
        "KakaoTalk_20261122_114259032_03.jpg",
        "step-04.jpg",
        (350, 1305, 1055, 1460),
        (40, 220, 20, 160),
    ),
    # 5 「설치」 행
    (
        "KakaoTalk_20261122_114259032_04.jpg",
        "step-05.jpg",
        (48, 1565, 1032, 1765),
        (20, 200, 20, 40),
    ),
    # 6 설치 확인 버튼
    (
        "KakaoTalk_20261122_114259032_05.jpg",
        "step-06.jpg",
        (690, 1225, 1010, 1365),
        (180, 220, 40, 160),
    ),
    # 7 앱 목록 아이콘 (665-813, 757-897 + 라벨)
    (
        "KakaoTalk_20261122_114259032_06.jpg",
        "step-07.jpg",
        (640, 735, 840, 1005),
        (180, 160, 180, 120),
    ),
    # 8 「홈 화면에 추가」 가운데 버튼
    (
        "KakaoTalk_20261122_114259032_07.jpg",
        "step-08.jpg",
        (520, 595, 725, 760),
        (160, 140, 160, 200),
    ),
]


def main() -> None:
    for src, dest, box, pad in JOBS:
        highlight_and_crop(
            os.path.join(RAW, src),
            os.path.join(OUT, dest),
            box,
            pad,
        )

    url_src = os.path.join(RAW, "KakaoTalk_20261122_114259032_08.jpg")
    Image.open(url_src).convert("RGB").save(
        os.path.join(OUT, "url.jpg"), "JPEG", quality=90, optimize=True
    )
    print("url.jpg ok")


if __name__ == "__main__":
    main()
