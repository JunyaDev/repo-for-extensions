# Form Filler – test data (IT / EN)

Browser extension (Manifest V3, Chrome/Edge/Brave and Firefox ≥ 121) that fills every form field on a page with
realistic **test data chosen from the field's meaning** — its label, `name`/`id`, placeholder, `autocomplete`,
`aria-*` attributes or nearby text — in **Italian** or **English** (US/UK).

## Install

**Chrome / Edge / Brave:** open `chrome://extensions`, enable *Developer mode*, click *Load unpacked*, select this folder.

**Firefox:** open `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* → pick `manifest.json`
(temporary add-ons are removed on restart; for a permanent install sign it with `web-ext sign`).

## Use

| Action | How |
| --- | --- |
| Fill every field on the page (all frames) | `Alt+Shift+F`, popup *Fill page*, or right-click → *Fill all fields on this page* |
| Fill only the form you're in (whole page if no field is focused) | `Alt+Shift+E`, popup *Focused form*, or right-click → *Fill this form* |
| Fill a single field | right-click the field → *Fill this field* |
| Clear | popup *Clear*, or right-click → *Clear this form* |

The popup shows the generated identity (name, email, password, phone, address, codice fiscale, IBAN, test card…);
click a value to copy it. Turn on **Keep same identity** for multi-step forms (registration → login → profile) so
every step gets the same person. Filled fields flash **green** (recognised), **orange** (generic value) or
**blue** (custom rule).

## What it generates

One consistent fictitious person per fill (email derived from the name, birth date matching age and codice fiscale,
CAP/province/phone prefix matching the city, …):

- **Italian:** nome, cognome, codice fiscale (valid check char, from name/birth date/birthplace), partita IVA (valid),
  IBAN IT (valid CIN + check digits), PEC, codice SDI, CAP, provincia (sigla), comune, regione, cellulare/fisso.
- **English (US/UK):** names, addresses, ZIP/postcode, state/county, phones in the reserved fictional ranges
  (US 555-01xx, UK Ofcom drama numbers), SSN/NI number, GB IBAN, sort code, ABA routing number.
- **Common:** email, username, strong password (or a fixed one), dates (birth/future/issue) in the format the
  placeholder asks for (`gg/mm/aaaa`, `MM/DD/YYYY`, …), payment-gateway test cards (`4111…`, `4242…`, `5555…`) with
  expiry/CVV, company, job title, website, IP (192.0.2.0/24 doc range), MAC, OTP, coupon, quantities, amounts,
  messages/subjects, colors, and sample files for `<input type=file>` (PNG/JPG/GIF/PDF/TXT/CSV/… matching `accept`).

### Banking pack

- **Accounts:** one bank account per identity whose IBAN, ABI/CAB/CIN + 12-digit conto (IT), sort code + account number
  (UK), BIC and bank name all agree; US routing (valid ABA checksum) and account number; conto corrente postale.
- **Transfers:** fields about a *beneficiario / payee / recipient* (by label, name or the section heading above them)
  get a **second, different person** with their own valid IBAN/BIC/bank; *ordinante / intestatario* stay yours.
  Causale / payment reference, amounts in the field's format (`1270,00` vs `1270.00`), currency, execution date.
- **Italian payments:** pagoPA codice avviso (18 digits, mod-93 check) / IUV, codice fiscale ente creditore,
  bollettino number, CBILL, F24 (codice tributo, anno di riferimento, rateazione, codice ente/comune),
  SEPA mandate ID and creditor identifier (valid check digits).
- **Loans / mortgages:** realistic loan amount, property value, down payment, term (matches selects like "20 anni" /
  "60 months"), interest rate, monthly instalment, purpose, balance, monthly vs annual income; income/age brackets in
  selects (`15.000 - 30.000 €`, `Oltre 50k`) are matched by range.
- **KYC / AML:** PEP, FATCA/US person, sanctions, third-party, other tax residence… answered **No** (a box saying
  "I am *not* a PEP" gets ticked, "I am a PEP" stays unticked); source of funds, account purpose, employment status,
  account type, tax residence, mother's maiden name, security question/answer.
- **Login:** customer number, PIN and OTP (consistent per identity), **on-screen PIN keypads** (scrambled digits are
  clicked), "2nd / 5th / 7th character of your memorable word / password / PIN" inputs or selects.
- **Split inputs:** card number, IBAN, sort code, OTP, phone or date spread over several short boxes get one value
  distributed across them.
- **Guarded / masked inputs:** if a field throws away a directly-set value, it is retyped with real key events
  (keydown/keypress/beforeinput/input/keyup); the *Simulate real typing* option does this for every field.
- **Iframes:** the language is detected once in the top page, so payment iframes get the same person.

The PIN, memorable word and beneficiary (name + IBAN) are shown in the popup. `test/banking.html` covers all of the
above.

### Flutter web apps

Flutter draws its UI on a canvas, so a Flutter page has no form fields in the DOM: only the field you clicked gets a
hidden `<input>`. On Flutter pages the extension therefore switches on Flutter's accessibility tree (the hidden
"Enable accessibility" button, as screen readers do; invisible, stays on until reload), which exposes every field
with its label. Fields are then filled one at a time: focus → wait until Flutter connects the field → set the value,
so the value reaches the app's state (not only the screen). Checkboxes, switches and radios are clicked; dropdowns are
opened and an item is picked (by label, or by recognising the options, e.g. province codes). Nothing is left focused.

Limits: only fields Flutter has built are reachable (long lazy lists: scroll first); date-picker dialogs and fully
custom widgets without accessibility info are not handled. Filling is sequential (a few hundred ms per field).
`test/flutter-app` is a Flutter test app.

Field handling respects `type`, `maxlength`, `minlength`, `min`/`max`/`step` and `pattern` (if the value doesn't
match, a matching string is generated from the regex). Selects and radio groups pick the option matching the
identity (province, country, gender, birth day/month/year, card expiry…) or a random valid one; consent/privacy
boxes are always accepted. Values are set through native setters with `input`/`change`/`blur` events so React,
Vue, Angular and jQuery validators see them. Open shadow DOM and iframes are covered.

Skipped on purpose: hidden/off-screen fields (honeypots), disabled and read-only fields, CAPTCHA fields. Exceptions:
empty date pickers, and fields that are read-only only until focused (a common anti-autofill trick) are filled.
Focus and scroll position are restored after every fill.

## Options

Data language (auto-detect from page `lang`, domain and text; or forced IT / EN-US / EN-GB), email template
(e.g. `me+{rand}@yourdomain.com` to receive the emails), fixed password, overwrite existing values, invisible
fields, checkbox policy, file attachments, contenteditable editors, highlighting, console debug table, and
**custom rules**:

```
# regex (tested on label, name, id, placeholder) = value
coupon|codice sconto = TEST10
codice (cliente|utente) = CL-{n}{rand}
newsletter = false
^note$ = {skip}
```

## Files

```
manifest.json         MV3 manifest (service worker in Chrome, background scripts in Firefox)
background.js         context menus, shortcuts, badge
shared/settings.js    defaults + storage
shared/runner.js      injects content scripts into all frames and runs fill/clear
content/core.js       seeded RNG, text normalisation, date formats, regex → string generator
content/data.js       IT / US / UK names, cities (with Belfiore codes), streets, texts
content/generators.js identity + codice fiscale / P.IVA / IBAN / phones + per-field generators
content/rules.js      IT+EN keyword rules and autocomplete mapping → field type
content/samples.js    sample upload files
content/filler.js     field discovery, label extraction, classification, value setting
content/flutter.js    Flutter web support (accessibility tree, sequential focus-and-fill)
content/track.js      remembers the right-clicked element (for "Fill this form/field")
popup/, options/      UI (English and Italian via _locales)
test/test-form.html   test page (IT/EN forms, iframe, shadow DOM, constraints)
test/banking.html     banking test page (transfers, pagoPA/F24, mortgage, KYC, keypad, UK payee, split fields)
test/harness.js       headless harness used by both test pages
test/flutter-app/     Flutter web test app (source)
```

`test/test-form.html?harness&seed=42&locale=en-US` (or `banking.html?harness&typing=1`) runs the filler directly in the page (no extension needed) and
writes the results as JSON into `#ff-results`; useful for checking detection changes in headless Chrome.
