// Logical (reading order) Hebrew -> visual order for the LTR bitmap-font renderer.
// Same rules as tools/bidi.py, which made the strings of the patched desktop exe.
const MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' };
const LTR = /^(?:[A-Za-z0-9])(?:[A-Za-z0-9]|[ &._/\-:+](?=[A-Za-z0-9]))*/;
const HEB = /[֐-׿]/;

export function visual(s) {
  if (!HEB.test(s)) return s;            // pure LTR text stays as it is
  const units = [];
  let i = 0;
  while (i < s.length) {
    const m = LTR.exec(s.slice(i));
    if (m && m[0].length) { units.push(m[0]); i += m[0].length; }
    else { units.push(MIRROR[s[i]] || s[i]); i++; }
  }
  return units.reverse().join('');
}
