"""Tiny visual-order converter for an LTR-only renderer (base direction RTL)."""
import re

MIRROR = {'(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<'}
# LTR run: latin letters/digits/format specs, may contain . / _ - : ' and inner spaces
LTR = re.compile(r"(?:%-?\d*[sdx]|[A-Za-z0-9])(?:%-?\d*[sdx]|[A-Za-z0-9]|[ &._/\-](?=[A-Za-z0-9%]))*")


def visual(s):
    units = []
    i = 0
    while i < len(s):
        m = LTR.match(s, i)
        if m and m.end() > i:
            units.append(m.group())
            i = m.end()
        else:
            units.append(MIRROR.get(s[i], s[i]))
            i += 1
    return ''.join(reversed(units))


def scroller(sentences, gap='      '):
    """Leftward scroller: sentences in reading order left->right, each visual."""
    return gap.join(visual(x) for x in sentences)


if __name__ == '__main__':
    for t in ['ברוכים הבאים ל-Icy Tower!', 'טוען %s', 'מתקין ג\'ויסטיק/בקר', 'ראו readme.txt.',
              "בטוח שרוצים למחוק את '%s'?", '(בחרו אותה בתפריט האפשרויות)', 'עובר לחלון 640x480']:
        print(visual(t)[::-1], '|', visual(t))
