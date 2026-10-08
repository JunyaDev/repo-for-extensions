/* Form Filler – field classification rules (Italian + English keywords).
 * Rules are tested against normalized text (see FF.normalize) in order; the first match wins.
 * "weak" rules only win if no later source (name, placeholder, ...) gives a specific match. */
(() => {
  'use strict';
  const FF = globalThis.__FF;
  if (!FF || FF.classify) return;

  const BIRTH = '(birth|nascita|\\bdob\\b|\\bbday\\b|\\bnat[oa]\\b|\\bborn\\b|compleanno|\\bnasc\\b)';
  const EXP = '(\\bexp(iry|iration|ires|ire)?\\b|scadenza|\\bscad\\b|\\bvalid (thru|through|until|to)\\b)';
  const re = (s) => new RegExp(s);

  const RULES = [
    // Fields that must never be filled
    { id: 'skip', re: /captcha|honeypot|honey pot|leave (this )?(field )?(blank|empty)|lasciare? (vuoto|in bianco)|non compilare|do not fill|bot field|anti ?spam/ },

    // Banking: single characters of a secret ("2nd character of your memorable word", "Cifra 3 del PIN")
    { id: 'secretChar',
      re: /\b\d{1,2}(st|nd|rd|th|a|o)? (character|char|carattere|cifra|digit|lettera|letter|posizione|position)\b|\b(character|char|carattere|cifra|digit|lettera|letter|posizione|position) (n |no |number |numero |nr )?\d{1,2}\b|\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|prima|primo|seconda|secondo|terza|terzo|quarta|quarto|quinta|quinto|sesta|sesto|settima|settimo|ottava|ottavo|nona|nono|decima|decimo|ultima|ultimo) (character|char|carattere|cifra|digit|lettera|letter)\b/,
      not: /\b\d{1,2} ?(digit|cifra|cifre|character|char|carattere|caratteri|lettera|letter)s? (code|codice|pin|number|numero|otp|passcode|verification|security)\b/ },
    { id: 'memorable', re: /memorable|parola segreta|risposta (segreta|di sicurezza|alla domanda)|security answer|secret (answer|word)|answer to (your |the )?(security|secret) question/ },
    { id: 'securityQuestion', re: /domanda (segreta|di sicurezza)|security question|secret question/ },
    { id: 'motherMaiden', re: /maiden name|cognome (da nubile )?(della )?madre|mother s (maiden )?(name|surname)|nome da nubile|cognome da nubile/ },
    { id: 'customerNumber', re: /codice (cliente|titolare|di adesione|identificativo cliente|contratto)|numero (cliente|contratto|di adesione)|customer (number|id|no|reference|code)|client (number|id|no|code)|membership number|\bndg\b|\bcif\b/ },

    // Banking: KYC / anti-money-laundering questions (risk questions are answered "No")
    { id: 'kycNo', kinds: ['radio', 'checkbox', 'select'],
      re: /politicamente espost|politically exposed|\bpep\b|persona espost|fatca|\bus person\b|u s person|us citizen|cittadin[oa] (statunitense|americano|usa|degli stati uniti)|green card|(residen|cittadin)\w* (fiscale )?(negli |in )?(usa|stati uniti|united states)|sanction|sanzion|bankrupt|fallimen|insolven|criminal|penal[ei]|condann|protest|riciclaggio|money laundering|per conto (di )?terzi|on behalf of (a )?third|third part(y|ies)|(altr[aeio]|divers[ao]|other|another|additional|second) (residenz|cittadinanz|nazionalit|tax residen|citizenship|nationalit)|doppia cittadinanza|dual (citizenship|nationality)|residente fiscale (in|di) (altri|un altro|altro)/ },
    { id: 'taxResidence', re: /residenza fiscale|tax residen(ce|cy)|fiscal residen|country of tax/ },
    { id: 'sourceOfFunds', re: /(fonte|origine|provenienza) (dei |del |delle )?(fondi|patrimonio|reddito|redditi|denaro|somme|disponibilita)|sources? of (funds|wealth|income)/ },
    { id: 'accountPurpose', re: /scopo (e natura )?(del |dello )?(rapporto|conto)|natura e scopo|purpose of (the )?(account|relationship|banking relationship)|motivo (dell )?apertura|reason for opening|account purpose|intended use of (the )?account/ },
    { id: 'employmentStatus', re: /condizione (professionale|lavorativa|occupazionale)|employment (status|type|situation)|tipo (di )?(contratto|impiego|occupazione)|stato occupazionale|situazione lavorativa|contract type|occupational status|working status/ },
    { id: 'accountType', re: /tipo (di |del )?conto|account type|tipologia (di |del )?conto|type of account/ },
    { id: 'currency', re: /\bvaluta\b|currency|\bdivisa\b/, not: /\bdata\b|\bdate\b/ },

    // Accounts
    { id: 'pec', re: /\bpec\b|posta elettronica certificata|e ?mail certificata/ },
    { id: 'email', re: /e ?mail|\bmail\b|posta elettronica|indirizzo di posta|courriel|correo/ },
    { id: 'password', re: /password|passwd|\bpwd\b|\bpass\b|passphrase|passcode|parola (d )?ordine|chiave (di )?accesso|\bpw\b/ },

    // Banking: payment slips, F24, SEPA (before codice fiscale: "codice fiscale ente creditore")
    { id: 'enteCreditore', re: /ente creditore|codice fiscale (dell )?ente|\bcf ente\b/ },
    { id: 'pagopaNotice', re: /codice (di |dell )?avviso|avviso (di )?pagamento|numero (dell )?avviso|pagopa|\biuv\b|identificativo univoco (di )?versamento/ },
    { id: 'cbill', re: /\bcbill\b|codice sia\b/ },
    { id: 'billNumber', re: /(numero|codice|identificativo) (della |del )?(bolletta|bollettino)|bill (number|code|id)/ },
    { id: 'codiceTributo', re: /codice tributo|cod tributo|\btributo\b/ },
    { id: 'annoRiferimento', re: /anno (di )?riferimento|\banno rif\b|periodo (di )?riferimento|reference year|tax year/ },
    { id: 'rateazione', re: /rateazione|\brateaz/ },
    { id: 'codiceEnte', re: /codice (ente|comune|catastale)|\bcod ente\b/ },
    { id: 'sepaMandate', re: /mandat[oe]|\bumr\b|unique mandate/, not: /\bdata\b|\bdate\b/ },
    { id: 'creditorId', re: /creditor (id|identifier|identification)|identificativo (del )?creditore|codice (identificativo )?(del )?creditore|\bsci\b|creditor scheme/ },
    { id: 'paymentReference', re: /causale|payment reference|transfer reference|riferimento (del |di |dell )?(pagamento|bonifico|operazione)|descrizione (del |dell )?(pagamento|bonifico|operazione)|remittance|payment (description|details)|reference for (the )?(payee|beneficiary|recipient)|message (to|for) (the )?(payee|beneficiary|recipient)|your reference|their reference|payee reference|^reference$/ },

    // Italian / tax identifiers
    { id: 'codiceFiscale', re: /codice fiscale|codicefiscale|cod fisc|\bc f\b|\bcf\b(?! (\d|field|form))|fiscal code|tax code|\bcodfis/ },
    { id: 'partitaIva', re: /partita iva|partitaiva|\bp ?iva\b|\bvat\b|codice iva|\bp i\b|vatnumber/ },
    { id: 'sdi', re: /\bsdi\b|codice (sdi|destinatario|univoco|ufficio)|\bcod (sdi|destinatario)\b|recipient code/ },

    // Bank accounts. Holder/beneficiary names first: "Intestatario del conto corrente" is a name, not an IBAN.
    { id: 'fullName',
      re: /intestatari[oa]|titolare (del |della )?(conto|rapporto)|\btitolare\b|account holder|account name|nome (del |della )?(titolare|beneficiario|intestatario)|beneficiari[oa]|beneficiary|\bpayee\b|\bordinante\b|recipient name|nome (del )?destinatario|name of (the )?(payee|beneficiary|recipient|account holder)/,
      not: /\biban\b|account (number|no)|\bnumero\b|\bnumber\b|sort ?code|\bbic\b|swift|\bbank\b|\bbanca\b|e ?mail|indirizzo|address|telefono|phone|\btel\b|codice|\bcode\b|citta|city|\bcap\b|post ?code|\bzip\b|reference|riferimento|causale|importo|amount|carta|\bcard\b|nascita|birth|paese|country|nazione/ },
    { id: 'postalAccount', re: /conto corrente postale|\bc c postale\b|\bccp\b|conto bancoposta|conto postale/ },
    { id: 'accountNumber', re: /account (number|no|nr)|\bacct (number|no)\b|numero (di |del )?conto( corrente)?|\bn (di )?conto\b|numero c c\b/ },
    { id: 'iban', re: /\biban\b|coordinate bancarie|conto corrente|bank account|\bc c bancario\b/ },
    { id: 'ibanCheck', re: /cin eur|check digits|cifre di controllo/ },
    { id: 'abi', re: /\babi\b/ },
    { id: 'cab', re: /\bcab\b/ },
    { id: 'cin', re: /\bcin\b/ },
    { id: 'bic', re: /\bbic\b|\bswift\b/ },
    { id: 'sortCode', re: /sort ?code/ },
    { id: 'routingNumber', re: /routing|\baba\b/ },
    { id: 'bankName', re: /bank name|nome (della )?banca|\bbanca\b|istituto (di credito|bancario)|\bbank\b/ },
    { id: 'branch', re: /\bfiliale\b|\bbranch\b|\bsportello\b/ },

    // Identity documents (before card rules: "carta d'identità" contains "carta")
    { id: 'docIssueDate', re: /(\bdata\b|\bdate\b).*(rilascio|emissione|issue)|(rilascio|emissione|\bissued?\b).*(\bdata\b|\bdate\b)|date of issue|issued on|rilasciat[oa] il/ },
    { id: 'docIssuer', re: /rilasciat[oa] da|ente (di )?rilascio|issued by|issuing (authority|office|country|state)|autorita (di )?rilascio/ },
    { id: 'futureDate', re: re(`(document|documento|passport|passaporto|licen[cs]e|patente|identita).*${EXP}|${EXP}.*(document|documento|passport|passaporto|licen[cs]e|patente|identita)`) },
    { id: 'docType', re: /tipo (di )?documento|document type|tipo doc\b|\bid type\b|type of (id|document)/ },
    { id: 'passport', re: /passport|passaporto/ },
    { id: 'idCard', re: /carta (d )?identita|carta di identita|identity card|\bid card\b|\bcie\b|documento (di )?(identita|riconoscimento)|numero (del )?documento|document (number|no)|\bdoc (number|no|nr)\b|national id/ },
    { id: 'driverLicense', re: /patente|driver ?s? licen[cs]e|driving licen[cs]e|licen[cs]e (number|no)/ },

    // Payment cards
    { id: 'ccType', re: /card ?type|tipo (di )?carta|circuito|card brand|\bcc type\b/ },
    { id: 'ccName', re: /card ?holder|name on (the )?card|nome (sulla|della|titolare( della)?) carta|(intestatario|titolare) (della )?carta|\bcc name\b|card name/ },
    { id: 'ccCvv', re: /\bcvv|\bcvc|\bcv2|\bcsc\b|\bcvn\b|security code|codice (di )?sicurezza|card code|card verification|verification value/ },
    { id: 'ccExpMonth', re: re(`${EXP}.*(month|mese|\\bmm\\b)|(month|mese)\\b.*${EXP}|\\b(card|cc) month\\b|\\bexp m\\b`), not: /\b(yy|aa|yyyy|aaaa)\b/ },
    { id: 'ccExpYear', re: re(`${EXP}.*(year|anno|\\byy\\b|\\byyyy\\b|\\baa\\b|\\baaaa\\b)|(year|anno)\\b.*${EXP}|\\b(card|cc) year\\b|\\bexp y\\b`), not: /\bmm\b/ },
    { id: 'ccExp', re: re(`(card|carta|\\bcc\\b).*${EXP}|${EXP}|\\bmm (yy|aa|yyyy|aaaa)\\b`) },
    { id: 'ccNumber', re: /card ?(number|no|num|nr)|numero (della |di )?carta|\bcc ?(number|num|no)\b|credit ?card|carta di credito|\bpan\b|cardnumber|\bccn\b|\bcc\b/ },

    // One-time codes, coupons
    { id: 'otp', re: /\botp\b|one ?time|verification code|codice (di )?(verifica|conferma|attivazione|controllo)|\bpin\b|\b2fa\b|\bmfa\b|auth(entication)? code|\btoken\b|sms code|codice sms/ },
    { id: 'coupon', re: /coupon|promo|voucher|codice sconto|discount code|gift ?card|\bbuono\b|codice promozionale|referral|codice invito|invite code/ },

    // Banking: loans and mortgages (before "age": "Durata del mutuo (anni)")
    { id: 'yearsDuration', re: /da quanti anni|anni (di |presso |nell |nella )?(anzianita|servizio|lavoro|residenza|attivita)|anzianita|years (at|with|in) (current |your |this |the )?(address|employer|job|company|residence|role|position|bank)|how (long|many years)|time at (current )?(address|employer|job)|years of (service|employment)/ },
    { id: 'loanTerm', re: /(durata|\bterm\b|periodo|tenor)\b.*(mutuo|prestito|finanziamento|loan|mortgage|rimborso|repayment|credito|piano)|(mutuo|prestito|finanziamento|loan|mortgage|repayment)\b.*(durata|\bterm\b|periodo|tenor)|numero (di |delle )?rate|number of (monthly )?(instal?ments|repayments|payments)|\btenor\b|durata (in )?(mesi|anni)|term (in )?(months|years)/ },
    { id: 'installment', re: /\brata\b|instal?ment|monthly (payment|repayment)|repayment amount/ },
    { id: 'loanAmount', re: /(importo|amount|ammontare|somma|capitale) (del |dello |of the |of )?(mutuo|prestito|finanziamento|loan|mortgage|credito|fido)|(mutuo|prestito|finanziamento|loan|mortgage) amount|importo richiesto|amount (to |you want to |you d like to )?borrow|how much .*borrow|capitale richiesto|somma richiesta|borrowing amount/ },
    { id: 'propertyValue', re: /valore (dell |della )?(immobile|casa|abitazione|proprieta)|property (value|price)|prezzo (di acquisto|dell immobile|della casa)|purchase price|home value|valore commerciale/ },
    { id: 'downPayment', re: /anticipo|down ?payment|\bdeposit\b|caparra|contributo (proprio|personale)|mezzi propri/, not: /\bdata\b|\bdate\b/ },
    { id: 'interestRate', re: /\btasso\b|interest rate|rate of interest|\btan\b|\btaeg\b|\bapr\b|\baer\b|\bspread\b/ },
    { id: 'loanPurpose', re: /finalita|scopo (del |dello )?(prestito|finanziamento|mutuo)|loan purpose|purpose of (the )?loan|motivo (del )?(prestito|finanziamento)|destinazione (del )?(finanziamento|prestito)|what is the loan for/ },
    { id: 'balance', re: /\bsaldo\b|\bbalance\b|disponibilita|available (funds|balance)|giacenza|patrimonio|net worth|\bassets\b|risparmi|\bsavings\b/, not: /\bdata\b|\bdate\b/ },

    // Birth
    { id: 'birthPlace', re: re(`(luogo|citta|comune|place|city|town|localita).*${BIRTH}|${BIRTH}.*(luogo|citta|comune|place|city|town|localita)|nat[oa] a\\b|born in|\\bpob\\b`) },
    { id: 'birthProvince', re: re(`(provincia|\\bprov\\b|province|county).*${BIRTH}|${BIRTH}.*(provincia|\\bprov\\b|province|county)`) },
    { id: 'birthCountry', re: re(`(stato|nazione|paese|country).*${BIRTH}|${BIRTH}.*(stato|nazione|paese|country)`) },
    { id: 'birthDay', re: re(`${BIRTH}.*(\\bday\\b|giorno|\\bgg\\b|\\bdd\\b)|(\\bday\\b|giorno|\\bgg\\b|\\bdd\\b).*${BIRTH}`) },
    { id: 'birthMonth', re: re(`${BIRTH}.*(month|\\bmese\\b|\\bmm\\b)|(month|\\bmese\\b).*${BIRTH}`) },
    { id: 'birthYear', re: re(`${BIRTH}.*(year|\\banno\\b|\\byyyy\\b|\\baaaa\\b)|(year|\\banno\\b).*${BIRTH}|year born`) },
    { id: 'birthDate', re: re(`${BIRTH}|date of birth|data di nascita|\\bborn on\\b`) },
    { id: 'age', re: /\beta\b|\bage\b|years old|\banni\b(?! di)|how old/ },

    // Government ids
    { id: 'ssn', re: /\bssn\b|social security|national insurance|\bnino?\b/ },
    { id: 'taxId', re: /tax ?id|\btin\b|taxpayer|\bein\b|\butr\b|codice tributario|\bnif\b/ },

    // Personal attributes
    { id: 'gender', re: /\bsesso\b|gender|\bsex\b|\bgenere\b/ },
    { id: 'maritalStatus', re: /stato civile|marital|civil status|relationship status/ },
    { id: 'nationality', re: /nazionalita|cittadinanza|nationality|citizenship/ },
    { id: 'language', re: /\blingu[ae]\b|language|idioma|madrelingua/ },
    { id: 'education', re: /titolo di studio|education|degree|istruzione|\blaurea\b|qualification/ },
    { id: 'jobTitle', re: /job ?title|\bjob\b|mansione|qualifica|professione|occupazione|occupation|profession|\bposizione\b|\bposition\b|\bruolo\b|\brole\b|\bincarico\b|\bcarica\b|designation|\blavoro\b/ },
    { id: 'salutation', re: /salutation|honorific|appellativo|\btitolo\b|\btitle\b|\bprefix\b|forma di cortesia|\bmr\b/, kinds: ['select', 'radio'] },

    // Web / network
    { id: 'social', re: /linkedin|twitter|facebook|instagram|github|gitlab|tiktok|youtube|\bx com\b/ },
    { id: 'website', re: /web ?site|\bsito\b|homepage|home page|\burl\b|\bweb\b|\blink\b|portfolio/ },
    { id: 'ip', re: /\bip\b|ip address|indirizzo ip|ipv4|ipv6/ },
    { id: 'mac', re: /\bmac\b( address)?/ },
    { id: 'domain', re: /\bdomain\b|dominio|hostname|host ?name|\bhost\b|\bfqdn\b/ },

    // Phones
    { id: 'phonePrefix', re: /prefisso|country (calling )?code|dial(l?ing)? code|calling code|phone code|international prefix|(phone|tel) prefix|prefix (phone|tel)/ },
    { id: 'areaCode', re: /area code/ },
    { id: 'fax', re: /\bfax\b/ },
    { id: 'landline', re: /landline|telefono fisso|\bfisso\b|home phone|work phone|office phone|telefono (di )?(casa|ufficio|abitazione)|business phone|day ?time phone/ },
    { id: 'mobile', re: /mobile|cellulare|\bcell\b|cellphone|smartphone|whatsapp|\bmob\b|\bsms\b/ },
    { id: 'phone', re: /phone|telefono|\btel\b|\btelef|recapito tel|contact number|numero di contatto/ },

    // Address
    { id: 'houseNumber', re: /civico|house ?(number|no|nr)|street ?(number|no|nr)|building ?(number|no|nr)|\bn civ|\bnr civ|\bciv\b/ },
    { id: 'address2', re: /address ?(line )?(2|two)|\baddr ?2\b|\bapt\b|apartment|\bsuite\b|\bflat\b|\binterno\b|\bscala\b|\bpiano\b|appartamento|\bpresso\b|\bc o\b|care of|complemento|\bline ?2\b|indirizzo ?2|\bunit (number|no)\b|building name|\bedificio\b|\bpalazzina\b/ },
    { id: 'postalCode', re: /\bcap\b|\bc a p\b|codice postale|avviamento postale|postal ?code|post ?code|\bzip\b|zip ?code|zipcode|\bplz\b/ },
    { id: 'city', re: /\bcity\b|\bcitta\b|\bcomune\b|\btown\b|localita|locality|municipality|\bmunicipio\b|\bsuburb\b|frazione|\bville\b|\bciudad\b/ },
    { id: 'province', re: /provincia|\bprov\b|province|\bcounty\b|\bcontea\b/ },
    { id: 'country', re: /country|nazione|\bpaese\b|\bstato\b|\bnation\b|\bpais\b/ },
    { id: 'region', re: /\bregione\b|\bregion\b|\bstate\b|stato federato|\bterritory\b/ },
    { id: 'latitude', re: /latitud|\blat\b/ },
    { id: 'longitude', re: /longitud|\blng\b|\blon\b/ },
    { id: 'street', re: /indirizzo|street|\bvia\b|\baddress\b|\baddr\b|\bstrada\b|\bpiazza\b|\bviale\b|\bresidenza\b|domicilio|ubicazione|\bsede\b|recapito postale|\broad\b|\bdireccion\b/ },

    // Organisation
    { id: 'company', re: /company|azienda|aziendale|societa|\bditta\b|ragione sociale|denominazione|organi[sz]ation|organizzazione|\bimpresa\b|employer|datore di lavoro|business name|\bente\b|\bfirm\b|agency|agenzia|\bcorp\b/ },
    { id: 'department', re: /department|dipartimento|\breparto\b|\bufficio\b|divisione|\bdivision\b|\bdept\b/ },

    // Names
    { id: 'objectName', re: /\b(product|project|event|item|file|group|team|list|campaign|store|shop|page|app|application|document|folder|repo|repository|board|channel|server|network|device|pet|brand|workspace|site) ?name|nome (del |della |dello |dell |di )?(prodotto|progetto|evento|gruppo|file|squadra|lista|campagna|negozio|pagina|app|applicazione|documento|cartella|marca|marchio|dispositivo|sito)\b/ },
    { id: 'middleName', re: /middle ?name|secondo nome|\bmname\b|additional name|middle initial|\bmiddle\b/ },
    { id: 'fullName', re: /full ?name|nome (e )?cognome|cognome (e )?nome|nome completo|nominativo|your name|contact name|\breferente\b|account holder|intestatario|beneficiario|beneficiary|recipient|\bdestinatario\b|complete name|name (and|&) surname|first (and|&) last( name)?|\bfullname\b|\bname surname\b/ },
    { id: 'lastName', re: /last ?name|\blname\b|surname|family ?name|cognome|second ?name|maiden name|apellido|nachname/ },
    { id: 'firstName', re: /first ?name|\bfname\b|given ?name|forename|nome proprio|nome di battesimo|\bprenom|\bvorname\b|\bnombre\b/ },
    { id: 'username', re: /user ?name|\buser ?id\b|userid|\blogin\b|nome utente|\butente\b|nickname|\bnick\b|\bhandle\b|screen ?name|display ?name|^user$|\balias\b/ },
    { id: 'bareName', re: /\bname\b|\bnome\b|\bnom\b/, weak: true },

    // Misc values
    { id: 'color', re: /\bcolou?r\b|colore|\btinta\b/ },
    { id: 'futureDate', re: /check ?out|departure|partenza|scadenza|expir|deadline|valid (until|thru)|valido fino|end date|data (di )?fine|return date|data (di )?ritorno/ },
    { id: 'time', re: /\btime\b|\bora\b|orario|\bhh mm\b|\bhour\b/, weak: true },
    { id: 'date', re: /\bdate\b|\bdata\b|check ?in|arrival|arrivo|appuntamento|appointment|start date|data (di )?inizio/, weak: true },
    { id: 'quantity', re: /\bqty\b|quantity|quantita|\bpezzi\b|\bguests?\b|\badults?\b|\bchildren\b|\bkids\b|\bospiti\b|\badulti\b|\bbambini\b|\bpersone\b|partecipanti|\brooms?\b|\bcamere\b|\bseats?\b|\bposti\b|\btickets?\b|\bbiglietti\b|number of|numero (di )?(persone|ospiti|adulti|bambini|camere|pezzi|partecipanti|posti|biglietti|dipendenti)|\bemployees\b|\bdipendenti\b|a carico|dependants|dependents/ },
    { id: 'amount', re: /amount|importo|\bprice\b|prezzo|\bcost\b|\bcosto\b|\btotal\b|\btotale\b|budget|salary|stipendio|\bral\b|reddito|income|\bfee\b|tariffa|\bsomma\b|donazione|donation|\beur\b|\beuro\b|\busd\b|\bgbp\b|revenue|fatturato|\bcanone\b/ },
    { id: 'percent', re: /percent|percentuale|\bsconto\b|discount|tax rate|aliquota|%/ },
    { id: 'weight', re: /\bpeso\b|\bweight\b|\bkg\b/ },
    { id: 'height', re: /altezza|height|statura|\bcm\b/ },
    { id: 'subject', re: /\boggetto\b|subject|\btitolo\b|\btitle\b|\btopic\b|argomento|headline|\bheading\b|\bmotivo\b|\breason\b/ },
    { id: 'message', re: /messag|commento|comment|\bnote\b|\bnotes\b|\bnota\b|descrizione|description|\bbio\b|biography|about (me|you|yourself)|richiesta|request|feedback|\btesto\b|\btext\b|\bbody\b|content|contenuto|\bdomanda\b|question|details|dettagli|osservazioni|indicazioni|informazioni aggiuntive|additional information|\bremarks?\b|summary|riepilogo|cover letter|lettera|presentazione|inquiry|enquiry/ },
    { id: 'search', re: /\bsearch\b|\bcerca\b|ricerca|\bquery\b|^q$|keywords?|parol[ae] chiave|\bfind\b|\btrova\b/ },
    { id: 'year', re: /\banno\b|\byear\b|\byyyy\b|\baaaa\b/, weak: true },
    { id: 'month', re: /\bmese\b|\bmonth\b/, weak: true },
    { id: 'day', re: /\bgiorno\b|\bday\b|\bgg\b|\bdd\b/, weak: true },
    { id: 'genericCode', re: /codice|\bcode\b|\bcod\b|\bid\b|identifier|identificativo|numero|number|\bnum\b|\bnr\b|matricola|\bref(erence)?\b|riferimento|\bpratica\b|\border\b|ordine|ticket|serial|seriale|\bsku\b/, weak: true },
  ];

  // WHATWG autocomplete tokens → rule id
  const AUTOCOMPLETE = {
    name: 'fullName', 'honorific-prefix': 'salutation', 'given-name': 'firstName', 'additional-name': 'middleName',
    'family-name': 'lastName', nickname: 'username', username: 'username', 'new-password': 'password',
    'current-password': 'password', 'one-time-code': 'otp', 'organization-title': 'jobTitle', organization: 'company',
    'street-address': 'street', 'address-line1': 'street', 'address-line2': 'address2', 'address-line3': 'address2',
    'address-level3': 'city', 'address-level2': 'city', 'address-level1': 'province', country: 'country',
    'country-name': 'country', 'postal-code': 'postalCode', 'cc-name': 'ccName', 'cc-given-name': 'firstName',
    'cc-family-name': 'lastName', 'cc-number': 'ccNumber', 'cc-exp': 'ccExp', 'cc-exp-month': 'ccExpMonth',
    'cc-exp-year': 'ccExpYear', 'cc-csc': 'ccCvv', 'cc-type': 'ccType', 'transaction-amount': 'amount',
    language: 'language', bday: 'birthDate', 'bday-day': 'birthDay', 'bday-month': 'birthMonth', 'bday-year': 'birthYear',
    sex: 'gender', url: 'website', impp: 'website', tel: 'phone', 'tel-country-code': 'phonePrefix', 'tel-national': 'phone',
    'tel-area-code': 'areaCode', 'tel-local': 'phone', email: 'email',
  };

  FF.fromAutocomplete = function (attr) {
    const tokens = String(attr || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return null;
    const field = tokens[tokens.length - 1];
    let id = AUTOCOMPLETE[field] || null;
    if (id === 'phone') {
      if (tokens.includes('fax')) id = 'fax';
      else if (tokens.includes('home') || tokens.includes('work')) id = 'landline';
      else if (tokens.includes('mobile')) id = 'mobile';
    }
    return id;
  };

  // "gg/mm/aaaa"-style format hints would otherwise look like day/month/year keywords.
  const DATE_FORMAT_TOKENS = /\b(gg|dd|mm|aaaa|yyyy|aa|yy)( (gg|dd|mm|aaaa|yyyy|aa|yy)){2}\b/g;

  /**
   * @param {Array<[string, string]>} sources  [sourceName, rawText] ordered by trust
   * @param {string} kind  field kind (text, select, radio, ...)
   * @returns {{id: string, src: string, weak?: boolean} | null}
   */
  FF.classify = function (sources, kind) {
    let weakHit = null;
    for (const [src, raw] of sources) {
      const text = FF.normalize(raw).replace(DATE_FORMAT_TOKENS, ' datefmt ');
      if (!text) continue;
      for (const r of RULES) {
        if (r.kinds && !r.kinds.includes(kind)) continue;
        if (!r.re.test(text) || (r.not && r.not.test(text))) continue;
        if (r.weak) {
          if (!weakHit) weakHit = { id: r.id, src, weak: true };
          break;
        }
        return { id: r.id, src };
      }
    }
    return weakHit;
  };

  FF.RULE_IDS = RULES.map((r) => r.id);
})();
