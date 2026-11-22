"""원본 스크린샷에 일정한 분홍 강조 박스를 그립니다."""

from __future__ import annotations

import os

from PIL import Image, ImageDraw

RAW = r"c:\Users\바로에코\Desktop\account_book\public\install-guide\raw"
OUT = r"c:\Users\바로에코\Desktop\account_book\public\install-guide"

PINK = (255, 45, 120, 255)
FILL = (255, 45, 120, 55)
WIDTH = 12
RADIUS = 28


def highlight(src_path: str, dest_path: str, boxes: list[tuple[int, int, int, int]]) -> None:
    im = Image.open(src_path).convert("RGBA")
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for box in boxes:
        d.rounded_rectangle(box, radius=RADIUS, fill=FILL, outline=PINK, width=WIDTH)
    out = Image.alpha_composite(im, overlay).convert("RGB")
    out.save(dest_path, "JPEG", quality=85, optimize=True)
    print("saved", os.path.basename(dest_path), out.size)


# 좌표는 1080x2072 기준. 결과 이미지 확인 후 보정.
JOBS: list[tuple[str, str, list[tuple[int, int, int, int]]]] = [
    # 1 Chrome 앱 찾기
    ("KakaoTalk_20261122_114259032.jpg", "step-01.jpg", [(55, 290, 300, 560)]),
    # 2 기록에서 가계부 URL
    ("KakaoTalk_20261122_114259032_01.jpg", "step-02.jpg", [(30, 850, 1050, 970)]),
    # 3 가계부 화면 ⋮
    ("KakaoTalk_20261122_114259032_02.jpg", "step-03.jpg", [(968, 78, 1058, 168)]),
    # 4 설치 및 바로가기 만들기
    ("KakaoTalk_20261122_114259032_03.jpg", "step-04.jpg", [(360, 1310, 1050, 1455)]),
    # 5 설치 선택
    ("KakaoTalk_20261122_114259032_04.jpg", "step-05.jpg", [(50, 1570, 1030, 1760)]),
    # 6 설치 확인
    ("KakaoTalk_20261122_114259032_05.jpg", "step-06.jpg", [(700, 1235, 1000, 1360)]),
    # 7 앱 목록
    ("KakaoTalk_20261122_114259032_06.jpg", "step-07.jpg", [(670, 610, 910, 920)]),
    # 8 홈 화면에 추가 (가운데 버튼)
    ("KakaoTalk_20261122_114259032_07.jpg", "step-08.jpg", [(430, 420, 700, 640)]),
]


def main() -> None:
    for src, dest, boxes in JOBS:
        highlight(os.path.join(RAW, src), os.path.join(OUT, dest), boxes)

    url_src = os.path.join(RAW, "KakaoTalk_20261122_114259032_08.jpg")
    Image.open(url_src).convert("RGB").save(
        os.path.join(OUT, "url.jpg"), "JPEG", quality=90, optimize=True
    )
    print("url.jpg ok")


if __name__ == "__main__":
    main()
