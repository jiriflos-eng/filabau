# Filemon a Baucis

Moderní web studií na Korfu. Demo běží zdarma na GitHub Pages.

## Administrace kalendáře

Otevřete `admin.html`.

1. Při prvním spuštění si nastavíte PIN (zůstane v prohlížeči na tom počítači).
2. Vyplňte studio, jméno hosta, příjezd a odjezd a zvolte **Přidat rezervaci**.
3. Existující rezervace upravíte v příslušném řádku tlačítkem **Uložit**, případně odstraníte tlačítkem **Smazat**. Rok přepnete nad tabulkou.
4. Pobyty i seznam úprav se ukládají v tomto prohlížeči.
5. **Stáhnout zálohu** / **Nahrát zálohu** - JSON soubor, kdybyste měnili počítač.

Veřejný kalendář na webu čte `data/bookings.json`. Úpravy v administraci platí hned na stejném počítači. Aby je viděli hosté na internetu, nahrajte staženou zálohu jako `data/bookings.json` (nebo to později napojíme na živé úložiště).

Po změně příjezdu se prázdný nebo příliš brzký odjezd předvyplní na následující den. Vybraný pozdější odjezd se zachová. Vyplněná hodnota poskytne nativnímu kalendáři výchozí měsíc a rok; nejbližší povolený odjezd je den po příjezdu. Pravidlo platí pro nový pobyt i úpravu řádku. Administrace umožňuje pobyt od jedné noci. Konkrétní vzhled a ovládání kalendáře určuje prohlížeč a operační systém.

## Příjezd, odjezd a navazující pobyty

Příjezd vybarvuje pravou polovinu políčka dne, odjezd levou. Dny mezi nimi jsou obsazené celé. Dva pobyty ve stejném studiu mohou sdílet den odjezdu a příjezdu; například pobyt 1.–7. července může bez překrytí navazovat na pobyt 7.–12. července. Překrytí obsazených nocí je blokované při výběru termínu i při ukládání v administraci.

Host vybírá příjezd a odjezd kliknutím v řádku studia. Volná část dne umožňuje příjezd po odjezdu jiného hosta nebo odjezd před jeho příjezdem. Baucis a Filemon se vybírají nezávisle a poptávka nadále vyžaduje alespoň 5 nocí. Barevné poloviny popisují dostupnost; nestanovují konkrétní čas předání studia.

Záznamy nadále používají datum `arrival` a `departure`; stávající data není potřeba převádět ani posouvat. V původním lokálním režimu poptávka kalendář nemění. Po připojení centrálního API vznikne čekající rezervace před předáním notifikace.

## Odesílání poptávky

GitHub Pages poskytuje statický web. JavaScript může odeslat požadavek externí službě; samotný GitHub Pages e-mail ani zprávu WhatsApp neodesílá. Veřejná konfigurace je v `data/config.json`, načítá ji `js/delivery-config.js`, adaptér je v `js/delivery.js`.

### E-mail – Web3Forms

Přímé AJAX odesílání bez poštovního klienta používá Web3Forms. Veřejný identifikátor `email.accessKey` je v `data/config.json`. Cílová adresa se nastavuje výhradně v administraci Web3Forms a v JSON již není. Při změně příjemce ověřte správný klíč a adresu v dashboardu.

1. Otevřete `aktivace_emailu.html` a odešlete test.
2. Ověřte skutečné doručení zprávy v cílové schránce.
3. Nastavte `email.activated` na `true` v JSON a znovu nasaďte web.
4. Otestujte běžnou rezervační poptávku.

Pokud je email.activated false, veřejná e-mailová volba je vypnutá, WhatsApp zůstává funkční. Potvrzení API znamená přijetí k odeslání, nikoli doručení nebo potvrzení rezervace. Kontaktní údaje a text se při odeslání předávají službě Web3Forms. Veřejný klíč není tajný token; používejte ochranu proti spamu a sledujte kvótu. Při nejasném výsledku se požadavek automaticky neopakuje.

### WhatsApp – číslo v data/config.json

Číslo se čte z `whatsapp.phone` (mezinárodní formát bez `+`). Výchozí volba otevře `https://wa.me/<číslo>?text=…` s připravenou zprávou. Šablony `whatsapp.template`, `whatsapp.stayTemplate` a `whatsapp.messageTemplate` lze upravit v JSONu. Podporují zástupné hodnoty `{stays}`, `{name}`, `{phone}`, `{email}`, `{messageBlock}`, v bloku pobytu `{studio}`, `{arrival}`, `{departure}`, `{nights}` a v doplňující zprávě `{message}`. Hvězdičky označují tučný text WhatsAppu, `\n` je nový řádek. Zpráva obsahuje obě studia, pokud jsou vybrána, a je standardně česky pro hostitele; rozhraní webu zůstává vícejazyčné. Návštěvník ji musí odeslat ve WhatsAppu. Web po otevření odkazu hlásí pouze tento další krok a neslibuje úspěšné odeslání.

Pro automatické odeslání je připravený klientský adaptér na vlastní HTTPS serverovou funkci. **Serverová funkce ani WhatsApp Business účet nejsou součástí tohoto balíčku.** Běžný GET/POST na `wa.me` tuto funkci nenahrazuje. Token WhatsApp Business API patří pouze na server, nikdy do veřejných souborů GitHub Pages.

Server přijme `POST` JSON: `{subject, text, name, phone, email, message, stays:[{studio,arrival,departure,nights}], requestId}`. Příjemce nastaví pevně na serveru, ověří vstupy, omezí zneužití, povolí CORS pro veřejný web a podle `requestId` zabrání duplicitám. Odesílá z autorizovaného firemního čísla přes Meta API, nikoli z účtu návštěvníka. Podle pravidel účtu a konverzace může být potřeba schválená šablona zprávy. Úspěšnou odpověď vrátí teprve po přijetí u poskytovatele, jako HTTP 2xx a `{accepted:true,messageId:"skutečné ID zprávy"}`. Skutečné doručení se případně sleduje samostatnými stavovými webhooky. Teprve URL takto připraveného serveru zapište do `whatsapp.endpoint`.

### Zdroje k odesílání

- [Web3Forms API](https://docs.web3forms.com/getting-started/api-reference)
- [Web3Forms – diagnostika](https://docs.web3forms.com/getting-started/troubleshooting)
- [WhatsApp Click to Chat](https://faq.whatsapp.com/5913398998672934)
- [WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview/)
- [HTML datumové pole](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date)

## Výběr termínu ve dvou krocích

Viditelný průvodce vede hosta od kliknutí na příjezd ke kliknutí na odjezd a funguje i na mobilu. Po výběru příjezdu se při pohybu myší ukazuje žlutý předběžný rozsah pouze směrem k pozdějšímu odjezdu a jen v řádku právě vybíraného studia. Tooltip u kurzoru radí, co kliknutí provede, a při výběru odjezdu uvádí počet nocí. Výběr lze zrušit příslušným tlačítkem; po platném výběru se zobrazí odkaz **Pokračovat k formuláři**.

## Ceny

Ceník na původním Google Sites je v obrázku. Do dema čísla nehádáme - hosté se zeptají v poptávce. Klimatizace 4 €/den a transfer 40 / 80 € jsou z původního webu.

## Centrální poptávky a schvalování (Cloudflare)

Backend drží celý kalendář jako soukromý JSON v transakčním SQLite Durable Objectu. Veřejné GET /calendar vrací termíny, studio a stav bez jmen a kontaktů; admin GET/PUT /admin vyžaduje serverové heslo a kontroluje revizi. POST /pending ověřuje Turnstile a obsazenost atomicky. Čekající poptávka blokuje noci do schválení nebo smazání. Při WhatsAppu vzniká poptávka před otevřením odkazu, skutečné odeslání WhatsAppu nelze ověřit. Notifikace Web3Forms následuje po uložení; při její chybě zůstává poptávka v administraci. Schválení mění stav, automatický potvrzovací e-mail hostovi se neposílá.

### Aktivace

1. Stáhněte zálohu ze současné administrace na počítači s aktuálními rezervacemi. Původní data nemažte.
2. Na Cloudflare vytvořte Turnstile widget pro hostname jiriflos-eng.github.io. Získejte veřejný site key a soukromý secret.
3. V terminálu v klonu repozitáře spusťte `cd backend`, `npx wrangler login`, `npx wrangler deploy`. Pak `npx wrangler secret put ADMIN_TOKEN` (náhodné heslo, např. výstup `openssl rand -hex 32`) a `npx wrangler secret put TURNSTILE_SECRET`. Tajné hodnoty nikdy necommitujte. URL Workeru je ve výstupu deploy.
4. Do data/config.json na GitHubu zapište bookingApi.url a bookingApi.turnstileSiteKey. Po nasazení se přihlaste do admin.html serverovým heslem a odsouhlaste inicializaci ze správného prohlížeče nebo nahrajte zálohu. Dokud není centrální JSON inicializovaný, veřejný kalendář se nezobrazí jako volný. Ověřte počty, termíny a schvalování.
5. Proveďte zkušební poptávku z jiného prohlížeče, ověřte žlutý stav, konflikt a schválení. V administraci pravidelně stahujte zálohu (obsahuje soukromé kontakty). Ponechte data/bookings.json jako původní zálohu; nové kontakty nepatří do veřejného GitHubu.

Prázdné bookingApi.url znamená starý lokální režim; funkční Web3Forms zůstává, ale automatický žlutý blok pro všechny návštěvníky ještě není aktivní. Nikdy neukládejte soukromé heslo ani Turnstile secret v data/config.json.
