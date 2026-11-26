# Filemon a Baucis

Moderní web studií na Korfu. Demo běží zdarma na GitHub Pages.

## Administrace kalendáře

Otevřete `admin.html`.

1. V centrálním režimu zadejte serverové heslo správce; místní PIN funguje jen v přechodném lokálním režimu.
2. Vyplňte studio, jméno hosta, příjezd a odjezd a zvolte **Přidat rezervaci**.
3. Existující rezervace upravíte tlačítkem **Uložit**, odstraníte tlačítkem **Smazat**. Žluté poptávky potvrďte tlačítkem **Schválit**.
4. V centrálním režimu každá změna aktualizuje `data/bookings.json` na GitHubu. Veřejný kalendář načítá společná data. V místním režimu změny zůstávají pouze v prohlížeči a administrace na to upozorňuje.
5. **Stáhnout zálohu** / **Nahrát zálohu**: soukromý JSON obsahující kontakty, uložte bezpečně. Nenahrávejte nešifrovanou zálohu do veřejného repozitáře.

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

## Centrální rezervace na GitHubu

Zdroj pravdy je `data/bookings.json` v hlavní větvi GitHubu. Worker je pouze autorizovaná zapisovací brána, žádná další databáze. Jeden commit obsahuje veřejnou obsazenost (studio, příjezd, odjezd, stav) a šifrovanou část `privateData` s úplnými údaji pro správce (AES-256-GCM, náhodné IV). Jména, telefony, e-maily a historie nových pobytů se nezapisují otevřeně. Starší veřejné commity mohou stále obsahovat dříve publikované údaje. Klíč je mimo GitHub; jeho ztráta znamená ztrátu přístupu k šifrované části. Uchovejte jej v bezpečné záloze, ne v repozitáři. Při kompromitaci klíče mohou být ohroženy i historické šifrované commity.

Veřejný kalendář čte API bez cache; správce zapisuje po ověření serverového hesla. Worker načte SHA aktuálního souboru a GitHub při zápisu kontroluje jeho shodu. Při souběžné poptávce znovu načte data a ověří obsazenost; úprava správcem se při konfliktu odmítne a načtou se novější data. Poptávka je žlutá až do schválení či smazání. Potvrzené pobyty jsou lososové v kalendáři a zelené v administraci. Při WhatsAppu se termín uloží před odesláním zprávy; návštěvník musí dokončit odeslání v aplikaci. Web3Forms oznamuje poptávku až po úspěšném zápisu. Pokud oznámení selže, termín zůstane v administraci. Schválení neodesílá automatický potvrzovací e-mail hostovi.

### Aktivace (jednorázově)

1. Stáhněte zálohu z administrace na počítači s aktuálními rezervacemi. Neodstraňujte lokální data. Nejdříve porovnejte zálohu s dosavadním JSONem.
2. V GitHub Settings → Developer settings → Fine-grained personal access tokens vytvořte token jen pro repozitář filabau s oprávněním Contents: Read and write (Metadata: Read). Nastavte expiraci a naplánujte obnovu. Nikdy jej nevkládejte do souborů webu.
3. Na Cloudflare vytvořte Turnstile widget pro hostname jiriflos-eng.github.io. Získejte veřejný site key a soukromý secret.
4. V klonu repozitáře spusťte `cd backend`, `npx wrangler login`, `npx wrangler deploy`. Dále nastavte Worker secrets: `npx wrangler secret put GITHUB_TOKEN`, `npx wrangler secret put ADMIN_TOKEN` (dlouhé náhodné heslo správce), `npx wrangler secret put BOOKING_DATA_KEY` (64 hex znaků, např. výstup `openssl rand -hex 32`), `npx wrangler secret put TURNSTILE_SECRET`. ADMIN_TOKEN i BOOKING_DATA_KEY vygenerujte nezávisle. Tajné hodnoty si bezpečně zálohujte.
5. Inicializujte kalendář z ověřené zálohy **před** aktivací veřejné stránky. Použijte `node backend/import-backup.mjs URL_WORKERU cesta-k-zaloze.json` z kořene repozitáře a zadejte ADMIN_TOKEN do skrytého terminálového vstupu (viz návod v souboru). Import pracuje s aktuálním SHA a vyžaduje výslovné potvrzení; odmítne přepsat již inicializovaný kalendář. Ověřte počty, termíny a správnost dat.
6. Nastavte veřejné `bookingApi.url` a `bookingApi.turnstileSiteKey` v `data/config.json` a nasaďte web. Přihlaste se do admin.html serverovým heslem. Ověřte poptávku z jiného prohlížeče, žlutý stav, konflikt a schválení. Stahujte pravidelné soukromé zálohy.

Do aktivace Workeru veřejný web čte publikovaný GitHub JSON (nikoli localStorage); administrace dočasně pracuje s lokálními daty a výslovně na to upozorňuje. Automatické žluté blokace nejsou do aktivace dostupné. Nikdy neukládejte tajné hodnoty do veřejné konfigurace. Web může mít po commitu zpoždění nasazení GitHub Pages, aktivní API však čte přímo hlavní větev.

### Prezentace rezervací ve veřejném kalendáři

V `data/config.json` nastavte `"calendar": {"displayMode": "name"}` pro zobrazení křestního jména (první slovo jména, bezpečný textový formát) v páscích potvrzených i čekajících rezervací. Hodnota `"status"` zobrazuje jen stav (Obsazeno / Čeká na schválení). Výchozí režim při chybě konfigurace nebo neznámé hodnotě je status. Stav je v obou režimech patrný z barvy a tooltipu. Worker čte nastavení z GitHubu, nikoli z parametru požadavku. Do veřejného JSONu se jména nikdy neukládají; v režimu name je první jméno veřejně dostupné přes API, proto tento režim používejte pouze pokud je zveřejnění hostům oznámeno a máte k němu odpovídající oprávnění. Plné jméno, telefon, e-mail a poznámky zůstávají v šifrované části a v administraci.

## Redakční systém webu

Otevřete `redakce.html` (odkaz v administraci rezervací). Přihlášení používá stávající serverové heslo ADMIN_TOKEN, které se drží pouze v paměti redakční stránky. Nevyžaduje další token ani hosting.

- **Texty stránek:** vyberte stránku a jazyk, klikněte na zvýrazněný text v živém náhledu, upravte jej a zvolte Použít v náhledu. Překlady se editují jednotlivě, automatický překlad není v této verzi součástí. Editovatelné klíče vycházejí z původních překladů. Rezervační formulář, navigace, strukturální prvky nejsou součástí editoru.
- **Fotogalerie:** všech šest původních alb. Přidání, přesun, změna pořadí (přetažením nebo šipkami), skrytí, nahrazení a odebrání fotografie z alba, popisky v sedmi jazycích. Pokud překlad popisku chybí, použije se český. Nahrávání JPEG, PNG, WebP, AVIF; nové fotografie se v prohlížeči převedou na JPEG, omezí rozměry a zbaví původních metadat. Nejvýše šest nových souborů na jednu publikaci. Odebrání odstraní položku z galerie, nikoliv fyzický soubor z GitHubu, protože může být použit jinde.
- **Publikace:** koncept je pouze v paměti do kliknutí na Publikovat změny. Worker ověřuje správce, povolené klíče a cesty, konflikt revizí a zapíše data/content.json, data/photos.json a nové JPEG jedním Git commitem. Soubory rezervací, konfigurace a programový kód CMS zapisovat nesmí. Veřejná změna se zobrazí po nasazení GitHub Pages. Pokud mezitím nastane jiná úprava obsahu, editor vyžádá nové načtení.
- **Návrat:** obnovujte jednotlivé soubory obsahu podle historie GitHubu; nevracejte celou větev, protože byste mohli přepsat novější rezervace. Záloha před CMS je v zaloha/pred-cms-2026-11-26.

### Úprava cen ubytování

V redakci vyberte Ceník a klikněte na číselnou částku příslušného měsíce. Cena se zadává v eurech za studio a noc, s nejvýše dvěma desetinnými místy, a platí pro všechny jazyky. Po použití v náhledu a publikaci se uloží do společného objektu `prices` v `data/content.json`. Rozpětí cen na úvodní stránce se automaticky odvodí z minima a maxima. Ceny klimatizace a transferů zatím zůstávají v textových popiscích. Tato změna nezasahuje do rezervačního systému.

### Rozsah rezervačního kalendáře

V `data/config.json` nastavte `calendar.seasonStart` a `calendar.seasonEnd` ve formátu MM-DD (např. "04-30" a "10-31", včetně obou dnů; stejný rozsah každý rok, pouze uvnitř jednoho kalendářního roku). `calendar.hidePastDays` (true/false) skryje uplynulé dny a celé uplynulé sezóny. `calendar.seasonsToShow` (1 až 3) určuje počet sezón v nabídce, nejvýše do konce druhého následujícího roku. Aktuální den se počítá podle času na Korfu (Europe/Athens). Neúplné týdny zachovávají správné dny týdne, dny mimo rozsah jsou prázdné. Změna ovlivní veřejný kalendář a validaci nových poptávek na serveru, neodstraňuje žádné existující rezervace ani neomezuje správce při jejich evidenci. Historická sezóna uložená v bookings.json zůstává jako výchozí při chybějících hodnotách. Neplatné nastavení nepřijímá nové poptávky. Změna sezóny nemění automaticky texty úvodní stránky ani ceny.
