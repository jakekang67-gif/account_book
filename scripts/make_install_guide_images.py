"""원본 스크린샷에 통일된 분홍 강조를 그려 install-guide 단계 이미지를 만듭니다."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "public" / "install-guide" / "raw"
OUT = ROOT / "public" / "install-guide"

FILL = (233, 30, 140, 55)
BORDER = (233, 30, 140, 235)
RADIUS = 28
STROKE = 10

# (출력파일, 원본, 박스 분율 x0,y0,x1,y1, 안내문구)
STEPS = [
    (
        "step-01.jpg",
        "KakaoTalk_20261122_114259032.jpg",
        (0.34, 0.145, 0.66, 0.295),
        "Chrome 앱을 누릅니다.",
    ),
    (
        "step-02.jpg",
        "KakaoTalk_20261122_114259032_01.jpg",
        (0.04, 0.418, 0.96, 0.468),
        "가계부 주소(account-book…)를 누릅니다.",
    ),
    (
        "step-03.jpg",
        "KakaoTalk_20261122_114259032_02.jpg",
        (0.88, 0.035, 0.985, 0.085),
        "오른쪽 ⋮(메뉴)를 누릅니다.",
    ),
    (
        "step-04.jpg",
        "KakaoTalk_20261122_114259032_03.jpg",
        (0.22, 0.625, 0.98, 0.695),
        "「설치 및 바로가기 만들기」를 누릅니다.",
    ),
    (
        "step-05.jpg",
        "KakaoTalk_20261122_114259032_04.jpg",
        (0.04, 0.735, 0.96, 0.825),
        "「설치」를 누릅니다.",
    ),
    (
        "step-06.jpg",
        "KakaoTalk_20261122_114259032_05.jpg",
        (0.68, 0.605, 0.90, 0.665),
        "「설치」를 한 번 더 확인합니다.",
    ),
    (
        "step-07.jpg",
        "KakaoTalk_20261122_114259032_06.jpg",
        (0.605, 0.335, 0.795, 0.440),
        "앱 목록에서 「나의 챗가계부」를 찾습니다.",
    ),
    (
        "step-08.jpg",
        "KakaoTalk_20261122_114259032_07.jpg",
        (0.40, 0.245, 0.60, 0.345),
        "길게 누른 뒤 「홈 화면에 추가」를 누릅니다.",
    ),
]


def frac_box(w: int, h: int, x0: float, y0: float, x1: float, y1: float):
    return [int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)]


def draw_rounded_highlight(base: Image.Image, box: list[int]) -> Image.Image:
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle(
        box, radius=RADIUS, fill=FILL, outline=BORDER, width=STROKE
    )
    return Image.alpha_composite(base.convert("RGBA"), overlay)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for out_name, src_name, box_f, _caption in STEPS:
        src = RAW / src_name
        im = Image.open(src)
        w, h = im.size
        box = frac_box(w, h, *box_f)
        out = draw_rounded_highlight(im, box).convert("RGB")
        dest = OUT / out_name
        out.save(dest, "JPEG", quality=85, optimize=True)
        print("wrote", out_name, box)

    url_src = RAW / "KakaoTalk_20261122_114259032_08.jpg"
    Image.open(url_src).convert("RGB").save(
        OUT / "url.jpg", "JPEG", quality=90, optimize=True
    )
    print("wrote url.jpg")


if __name__ == "__main__":
    main()
