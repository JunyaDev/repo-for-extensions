/* Form Filler – core utilities: seeded RNG, text helpers, dates, regex-driven string generator.
 * Every content file registers into the shared globalThis.__FF namespace and is safe to inject repeatedly. */
(() => {
  'use strict';
  const FF = (globalThis.__FF = globalThis.__FF || {});
  if (FF.core) return;
  FF.core = true;
  FF.SKIP = Symbol('skip');

  // ---------- Random ----------

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  FF.makeRng = function (seed) {
    const next = mulberry32(seed);
    const rng = {
      next,
      int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      bool: (p = 0.5) => next() < p,
      digits: (n) => {
        let s = '';
        for (let i = 0; i < n; i++) s += Math.floor(next() * 10);
        return s;
      },
      chars: (n, set) => {
        let s = '';
        for (let i = 0; i < n; i++) s += set[Math.floor(next() * set.length)];
        return s;
      },
      shuffle: (arr) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      },
    };
    return rng;
  };

  FF.UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  FF.LOWER = 'abcdefghijklmnopqrstuvwxyz';
  FF.DIGITS = '0123456789';

  // ---------- Text ----------

  FF.stripAccents = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

  /** Lower-case, accent-free, camelCase/snake_case split text containing only [a-z0-9% ]. */
  FF.normalize = function (s) {
    if (!s) return '';
    return FF.stripAccents(String(s))
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Za-z])(\d)/g, '$1 $2')
      .toLowerCase()
      .replace(/[^a-z0-9%]+/g, ' ')
      .trim();
  };

  FF.slug = (s) => FF.stripAccents(String(s)).toLowerCase().replace(/[^a-z0-9]/g, '');
  FF.capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  FF.pad = (n, len = 2) => String(n).padStart(len, '0');
  FF.escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  FF.template = function (tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
  };

  // ---------- Dates ----------

  FF.addDays = (d, n) => {
    const r = new Date(d.getTime());
    r.setDate(r.getDate() + n);
    return r;
  };

  FF.isoDate = (d) => `${d.getFullYear()}-${FF.pad(d.getMonth() + 1)}-${FF.pad(d.getDate())}`;

  /** Guess a text date format from placeholder/pattern hints, else from the locale. */
  FF.detectDateFormat = function (hint, locale) {
    const h = String(hint || '').toLowerCase();
    let m = h.match(/\b(dd|gg)([/.\- ])mm\2(yyyy|aaaa|yy|aa)\b/);
    if (m) return `dd${m[2]}mm${m[2]}${m[3].length === 4 ? 'yyyy' : 'yy'}`;
    m = h.match(/\bmm([/.\- ])(dd|gg)\1(yyyy|aaaa|yy|aa)\b/);
    if (m) return `mm${m[1]}dd${m[1]}${m[3].length === 4 ? 'yyyy' : 'yy'}`;
    m = h.match(/\b(yyyy|aaaa)([/.\- ])mm\2(dd|gg)\b/);
    if (m) return `yyyy${m[2]}mm${m[2]}dd`;
    m = h.match(/\b(\d{4})([/.\-])(\d{2})\2(\d{2})\b/);
    if (m) return `yyyy${m[2]}mm${m[2]}dd`;
    m = h.match(/\b(\d{1,2})([/.\-])(\d{1,2})\2(\d{4})\b/);
    if (m) {
      if (+m[1] > 12) return `dd${m[2]}mm${m[2]}yyyy`;
      if (+m[3] > 12) return `mm${m[2]}dd${m[2]}yyyy`;
      return locale === 'en-US' ? `mm${m[2]}dd${m[2]}yyyy` : `dd${m[2]}mm${m[2]}yyyy`;
    }
    return locale === 'en-US' ? 'mm/dd/yyyy' : 'dd/mm/yyyy';
  };

  FF.formatDate = function (d, fmt) {
    return fmt.replace(/yyyy|yy|mm|dd/g, (t) => {
      if (t === 'yyyy') return String(d.getFullYear());
      if (t === 'yy') return FF.pad(d.getFullYear() % 100);
      if (t === 'mm') return FF.pad(d.getMonth() + 1);
      return FF.pad(d.getDate());
    });
  };

  // ---------- HTML pattern attribute support ----------

  const patternCache = new Map();

  /** Compile an HTML `pattern` the way browsers do (anchored, `v` flag), with fallbacks. */
  FF.compilePattern = function (src) {
    if (!src) return null;
    if (patternCache.has(src)) return patternCache.get(src);
    let re = null;
    for (const flags of ['v', 'u', '']) {
      try {
        re = new RegExp(`^(?:${src})$`, flags);
        break;
      } catch (e) {
        /* try next flag set */
      }
    }
    patternCache.set(src, re);
    return re;
  };

  const ALNUM = (FF.UPPER + FF.LOWER + FF.DIGITS).split('');
  const DOT_CHARS = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%*'.split('');
  const PRINTABLE = [];
  for (let c = 33; c < 127; c++) PRINTABLE.push(String.fromCharCode(c));
  const range = (a, b) => {
    const out = [];
    for (let c = a.charCodeAt(0); c <= b.charCodeAt(0) && out.length < 2000; c++) out.push(String.fromCharCode(c));
    return out;
  };
  const SETS = {
    d: range('0', '9'),
    w: ALNUM.concat('_'),
    s: [' '],
    D: range('a', 'z').concat(range('A', 'Z')),
    W: ['-', '.', ' '],
    S: ALNUM,
  };

  /** Generate a random string matching (most) regular expressions: classes, groups, alternation, quantifiers. */
  FF.randomFromPattern = function (src, rng) {
    let i = 0;

    function parseAlt() {
      const opts = [parseSeq()];
      while (src[i] === '|') {
        i++;
        opts.push(parseSeq());
      }
      return opts.length === 1 ? opts[0] : { t: 'alt', opts };
    }

    function parseSeq() {
      const items = [];
      while (i < src.length && src[i] !== '|' && src[i] !== ')') {
        const atom = parseAtom();
        const q = parseQuant(atom);
        if (q) items.push(q);
      }
      return { t: 'seq', items };
    }

    function parseQuant(atom) {
      let min = 1;
      let max = 1;
      const c = src[i];
      if (c === '*') [min, max] = [0, Infinity];
      else if (c === '+') [min, max] = [1, Infinity];
      else if (c === '?') [min, max] = [0, 1];
      else if (c === '{') {
        const m = /^\{(\d*)(,?)(\d*)\}/.exec(src.slice(i));
        if (!m || (!m[1] && !m[3])) return atom;
        min = m[1] ? +m[1] : 0;
        max = m[2] ? (m[3] ? +m[3] : Infinity) : min;
        i += m[0].length - 1;
      } else return atom;
      i++;
      if (src[i] === '?' || src[i] === '+') i++;
      return atom ? { t: 'rep', n: atom, min, max } : null;
    }

    function parseEscape() {
      const c = src[i++];
      if (c === undefined) return null;
      if (SETS[c]) return { t: 'set', chars: SETS[c] };
      if (c === 'b' || c === 'B') return null;
      if (c === 'n') return { t: 'lit', c: '\n' };
      if (c === 't') return { t: 'lit', c: '\t' };
      if (c === 'r' || c === 'f' || c === 'v' || c === '0') return null;
      if (c === 'x') {
        const h = src.substr(i, 2);
        i += 2;
        return { t: 'lit', c: String.fromCharCode(parseInt(h, 16)) };
      }
      if (c === 'u') {
        let h;
        if (src[i] === '{') {
          const end = src.indexOf('}', i);
          h = src.slice(i + 1, end);
          i = end + 1;
        } else {
          h = src.substr(i, 4);
          i += 4;
        }
        return { t: 'lit', c: String.fromCodePoint(parseInt(h, 16) || 63) };
      }
      if (c === 'p' || c === 'P') {
        let name = '';
        if (src[i] === '{') {
          const end = src.indexOf('}', i);
          name = src.slice(i + 1, end);
          i = end + 1;
        }
        if (c === 'P') return { t: 'set', chars: SETS.d };
        if (/^(Lu|Uppercase_Letter)$/.test(name)) return { t: 'set', chars: range('A', 'Z') };
        if (/^(Ll|Lowercase_Letter)$/.test(name)) return { t: 'set', chars: range('a', 'z') };
        if (/^(N|Nd|Number|Decimal_Number)$/.test(name)) return { t: 'set', chars: SETS.d };
        return { t: 'set', chars: SETS.D };
      }
      if (/[1-9]/.test(c)) return null; // back-reference: unsupported
      if (c === 'k' && src[i] === '<') {
        i = src.indexOf('>', i) + 1;
        return null;
      }
      return { t: 'lit', c };
    }

    function parseClass() {
      let neg = false;
      if (src[i] === '^') {
        neg = true;
        i++;
      }
      const chars = new Set();
      while (i < src.length && src[i] !== ']') {
        let a;
        if (src[i] === '\\') {
          i++;
          const e = parseEscape();
          if (!e) continue;
          if (e.t === 'set') {
            e.chars.forEach((ch) => chars.add(ch));
            continue;
          }
          a = e.c;
        } else if (src[i] === '[') {
          // nested class (v flag): flatten
          i++;
          const inner = parseClass();
          inner.chars.forEach((ch) => chars.add(ch));
          continue;
        } else {
          a = src[i++];
        }
        if (src[i] === '-' && src[i + 1] !== undefined && src[i + 1] !== ']') {
          i++;
          let b;
          if (src[i] === '\\') {
            i++;
            const e = parseEscape();
            b = e && e.t === 'lit' ? e.c : a;
          } else b = src[i++];
          range(a, b).forEach((ch) => chars.add(ch));
        } else chars.add(a);
      }
      i++; // closing ]
      if (neg) {
        let pool = ALNUM.concat(['-', '_', '.']).filter((ch) => !chars.has(ch));
        if (!pool.length) pool = PRINTABLE.filter((ch) => !chars.has(ch));
        return { t: 'set', chars: pool };
      }
      return { t: 'set', chars: [...chars] };
    }

    function parseAtom() {
      const c = src[i++];
      switch (c) {
        case '^':
        case '$':
          return null;
        case '.':
          return { t: 'set', chars: DOT_CHARS };
        case '(': {
          let look = false;
          if (src[i] === '?') {
            if (src[i + 1] === ':') i += 2;
            else if (src[i + 1] === '=' || src[i + 1] === '!') {
              i += 2;
              look = true;
            } else if (src[i + 1] === '<' && (src[i + 2] === '=' || src[i + 2] === '!')) {
              i += 3;
              look = true;
            } else if (src[i + 1] === '<') i = src.indexOf('>', i) + 1;
          }
          const n = parseAlt();
          if (src[i] === ')') i++;
          return look ? null : { t: 'group', n };
        }
        case '[':
          return parseClass();
        case '\\':
          return parseEscape();
        default:
          return { t: 'lit', c };
      }
    }

    function gen(n) {
      if (!n) return '';
      switch (n.t) {
        case 'seq':
          return n.items.map(gen).join('');
        case 'alt':
          return gen(rng.pick(n.opts));
        case 'lit':
          return n.c;
        case 'set':
          return n.chars.length ? rng.pick(n.chars) : '';
        case 'group':
          return gen(n.n);
        case 'rep': {
          const hi = n.max === Infinity ? n.min + 6 : Math.min(n.max, n.min + 24);
          const count = rng.int(n.min, hi);
          let s = '';
          for (let k = 0; k < count; k++) s += gen(n.n);
          return s;
        }
        default:
          return '';
      }
    }

    try {
      const ast = parseAlt();
      return gen(ast);
    } catch (e) {
      return null;
    }
  };
})();
