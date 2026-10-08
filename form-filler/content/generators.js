/* Form Filler – identity ("persona") generation, Italian/UK/US identifiers and per-field value generators. */
(() => {
  'use strict';
  const FF = globalThis.__FF;
  if (!FF || FF.createPersona) return;

  const today = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // ---------- Italian identifiers ----------

  const CF_MONTHS = 'ABCDEHLMPRST';
  // "Odd position" values shared by the codice fiscale check char and the IBAN CIN.
  const ODD = {
    0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
    A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
    N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
  };
  const evenVal = (ch) => (/\d/.test(ch) ? +ch : ch.charCodeAt(0) - 65);

  function controlChar(s) {
    let sum = 0;
    for (let i = 0; i < s.length; i++) sum += i % 2 === 0 ? ODD[s[i]] : evenVal(s[i]);
    return String.fromCharCode(65 + (sum % 26));
  }

  function cfPart(str, isName) {
    const s = FF.stripAccents(str).toUpperCase().replace(/[^A-Z]/g, '');
    const cons = s.replace(/[AEIOU]/g, '');
    const vow = s.replace(/[^AEIOU]/g, '');
    if (isName && cons.length >= 4) return cons[0] + cons[2] + cons[3];
    return (cons + vow + 'XXX').slice(0, 3);
  }

  FF.codiceFiscale = function (first, last, birth, gender, placeCode) {
    const day = birth.getDate() + (gender === 'F' ? 40 : 0);
    const base = cfPart(last, false) + cfPart(first, true) + FF.pad(birth.getFullYear() % 100) +
      CF_MONTHS[birth.getMonth()] + FF.pad(day) + placeCode;
    return base + controlChar(base);
  };

  FF.partitaIva = function (rng) {
    const base = FF.pad(rng.int(1, 9999999), 7) + FF.pad(rng.int(1, 100), 3);
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      let d = +base[i];
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
    }
    return base + ((10 - (sum % 10)) % 10);
  };

  /** Remainder of a long decimal string (too big for Number) divided by m. */
  function mod(digits, m) {
    let rem = 0;
    for (const ch of digits) rem = (rem * 10 + +ch) % m;
    return rem;
  }

  /** ISO 7064 mod-97 check digits, shared by IBANs and SEPA creditor identifiers. */
  function ibanCheck(country, bban) {
    const numeric = (bban + country + '00').replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    return FF.pad(98 - mod(numeric, 97));
  }

  function ibanIT(abi, cab, conto) {
    const bban = controlChar(abi + cab + conto) + abi + cab + conto;
    return 'IT' + ibanCheck('IT', bban) + bban;
  }

  function ibanGB(code, sort, account) {
    const bban = code + sort + account;
    return 'GB' + ibanCheck('GB', bban) + bban;
  }

  /** One bank account whose IBAN, ABI/CAB/CIN, sort code, account number and BIC all agree. */
  function bankAccount(rng, locale) {
    const gb = rng.pick(FF.data['en-GB'].banks);
    const sortCode = rng.digits(6);
    const gbAccount = rng.digits(8);
    const routing = abaRouting(rng);
    if (locale === 'it') {
      const bank = rng.pick(FF.data.it.banks);
      const cab = rng.digits(5);
      const conto = '0000' + rng.digits(8);
      const iban = ibanIT(bank.abi, cab, conto);
      return { name: bank.name, bic: bank.bic, abi: bank.abi, cab, cin: iban[4], account: conto, sortCode, routing, iban };
    }
    const iban = ibanGB(gb.code, sortCode, gbAccount);
    if (locale === 'en-GB') return { name: gb.name, bic: gb.bic, account: gbAccount, sortCode, routing, iban };
    const us = rng.pick(FF.data['en-US'].banks);
    return { name: us.name, bic: us.bic, account: rng.digits(10), sortCode, routing, iban };
  }

  /** pagoPA "codice avviso": aux digit 3 + segregation code + 13-digit IUV base + mod-93 check digits. */
  function pagoPaNotice(rng) {
    const body = '3' + FF.pad(rng.int(1, 99)) + rng.digits(13);
    return body + FF.pad(mod(body, 93));
  }

  /** SEPA creditor identifier: CC + check digits + business code ZZZ + national id. */
  function creditorId(locale, piva, rng) {
    if (locale === 'it') return `IT${ibanCheck('IT', piva)}ZZZ${piva}`;
    const id = rng.digits(6);
    return `GB${ibanCheck('GB', id)}ZZZ${id}`;
  }

  function abaRouting(rng) {
    const d = (FF.pad(rng.int(1, 12)) + rng.digits(6)).split('').map(Number);
    const s = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5]);
    return d.join('') + ((10 - (s % 10)) % 10);
  }

  function genPassword(rng) {
    const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const L = 'abcdefghijkmnopqrstuvwxyz';
    const N = '23456789';
    const S = '!@#$%*?-_';
    const chars = [rng.pick(U), rng.pick(L), rng.pick(L), rng.pick(L), rng.pick(N), rng.pick(N), rng.pick(S), rng.pick(U)];
    while (chars.length < 13) chars.push(rng.pick(U + L + N));
    return chars[0] + rng.shuffle(chars.slice(1)).join('');
  }

  // ---------- Phones (fictional / reserved ranges where they exist) ----------

  function phones(locale, city, rng, D) {
    if (locale === 'it') {
      const m = rng.pick(D.mobilePrefixes) + rng.digits(7);
      const l = city.tel + rng.digits(10 - city.tel.length);
      return {
        mobile: [m, `+39${m}`, `${m.slice(0, 3)} ${m.slice(3)}`, `+39 ${m.slice(0, 3)} ${m.slice(3)}`, `0039${m}`],
        landline: [l, `+39${l}`, `${city.tel} ${l.slice(city.tel.length)}`, `+39 ${city.tel} ${l.slice(city.tel.length)}`],
      };
    }
    if (locale === 'en-GB') {
      const x = rng.digits(3);
      const m = `07700900${x}`; // Ofcom drama range
      let l;
      if (city.tel === '020') l = `0207946${'0' + x}`;
      else if (city.tel === '029') l = `0292018${'0' + x}`;
      else if (city.tel.length === 4) l = `${city.tel}4960${x}`;
      else l = `01632960${x}`;
      const intl = (n) => `+44${n.slice(1)}`;
      return {
        mobile: [m, intl(m), `07700 900${x}`, `+44 7700 900${x}`],
        landline: [l, intl(l), `${l.slice(0, 4)} ${l.slice(4, 7)} ${l.slice(7)}`],
      };
    }
    const mk = () => {
      const a = city.tel;
      const tail = `01${rng.digits(2)}`; // 555-0100..0199 is reserved for fiction
      return [`${a}555${tail}`, `(${a}) 555-${tail}`, `${a}-555-${tail}`, `+1${a}555${tail}`, `+1 ${a} 555 ${tail}`];
    };
    return { mobile: mk(), landline: mk() };
  }

  // ---------- Persona ----------

  FF.createPersona = function (seed, locale, settings = {}, ts = Date.now(), nested = false) {
    const rng = FF.makeRng(seed);
    const D = FF.data[locale] || FF.data.it;
    const isIT = locale === 'it';
    const gender = rng.bool() ? 'M' : 'F';
    const names = gender === 'M' ? D.male : D.female;
    const firstName = rng.pick(names);
    let middleName = rng.pick(names);
    if (middleName === firstName) middleName = names[(names.indexOf(firstName) + 1) % names.length];
    const lastName = rng.pick(D.last);
    const fullName = `${firstName} ${lastName}`;

    const now = today();
    const birthDate = new Date(now.getFullYear() - rng.int(22, 60), rng.int(0, 11), rng.int(1, 28));
    let age = now.getFullYear() - birthDate.getFullYear();
    if (now < new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate())) age--;

    const city = rng.pick(D.cities);
    const birthCity = rng.pick(D.cities);
    const street = rng.pick(D.streets);
    const houseNumber = String(rng.int(1, 150));
    const address2 = isIT ? `Scala ${rng.pick('ABC')}, Interno ${rng.int(1, 20)}` : `Apt ${rng.int(1, 40)}${rng.pick('ABCD')}`;
    const streetLine = isIT ? `${street}, ${houseNumber}` : `${houseNumber} ${street}`;

    const n = rng.int(10, 99);
    const rand = rng.chars(5, 'abcdefghijkmnpqrstuvwxyz23456789');
    const f = FF.slug(firstName);
    const l = FF.slug(lastName);
    const email = FF.template(settings.emailTemplate || '{first}.{last}{n}@example.com', {
      first: f, last: l, n, rand, ts, initial: f[0],
    });
    const domain = email.includes('@') ? email.split('@').pop() : 'example.com';
    const pec = `${f}.${l}@pec.${domain}`;
    const username = `${f}${l}${n}`;
    const password = settings.fixedPassword || genPassword(rng);

    const companyBase = rng.bool() ? lastName : `${rng.pick(D.companyWords)} ${lastName}`;
    const company = `${companyBase} ${rng.pick(D.companySuffix)}`;
    const website = `https://www.${FF.slug(companyBase)}.example.com`;
    const jobTitle = rng.pick(D.jobs);

    const card = rng.pick(FF.TEST_CARDS);
    const expMonth = rng.int(1, 12);
    const expYear = now.getFullYear() + rng.int(2, 5);
    const cvv = String(rng.int(1, 9)) + rng.digits(card.cvvLen - 1);

    const ph = phones(locale, city, rng, D);
    const cf = FF.codiceFiscale(firstName, lastName, birthDate, gender, birthCity.code);
    const piva = FF.partitaIva(rng);
    const vatGB = 'GB' + rng.digits(9);
    const sdi = rng.chars(7, FF.UPPER + FF.DIGITS);
    const bank = bankAccount(rng, locale);
    const { iban, bic } = bank;
    const pin = rng.digits(locale === 'it' ? 5 : locale === 'en-GB' ? 6 : 4);
    const otp = rng.digits(6);
    const memorable = rng.pick(D.memorable) + rng.int(10, 99);
    let motherMaiden = rng.pick(D.last);
    if (motherMaiden === lastName) motherMaiden = D.last[(D.last.indexOf(lastName) + 1) % D.last.length];
    const customerNumber = String(rng.int(1, 9)) + rng.digits(7);
    const postalAccount = '0000' + rng.digits(8);
    const enteCF = FF.partitaIva(rng);
    const pagopa = pagoPaNotice(rng);

    const p = {
      locale, gender, firstName, middleName, lastName, fullName, birthDate, age, city, birthCity,
      street, houseNumber, address2, streetLine, email, pec, username, password, company, website, jobTitle,
      card: { ...card, cvv, expMonth, expYear }, mobile: ph.mobile, landline: ph.landline,
      cf, piva, vatGB, sdi, iban, ibanSpaced: iban.replace(/(.{4})(?=.)/g, '$1 '), bic,
      bank, pin, otp, memorable, motherMaiden, customerNumber, postalAccount, enteCF, pagopa,
    };

    const dateFmt = locale === 'en-US' ? 'mm/dd/yyyy' : 'dd/mm/yyyy';
    p.vars = {
      first: firstName, last: lastName, firstName, lastName, fullName, middleName, email, pec, username, password,
      phone: ph.mobile[0], mobile: ph.mobile[0], landline: ph.landline[0], city: city.name, cap: city.cap, zip: city.cap,
      postalCode: city.cap, province: city.prov, region: city.region, country: D.country[0], street, houseNumber,
      address: streetLine, address2, company, jobTitle, website, cf, piva, sdi, iban, bic,
      cardNumber: card.number, cvv, birthDate: FF.formatDate(birthDate, dateFmt), age, n, rand, ts,
      today: FF.formatDate(now, dateFmt), isoToday: FF.isoDate(now),
      pin, otp, memorable, accountNumber: bank.account, sortCode: sortCodeOf(bank), bankName: bank.name,
      abi: bank.abi || '', cab: bank.cab || '', customerNumber,
    };

    p.summary = {
      locale,
      name: fullName,
      email,
      username,
      password,
      phone: ph.mobile[0],
      address: `${streetLine}, ${city.cap} ${city.name}${isIT ? ` (${city.prov})` : locale === 'en-US' ? `, ${city.prov}` : ''}`,
      birthDate: FF.formatDate(birthDate, dateFmt),
      company,
      cf: isIT ? cf : null,
      piva: isIT ? piva : null,
      iban,
      card: `${card.number} · ${FF.pad(expMonth)}/${FF.pad(expYear % 100)} · ${cvv}`,
      pin,
      memorable,
    };
    // A second, unrelated person for "beneficiary / payee / recipient" fields.
    if (!nested) {
      p.beneficiary = FF.createPersona((seed ^ 0x5bd1e995) >>> 0, locale, settings, ts, true);
      p.summary.beneficiary = p.beneficiary.fullName;
      p.summary.beneficiaryIban = p.beneficiary.iban;
    }
    return p;
  };

  function sortCodeOf(bank) {
    const s = bank.sortCode;
    return `${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4)}`;
  }

  // ---------- Value generators (keyed by rule id) ----------

  const IT_MONTHS = FF.data.it.months;
  const EN_MONTHS = FF.data['en-US'].months;
  const monthCandidates = (m) => [
    FF.pad(m), String(m), IT_MONTHS[m - 1], EN_MONTHS[m - 1], IT_MONTHS[m - 1].slice(0, 3), EN_MONTHS[m - 1].slice(0, 3),
  ];

  function paragraph(c, count) {
    const pool = c.rng.shuffle(c.D.sentences);
    const max = c.maxLength > 0 ? c.maxLength : Infinity;
    let out = '';
    for (const s of pool.slice(0, count)) {
      const next = out ? `${out} ${s}` : s;
      if (next.length > max) break;
      out = next;
    }
    return out || pool[0];
  }

  const hexColor = (rng) => '#' + rng.chars(6, '0123456789abcdef');
  const MORTGAGE_RE = /mutuo|mortgage|ipotec|immobile|property|\bcasa\b|\bhome\b|house/;

  /** Money amount as text candidates in the format the field/locale suggests ("1270,00", "1270", "1.270,00", ...). */
  function money(n, c, dec = 2) {
    const fixed = n.toFixed(dec);
    const [i, d] = fixed.split('.');
    const group = (sep) => i.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    const comma = /\d,\d{2}\b/.test(c.hint || '') || (c.locale === 'it' && !/\d\.\d{2}\b/.test(c.hint || ''));
    const whole = Number.isInteger(n) ? [i] : [];
    return comma
      ? [`${i},${d}`, ...whole, `${group('.')},${d}`, fixed]
      : [fixed, ...whole, `${group(',')}.${d}`, `${i},${d}`];
  }

  const ORDINALS = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
    prima: 1, primo: 1, seconda: 2, secondo: 2, terza: 3, terzo: 3, quarta: 4, quarto: 4, quinta: 5, quinto: 5,
    sesta: 6, sesto: 6, settima: 7, settimo: 7, ottava: 8, ottavo: 8, nona: 9, nono: 9, decima: 10, decimo: 10,
  };
  const CHAR_WORD = '(?:character|char|carattere|cifra|digit|lettera|letter|posizione|position)';

  /** 1-based position asked by "3rd character", "carattere n. 2", "last digit" (-1 = last). */
  function secretPosition(text) {
    let m = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th|a|o)? ${CHAR_WORD}\\b`)) ||
      text.match(new RegExp(`\\b${CHAR_WORD} (?:n |no |number |numero |nr )?(\\d{1,2})\\b`));
    if (m) return +m[1];
    m = text.match(new RegExp(`\\b([a-z]+) ${CHAR_WORD}\\b`));
    if (m && /^(last|ultim)/.test(m[1])) return -1;
    return (m && ORDINALS[m[1]]) || 1;
  }

  function secretSource(c) {
    const t = c.text;
    if (/\bpin\b|passcode|codice (segreto|personale)/.test(t)) return c.p.pin;
    if (/memorable|parola segreta|secret word|security word|informazion/.test(t)) return c.p.memorable;
    if (/password|parola d ordine/.test(t)) return c.p.password;
    if (/\botp\b|verification|verifica|\bsms\b|one ?time|\bcode\b|codice/.test(t)) return c.p.otp;
    return c.p.memorable;
  }

  function social(c) {
    const u = c.p.username;
    const slug = `${FF.slug(c.p.firstName)}-${FF.slug(c.p.lastName)}-${c.rng.int(100, 999)}`;
    if (/twitter|\bx com\b/.test(c.text)) return `https://x.com/${u}`;
    if (/github/.test(c.text)) return `https://github.com/${u}`;
    if (/gitlab/.test(c.text)) return `https://gitlab.com/${u}`;
    if (/facebook/.test(c.text)) return `https://www.facebook.com/${u}`;
    if (/instagram/.test(c.text)) return `https://www.instagram.com/${u}`;
    if (/tiktok/.test(c.text)) return `https://www.tiktok.com/@${u}`;
    if (/youtube/.test(c.text)) return `https://www.youtube.com/@${u}`;
    return `https://www.linkedin.com/in/${slug}`;
  }

  function ukLicence(c) {
    const b = c.p.birthDate;
    const sur = (FF.stripAccents(c.p.lastName).toUpperCase().replace(/[^A-Z]/g, '') + '99999').slice(0, 5);
    const month = b.getMonth() + 1 + (c.p.gender === 'F' ? 50 : 0);
    const yy = FF.pad(b.getFullYear() % 100);
    const initials = (c.p.firstName[0] + c.p.middleName[0]).toUpperCase();
    return `${sur}${yy[0]}${FF.pad(month)}${FF.pad(b.getDate())}${yy[1]}${initials}9${c.rng.chars(2, FF.UPPER)}`;
  }

  const G = {
    skip: () => FF.SKIP,
    pec: (c) => c.p.pec,
    email: (c) => c.p.email,
    password: (c) => c.p.password,
    codiceFiscale: (c) => c.p.cf,
    partitaIva: (c) => (c.locale === 'en-GB' ? [c.p.vatGB, c.p.vatGB.slice(2)] : [c.p.piva, 'IT' + c.p.piva]),
    sdi: (c) => c.p.sdi,
    iban: (c) => [c.p.iban, c.p.ibanSpaced],
    bic: (c) => [c.p.bic, c.p.bic + 'XXX'],
    sortCode: (c) => [sortCodeOf(c.p.bank), c.p.bank.sortCode],
    routingNumber: (c) => c.p.bank.routing,
    accountNumber: (c) => (c.maxLength > 0 ? c.p.bank.account.slice(-c.maxLength) : c.p.bank.account),
    ccName: (c) => [c.p.fullName.toUpperCase(), c.p.fullName],
    ccNumber: (c) => [c.p.card.number, c.p.card.number.replace(/(\d{4})(?=\d)/g, '$1 ')],
    ccType: (c) => [c.p.card.brand, c.p.card.brand.toUpperCase(), c.p.card.brand === 'Mastercard' ? 'MasterCard' : 'VISA', 'Credit card', 'Carta di credito'],
    ccCvv: (c) => c.p.card.cvv,
    ccExpMonth: (c) => monthCandidates(c.p.card.expMonth),
    ccExpYear: (c) => [String(c.p.card.expYear), FF.pad(c.p.card.expYear % 100)],
    ccExp: (c) => {
      const { expMonth: m, expYear: y } = c.p.card;
      if (c.kind === 'month' || c.kind === 'date') return new Date(y, m - 1, 1);
      const mm = FF.pad(m);
      const yy = FF.pad(y % 100);
      const list = [`${mm}/${yy}`, `${mm} / ${yy}`, `${mm}${yy}`, `${mm}/${y}`, `${mm}-${yy}`];
      if (/yyyy|aaaa/i.test(c.hint)) list.unshift(`${mm}/${y}`);
      return list;
    },
    otp: (c) => {
      const src = /\bpin\b|passcode|codice (segreto|personale)/.test(c.text) ? c.p.pin : c.p.otp;
      const len = c.maxLength >= 4 && c.maxLength <= 8 ? c.maxLength : src.length;
      return (src + c.p.otp + c.p.pin).slice(0, len);
    },
    coupon: (c) => c.D.coupon,
    birthPlace: (c) => c.p.birthCity.name,
    birthProvince: (c) => [c.p.birthCity.prov, c.p.birthCity.provName],
    birthCountry: (c) => c.D.country,
    birthDay: (c) => [FF.pad(c.p.birthDate.getDate()), String(c.p.birthDate.getDate())],
    birthMonth: (c) => monthCandidates(c.p.birthDate.getMonth() + 1),
    birthYear: (c) => String(c.p.birthDate.getFullYear()),
    birthDate: (c) => c.p.birthDate,
    age: (c) => c.p.age,
    docIssueDate: (c) => FF.addDays(today(), -c.rng.int(200, 1500)),
    docIssuer: (c) => ({ it: `Comune di ${c.p.city.name}`, 'en-US': 'U.S. Department of State', 'en-GB': 'HM Passport Office' })[c.locale],
    docType: () => ["Carta d'identità", 'Carta di identità', 'Carta identità', 'CIE', 'Identity card', 'ID card', 'National ID card', 'Passaporto', 'Passport'],
    passport: (c) => (c.locale === 'it' ? `Y${c.rng.chars(1, FF.UPPER)}${c.rng.digits(7)}` : c.rng.digits(9)),
    idCard: (c) => (c.locale === 'it' ? `CA${c.rng.digits(5)}${c.rng.chars(2, FF.UPPER)}` : c.rng.chars(2, FF.UPPER) + c.rng.digits(7)),
    driverLicense: (c) => {
      if (c.locale === 'it') return `U1${c.rng.digits(7)}${c.rng.chars(1, FF.UPPER)}`;
      if (c.locale === 'en-GB') return ukLicence(c);
      return c.rng.chars(1, FF.UPPER) + c.rng.digits(7);
    },
    ssn: (c) => {
      if (c.locale === 'it') return c.p.cf;
      if (c.locale === 'en-GB') {
        const d = c.rng.digits(6);
        return [`QQ${d}C`, `QQ ${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4)} C`];
      }
      let area = c.rng.int(100, 665);
      if (area === 666) area = 667;
      const g = FF.pad(c.rng.int(1, 99));
      const s = FF.pad(c.rng.int(1, 9999), 4);
      return [`${area}-${g}-${s}`, `${area}${g}${s}`];
    },
    taxId: (c) => {
      if (c.locale === 'it') return c.p.cf;
      if (c.locale === 'en-GB') return c.rng.digits(10);
      const d = c.rng.digits(9);
      return [`${d.slice(0, 2)}-${d.slice(2)}`, d];
    },
    gender: (c) => {
      const m = c.p.gender === 'M';
      const it = m ? ['M', 'Maschio', 'Uomo', 'Maschile'] : ['F', 'Femmina', 'Donna', 'Femminile'];
      const en = m ? ['Male', 'Man', 'M', 'Mr'] : ['Female', 'Woman', 'F', 'Ms'];
      return c.locale === 'it' ? it.concat(en) : en.concat(it);
    },
    maritalStatus: (c) => (c.locale === 'it' ? [c.p.gender === 'M' ? 'Celibe' : 'Nubile', ...c.D.marital] : c.D.marital),
    nationality: (c) => c.D.nationality,
    language: (c) => c.D.language,
    salutation: (c) => {
      const m = c.p.gender === 'M';
      const it = m ? ['Sig.', 'Signor', 'Sig', 'Dott.'] : ['Sig.ra', 'Signora', 'Dott.ssa'];
      const en = m ? ['Mr', 'Mr.', 'Dr.'] : ['Ms', 'Ms.', 'Mrs', 'Mrs.'];
      return c.locale === 'it' ? it.concat(en) : en.concat(it);
    },
    education: (c) => c.D.education,
    jobTitle: (c) => c.p.jobTitle,
    company: (c) => c.p.company,
    department: (c) => c.rng.pick(c.D.departments),
    website: (c) => c.p.website,
    social,
    ip: (c) => (/v ?6/.test(c.text) ? `2001:db8::${c.rng.int(1, 0xffff).toString(16)}` : `192.0.2.${c.rng.int(1, 254)}`),
    mac: (c) => `00:00:5E:00:53:${FF.pad(c.rng.int(0, 255).toString(16).toUpperCase())}`,
    domain: (c) => (/host/.test(c.text) ? `test-${c.rng.int(1, 99)}.example.com` : `${FF.slug(c.p.lastName)}-test.example.com`),
    phonePrefix: (c) => [c.D.dial, c.D.dial.slice(1), '00' + c.D.dial.slice(1), ...c.D.country],
    areaCode: (c) => c.p.city.tel,
    fax: (c) => c.p.landline,
    landline: (c) => c.p.landline,
    mobile: (c) => c.p.mobile,
    phone: (c) => c.p.mobile,
    houseNumber: (c) => c.p.houseNumber,
    address2: (c) => c.p.address2,
    postalCode: (c) => [c.p.city.cap, c.p.city.cap.replace(' ', '')],
    city: (c) => c.p.city.name,
    province: (c) => [c.p.city.prov, c.p.city.provName],
    region: (c) => (c.locale === 'en-US' ? [c.p.city.provName, c.p.city.prov] : [c.p.city.region]),
    country: (c) => c.D.country,
    latitude: (c) => (c.p.city.lat + (c.rng.next() - 0.5) * 0.02).toFixed(6),
    longitude: (c) => (c.p.city.lon + (c.rng.next() - 0.5) * 0.02).toFixed(6),
    street: (c) => (c.streetOnly ? c.p.street : c.p.streetLine),
    objectName: (c) => `${FF.capitalize(c.rng.pick(c.D.words))} ${c.rng.pick(c.D.objectWords)} ${c.rng.int(10, 99)}`,
    middleName: (c) => c.p.middleName,
    fullName: (c) => c.p.fullName,
    lastName: (c) => c.p.lastName,
    firstName: (c) => c.p.firstName,
    bareName: (c) => c.p.fullName,
    username: (c) => [c.p.username, c.p.username.replace(/\d+$/, ''), c.p.email],
    color: (c) => (c.kind === 'color' ? hexColor(c.rng) : c.rng.pick(c.D.colors)),
    time: (c) => `${FF.pad(c.rng.int(8, 18))}:${c.rng.pick(['00', '15', '30', '45'])}`,
    futureDate: (c) =>
      FF.addDays(today(), /scad|expir|valid|deadline/.test(c.text) ? c.rng.int(365, 365 * 6) : c.rng.int(7, 60)),
    date: (c) => FF.addDays(today(), c.rng.int(1, 30)),
    quantity: (c) => (/bambin|child|kid|infant|neonat|carico|dependan|dependen/.test(c.text) ? c.rng.int(0, 2) : c.rng.int(1, 4)),
    amount: (c) => {
      const monthly = /mensil|monthly|al mese|per month|a month|netto mese/.test(c.text);
      let n;
      if (/salar|stipend|reddito|income|\bral\b|revenue|fatturato|retribuzion|earning|wage/.test(c.text)) {
        n = monthly ? c.rng.int(15, 40) * 100 : c.rng.int(25, 60) * 1000;
      } else if (/affitto|\brent\b|spese|expenses|outgoings|uscite|canone/.test(c.text)) n = c.rng.int(4, 15) * 100;
      else n = c.rng.int(5, 200) * 10;
      return money(n, c);
    },
    percent: (c) => c.rng.int(5, 50),
    weight: (c) => c.rng.int(55, 90),
    height: (c) => c.rng.int(155, 195),
    subject: (c) => c.rng.pick(c.D.subjects),
    message: (c) => paragraph(c, c.kind === 'textarea' || c.kind === 'editable' ? c.rng.int(2, 4) : 1),
    search: (c) => c.rng.pick(c.D.searches),
    year: () => String(new Date().getFullYear()),
    month: (c) => monthCandidates(c.rng.int(1, 12)),
    day: (c) => String(c.rng.int(1, 28)),
    genericCode: (c) => c.rng.digits(c.maxLength >= 3 && c.maxLength < 8 ? c.maxLength : 6),

    // ---- Banking ----
    abi: (c) => c.p.bank.abi || c.rng.pick(FF.data.it.banks).abi,
    cab: (c) => c.p.bank.cab || c.rng.digits(5),
    cin: (c) => c.p.bank.cin || c.rng.chars(1, FF.UPPER),
    ibanCheck: (c) => c.p.iban.slice(2, 4),
    postalAccount: (c) => [c.p.postalAccount, c.p.postalAccount.replace(/^0+/, '')],
    bankName: (c) => c.p.bank.name,
    branch: (c) => (c.locale === 'it' ? `Filiale di ${c.p.city.name}` : `${c.p.city.name} branch`),
    pagopaNotice: (c) => {
      const v = /\biuv\b|univoco/.test(c.text) ? c.p.pagopa.slice(1) : c.p.pagopa;
      return [v, v.replace(/(.{4})(?=.)/g, '$1 ')];
    },
    enteCreditore: (c) => c.p.enteCF,
    cbill: (c) => c.rng.chars(5, FF.UPPER + FF.DIGITS),
    billNumber: (c) => c.rng.digits(18),
    codiceTributo: (c) => c.rng.pick(['1001', '1040', '4001', '4033', '6099', '3918', '3912', '1668']),
    annoRiferimento: () => String(new Date().getFullYear() - 1),
    rateazione: () => '0101',
    codiceEnte: (c) => (c.locale === 'it' ? c.p.city.code : 'H501'),
    sepaMandate: (c) => `MND-${new Date().getFullYear()}-${c.rng.digits(6)}`,
    creditorId: (c) => creditorId(c.locale, c.p.piva, c.rng),
    paymentReference: (c) => {
      const month = c.D.months[new Date().getMonth()];
      return FF.template(c.rng.pick(c.D.paymentRefs), {
        n: c.rng.int(10, 999), year: new Date().getFullYear(), month: FF.capitalize(month),
      });
    },
    loanAmount: (c) => money(MORTGAGE_RE.test(c.text) ? c.rng.int(80, 300) * 1000 : c.rng.int(5, 30) * 1000, c),
    propertyValue: (c) => money(c.rng.int(150, 500) * 1000, c),
    downPayment: (c) => money(c.rng.int(20, 80) * 1000, c),
    loanTerm: (c) => {
      const mortgage = MORTGAGE_RE.test(c.text);
      const years = mortgage ? c.rng.pick([15, 20, 25, 30]) : c.rng.pick([2, 3, 4, 5]);
      const months = years * 12;
      const inMonths = /mesi|months|\brate\b|instal|repayments|payments/.test(c.text);
      const inYears = /anni|years/.test(c.text);
      const y = [String(years), `${years} anni`, `${years} years`, `${months} mesi`, `${months} months`];
      const m = [String(months), `${months} mesi`, `${months} months`, `${years} anni`, `${years} years`];
      if (inMonths) return m;
      if (inYears) return y;
      return mortgage ? y : m;
    },
    installment: (c) => money(MORTGAGE_RE.test(c.text) ? c.rng.int(400, 1500) + c.rng.int(0, 99) / 100 : c.rng.int(150, 600) + c.rng.int(0, 99) / 100, c),
    interestRate: (c) => money(Math.round((1.5 + c.rng.next() * 6) * 100) / 100, c),
    loanPurpose: (c) => c.D.loanPurposes,
    balance: (c) => money(c.rng.int(1000, 80000) + c.rng.int(0, 99) / 100, c),
    kycNo: (c) => (c.locale === 'it' ? ['No', 'Non', 'NO'] : ['No', 'NO']),
    taxResidence: (c) => c.D.country,
    sourceOfFunds: (c) => c.D.fundsSources,
    accountPurpose: (c) => c.D.accountPurposes,
    employmentStatus: (c) => c.D.employment,
    accountType: (c) => (c.locale === 'en-US' ? ['Checking', 'Personal checking', ...c.D.accountTypes] : c.D.accountTypes),
    currency: (c) => c.D.currency,
    customerNumber: (c) => {
      const len = c.maxLength >= 5 && c.maxLength <= 12 ? c.maxLength : 8;
      return (c.p.customerNumber + c.p.otp).slice(0, len);
    },
    memorable: (c) => c.p.memorable,
    securityQuestion: (c) => c.D.securityQuestion,
    motherMaiden: (c) => c.p.motherMaiden,
    yearsDuration: (c) => c.rng.int(2, 15),
    secretChar: (c) => {
      const src = secretSource(c);
      const pos = secretPosition(c.text);
      return (pos < 0 ? src[src.length - 1] : src[pos - 1]) || src[0];
    },
  };

  FF.generate = (id, ctx) => (G[id] ? G[id](ctx) : undefined);

  /** Value for a field no rule recognised, based only on its input type. */
  FF.fallbackValue = function (kind, c) {
    switch (kind) {
      case 'email':
        return c.p.email;
      case 'tel':
        return c.p.mobile;
      case 'url':
        return c.p.website;
      case 'password':
        return c.p.password;
      case 'search':
        return c.rng.pick(c.D.searches);
      case 'number':
      case 'range':
        return null;
      case 'date':
      case 'datetime-local':
      case 'month':
      case 'week':
        return FF.addDays(today(), c.rng.int(1, 30));
      case 'time':
        return G.time(c);
      case 'color':
        return hexColor(c.rng);
      case 'textarea':
      case 'editable':
        return paragraph(c, c.rng.int(2, 4));
      default: {
        const im = (c.el.getAttribute('inputmode') || '').toLowerCase();
        if (im === 'numeric' || im === 'decimal' || im === 'tel') {
          return c.rng.digits(c.maxLength > 0 && c.maxLength < 10 ? c.maxLength : 6);
        }
        const dl = c.el.list;
        if (dl && dl.options && dl.options.length) {
          const values = [...dl.options].map((o) => o.value).filter(Boolean);
          if (values.length) return c.rng.pick(values);
        }
        const [w1, w2] = c.rng.shuffle(c.D.words);
        return `${FF.capitalize(w1)} ${w2}`;
      }
    }
  };

  FF.today = today;
})();
