import csv
from collections import Counter, defaultdict
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(r"C:\Users\cybor\Desktop\VSCode\My_Sites")
SOURCE = Path(r"C:\Users\cybor\.codex\attachments\9fd72087-8827-4103-b7bb-f9a0147ae113\pasted-text.txt")
OUTPUT = ROOT / "output" / "pdf" / "Firestore理解度チェック_240問_解答解説.pdf"
FONT_PATH = Path(r"C:\Windows\Fonts\NotoSansJP-VF.ttf")

PAGE_W, PAGE_H = A4
MARGIN_X = 42
TOP_Y = PAGE_H - 42
BOTTOM_Y = 48
CONTENT_W = PAGE_W - MARGIN_X * 2

INK = colors.HexColor("#17212b")
MUTED = colors.HexColor("#637083")
BLUE = colors.HexColor("#1f6feb")
BLUE_DARK = colors.HexColor("#1554b8")
BLUE_SOFT = colors.HexColor("#eaf3ff")
GREEN = colors.HexColor("#1f8a61")
GREEN_SOFT = colors.HexColor("#e9f8f1")
ORANGE = colors.HexColor("#c96b1c")
ORANGE_SOFT = colors.HexColor("#fff4e9")
RED = colors.HexColor("#c93636")
RED_SOFT = colors.HexColor("#fff0f0")
PAPER = colors.HexColor("#fbfdff")
LINE = colors.HexColor("#d9e1ea")
DARK = colors.HexColor("#111827")


def read_rows():
    with SOURCE.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        return list(reader)


def register_fonts():
    pdfmetrics.registerFont(TTFont("JP", str(FONT_PATH)))
    pdfmetrics.registerFont(TTFont("JPB", str(FONT_PATH)))


def sw(text, size=10, font="JP"):
    return pdfmetrics.stringWidth(str(text), font, size)


def wrap_text(text, max_width, size=10, font="JP"):
    text = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = []
    for raw in text.split("\n"):
        if not raw:
            lines.append("")
            continue
        current = ""
        for ch in raw:
            trial = current + ch
            if sw(trial, size, font) <= max_width:
                current = trial
            else:
                if current:
                    lines.append(current)
                current = ch
        if current:
            lines.append(current)
    return lines


def pill(c, x, y, text, fill, stroke=None, text_color=INK, size=8.5, pad=6):
    w = sw(text, size, "JPB") + pad * 2
    h = 18
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.roundRect(x, y - h + 4, w, h, 8, fill=1, stroke=1)
    c.setFillColor(text_color)
    c.setFont("JPB", size)
    c.drawString(x + pad, y - 9, text)
    return w


class PdfBook:
    def __init__(self, rows):
        self.rows = rows
        self.c = canvas.Canvas(str(OUTPUT), pagesize=A4)
        self.page = 0
        self.current_section = ""

    def new_page(self, section=""):
        if self.page:
            self.footer()
            self.c.showPage()
        self.page += 1
        self.current_section = section or self.current_section
        self.header()
        return TOP_Y - 34

    def header(self):
        if self.page == 1:
            return
        c = self.c
        c.setFillColor(BLUE_SOFT)
        c.rect(0, PAGE_H - 26, PAGE_W, 26, fill=1, stroke=0)
        c.setFillColor(BLUE_DARK)
        c.setFont("JPB", 9)
        c.drawString(MARGIN_X, PAGE_H - 18, "Firestore理解度チェック 240問 解答・解説集")
        c.setFillColor(MUTED)
        c.setFont("JP", 8)
        c.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 18, self.current_section)

    def footer(self):
        c = self.c
        c.setStrokeColor(LINE)
        c.line(MARGIN_X, 32, PAGE_W - MARGIN_X, 32)
        c.setFillColor(MUTED)
        c.setFont("JP", 8)
        c.drawString(MARGIN_X, 20, "Firestore / Spreadsheet / 学習ログ / 復習BOX")
        c.drawRightString(PAGE_W - MARGIN_X, 20, f"{self.page}")

    def ensure(self, y, needed, section=""):
        if y - needed < BOTTOM_Y:
            return self.new_page(section)
        return y

    def draw_cover(self):
        c = self.c
        self.page = 1
        c.setFillColor(colors.HexColor("#f4f7fb"))
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        c.setFillColor(BLUE_SOFT)
        c.circle(PAGE_W - 70, PAGE_H - 70, 120, fill=1, stroke=0)
        c.setFillColor(GREEN_SOFT)
        c.circle(80, 100, 110, fill=1, stroke=0)

        c.setFillColor(BLUE_DARK)
        c.setFont("JPB", 13)
        c.drawString(MARGIN_X, PAGE_H - 120, "Firestore理解度チェック")
        c.setFillColor(INK)
        c.setFont("JPB", 29)
        c.drawString(MARGIN_X, PAGE_H - 160, "240問")
        c.drawString(MARGIN_X, PAGE_H - 198, "解答・解説集")
        c.setFillColor(MUTED)
        c.setFont("JP", 12)
        c.drawString(MARGIN_X, PAGE_H - 232, "問題マスタの全問に、正解・ヒント・解説を付けた学習用PDF")

        self.draw_phone_mock(PAGE_W - 220, PAGE_H - 410)
        self.draw_db_mock(MARGIN_X, PAGE_H - 500)

        c.setFillColor(PAPER)
        c.roundRect(MARGIN_X, 82, CONTENT_W, 92, 12, fill=1, stroke=0)
        c.setStrokeColor(LINE)
        c.roundRect(MARGIN_X, 82, CONTENT_W, 92, 12, fill=0, stroke=1)
        c.setFillColor(INK)
        c.setFont("JPB", 13)
        c.drawString(MARGIN_X + 18, 142, "収録内容")
        c.setFont("JP", 10)
        c.setFillColor(MUTED)
        c.drawString(MARGIN_X + 18, 120, "カテゴリ別の重要ポイント / 4択問題 / 正解番号 / 正解テキスト / ヒント / 解説 / タグ")
        c.drawString(MARGIN_X + 18, 100, "スマホ学習サイトと併用しやすいよう、復習しやすいカード形式で整理")
        self.footer()

    def draw_phone_mock(self, x, y):
        c = self.c
        c.setFillColor(colors.white)
        c.setStrokeColor(LINE)
        c.roundRect(x, y, 168, 260, 18, fill=1, stroke=1)
        c.setFillColor(INK)
        c.setFont("JPB", 11)
        c.drawString(x + 18, y + 220, "今日の必修")
        for i, (label, col) in enumerate([("Q", BLUE), ("A", GREEN), ("解説", ORANGE)]):
            yy = y + 172 - i * 52
            c.setFillColor(colors.HexColor("#f8fbfd"))
            c.roundRect(x + 16, yy, 136, 38, 8, fill=1, stroke=0)
            c.setFillColor(col)
            c.circle(x + 34, yy + 19, 10, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont("JPB", 8)
            c.drawCentredString(x + 34, yy + 16, label[:1])
            c.setFillColor(INK)
            c.drawString(x + 52, yy + 15, label)
        c.setFillColor(BLUE_SOFT)
        c.roundRect(x + 18, y + 18, 132, 28, 8, fill=1, stroke=0)
        c.setFillColor(BLUE_DARK)
        c.setFont("JPB", 9)
        c.drawCentredString(x + 84, y + 28, "復習BOX")

    def draw_db_mock(self, x, y):
        c = self.c
        c.setFont("JPB", 12)
        c.setFillColor(INK)
        c.drawString(x, y + 220, "Firestore学習の流れ")
        boxes = [
            ("問題マスタ", "Spreadsheet"),
            ("出題", "Web App"),
            ("回答", "User"),
            ("記録", "Logs"),
            ("復習", "Review BOX"),
        ]
        bx = x
        by = y + 160
        for i, (title, sub) in enumerate(boxes):
            c.setFillColor([BLUE_SOFT, GREEN_SOFT, ORANGE_SOFT, RED_SOFT, BLUE_SOFT][i])
            c.roundRect(bx, by, 86, 48, 8, fill=1, stroke=0)
            c.setStrokeColor(LINE)
            c.roundRect(bx, by, 86, 48, 8, fill=0, stroke=1)
            c.setFillColor(INK)
            c.setFont("JPB", 9)
            c.drawCentredString(bx + 43, by + 29, title)
            c.setFillColor(MUTED)
            c.setFont("JP", 7)
            c.drawCentredString(bx + 43, by + 13, sub)
            if i < len(boxes) - 1:
                c.setStrokeColor(BLUE)
                c.line(bx + 90, by + 24, bx + 106, by + 24)
                c.line(bx + 101, by + 29, bx + 106, by + 24)
                c.line(bx + 101, by + 19, bx + 106, by + 24)
            bx += 112

    def draw_overview(self):
        y = self.new_page("Overview")
        c = self.c
        c.setFillColor(INK)
        c.setFont("JPB", 21)
        c.drawString(MARGIN_X, y, "カテゴリ別の問題数")
        y -= 30
        c.setFillColor(MUTED)
        c.setFont("JP", 10)
        c.drawString(MARGIN_X, y, "240問をカテゴリ別に確認できます。棒の長さは問題数です。")
        y -= 28

        cats = Counter(r["カテゴリ"] for r in self.rows)
        max_count = max(cats.values())
        for cat, count in cats.most_common():
            y = self.ensure(y, 25, "Overview")
            c.setFillColor(INK)
            c.setFont("JPB", 9)
            c.drawString(MARGIN_X, y, cat)
            bar_x = MARGIN_X + 130
            bar_w = 280 * count / max_count
            c.setFillColor(BLUE_SOFT)
            c.roundRect(bar_x, y - 3, 280, 10, 5, fill=1, stroke=0)
            c.setFillColor(BLUE if count >= 16 else GREEN)
            c.roundRect(bar_x, y - 3, bar_w, 10, 5, fill=1, stroke=0)
            c.setFillColor(MUTED)
            c.setFont("JP", 8.5)
            c.drawRightString(PAGE_W - MARGIN_X, y - 1, f"{count}問")
            y -= 20

        y = self.new_page("Study Map")
        c.setFillColor(INK)
        c.setFont("JPB", 20)
        c.drawString(MARGIN_X, y, "使い方")
        y -= 34
        steps = [
            ("1", "まず解く", "問題文とコード例から、Firestore APIの役割を判断する。"),
            ("2", "答えを見る", "正解番号だけでなく、正解テキストを声に出して確認する。"),
            ("3", "解説を読む", "なぜそのAPIや設計が合うのかを、実装場面と結び付ける。"),
            ("4", "復習する", "間違えたカテゴリだけを復習BOXとして重点的に回す。"),
        ]
        for num, title, body in steps:
            c.setFillColor(BLUE_SOFT)
            c.circle(MARGIN_X + 16, y - 8, 14, fill=1, stroke=0)
            c.setFillColor(BLUE_DARK)
            c.setFont("JPB", 12)
            c.drawCentredString(MARGIN_X + 16, y - 13, num)
            c.setFillColor(INK)
            c.setFont("JPB", 12)
            c.drawString(MARGIN_X + 42, y, title)
            c.setFillColor(MUTED)
            c.setFont("JP", 10)
            c.drawString(MARGIN_X + 42, y - 18, body)
            y -= 58

    def draw_question(self, row, index, y):
        c = self.c
        q_lines = wrap_text(row["問題文"], CONTENT_W - 32, 10.8, "JPB")
        code_lines = wrap_text(row["コード例"], CONTENT_W - 44, 8.5, "JP") if row["コード例"] else []
        option_lines = []
        for n in range(1, 5):
            label = f"{n}. {row[f'選択肢{n}']}"
            option_lines.extend(wrap_text(label, CONTENT_W - 54, 8.8, "JP"))
        exp_lines = wrap_text(row["解説"], CONTENT_W - 32, 9.2, "JP")
        hint_lines = wrap_text(row["ヒント"], CONTENT_W - 32, 8.8, "JP")
        answer_lines = wrap_text(f"正解: {row['正解番号']}. {row['正解テキスト']}", CONTENT_W - 32, 10, "JPB")

        height = 98 + len(q_lines) * 14 + len(option_lines) * 12 + len(answer_lines) * 14 + len(hint_lines) * 11 + len(exp_lines) * 12
        if code_lines:
            height += 18 + len(code_lines) * 11
        height += 26
        y = self.ensure(y, height, row["カテゴリ"])

        top = y
        c.setFillColor(colors.white)
        c.setStrokeColor(LINE)
        c.roundRect(MARGIN_X, y - height + 8, CONTENT_W, height, 10, fill=1, stroke=1)

        c.setFillColor(BLUE_SOFT)
        c.roundRect(MARGIN_X, y - 24, CONTENT_W, 32, 10, fill=1, stroke=0)
        c.setFillColor(BLUE_DARK)
        c.setFont("JPB", 9)
        c.drawString(MARGIN_X + 12, y - 10, f"{index:03d}  {row['問題ID']}")
        x = MARGIN_X + 116
        x += pill(c, x, y - 4, row["カテゴリ"], colors.white, LINE, BLUE_DARK, 8) + 5
        x += pill(c, x, y - 4, row["難易度"], ORANGE_SOFT, None, ORANGE, 8) + 5
        pill(c, x, y - 4, row["おすすめモード"] or "全範囲", GREEN_SOFT, None, GREEN, 8)
        y -= 42

        c.setFillColor(INK)
        c.setFont("JPB", 10.8)
        for line in q_lines:
            c.drawString(MARGIN_X + 16, y, line)
            y -= 14
        y -= 4

        if code_lines:
            code_h = len(code_lines) * 11 + 14
            c.setFillColor(DARK)
            c.roundRect(MARGIN_X + 16, y - code_h + 6, CONTENT_W - 32, code_h, 6, fill=1, stroke=0)
            c.setFillColor(colors.HexColor("#dbeafe"))
            c.setFont("JP", 8.5)
            cy = y - 8
            for line in code_lines:
                c.drawString(MARGIN_X + 26, cy, line)
                cy -= 11
            y -= code_h + 6

        c.setFont("JP", 8.8)
        correct_no = row["正解番号"]
        for n in range(1, 5):
            opt = row[f"選択肢{n}"]
            lines = wrap_text(f"{n}. {opt}", CONTENT_W - 54, 8.8, "JP")
            is_ok = str(n) == str(correct_no)
            c.setFillColor(GREEN_SOFT if is_ok else PAPER)
            c.setStrokeColor(GREEN if is_ok else LINE)
            opt_h = max(20, len(lines) * 11 + 8)
            c.roundRect(MARGIN_X + 16, y - opt_h + 5, CONTENT_W - 32, opt_h, 6, fill=1, stroke=1)
            c.setFillColor(GREEN if is_ok else MUTED)
            c.setFont("JPB", 8.8)
            c.drawString(MARGIN_X + 26, y - 9, "OK" if is_ok else "")
            c.setFillColor(INK)
            c.setFont("JP", 8.8)
            ly = y - 9
            for line in lines:
                c.drawString(MARGIN_X + 44, ly, line)
                ly -= 11
            y -= opt_h + 4

        y -= 2
        c.setFillColor(GREEN)
        c.setFont("JPB", 10)
        for line in answer_lines:
            c.drawString(MARGIN_X + 16, y, line)
            y -= 14

        c.setFillColor(ORANGE)
        c.setFont("JPB", 8.8)
        c.drawString(MARGIN_X + 16, y, "ヒント")
        y -= 12
        c.setFillColor(MUTED)
        c.setFont("JP", 8.8)
        for line in hint_lines:
            c.drawString(MARGIN_X + 16, y, line)
            y -= 11

        y -= 2
        c.setFillColor(BLUE_DARK)
        c.setFont("JPB", 9.2)
        c.drawString(MARGIN_X + 16, y, "解説")
        y -= 13
        c.setFillColor(INK)
        c.setFont("JP", 9.2)
        for line in exp_lines:
            c.drawString(MARGIN_X + 16, y, line)
            y -= 12

        return y - 14

    def draw_questions(self):
        by_cat = defaultdict(list)
        for row in self.rows:
            by_cat[row["カテゴリ"]].append(row)

        y = TOP_Y
        first = True
        index = 1
        for cat, cat_rows in by_cat.items():
            y = self.new_page(cat) if first else self.ensure(y, 74, cat)
            first = False
            c = self.c
            c.setFillColor(BLUE_DARK)
            c.setFont("JPB", 18)
            c.drawString(MARGIN_X, y, cat)
            c.setFillColor(MUTED)
            c.setFont("JP", 9.5)
            c.drawString(MARGIN_X, y - 20, f"{len(cat_rows)}問 / 正解番号・正解テキスト・ヒント・解説付き")
            y -= 48
            for row in cat_rows:
                y = self.draw_question(row, index, y)
                index += 1

    def save(self):
        self.footer()
        self.c.save()


def main():
    register_fonts()
    rows = read_rows()
    book = PdfBook(rows)
    book.draw_cover()
    book.draw_overview()
    book.draw_questions()
    book.save()
    print(OUTPUT)


if __name__ == "__main__":
    main()
