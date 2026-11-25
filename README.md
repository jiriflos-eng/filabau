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

Záznamy nadále používají datum `arrival` a `departure`; stávající data není potřeba převádět ani posouvat. Poptávka přes WhatsApp či e-mail rezervaci sama do kalendáře nezapisuje.

## Odesílání poptávky

GitHub Pages poskytuje statický web. JavaScript může odeslat požadavek externí službě; samotný GitHub Pages e-mail ani zprávu WhatsApp neodesílá. Veřejná konfigurace je v `js/delivery-config.js`, adaptér v `js/delivery.js`.

### E-mail na jiripilnaj@seznam.cz

Je připravené odeslání pomocí `POST` na AJAX endpoint služby FormSubmit. **Výchozí `activated: false` záměrně ponechává ruční otevření e-mailového programu, dokud provozovatel nepotvrdí příjemce a neověří skutečné doručení.**

1. Nahrajte přiložené soubory a otevřete na webu `aktivace_emailu.html`.
2. Odešlete z ní technický test a potvrďte aktivační e-mail ve schránce příjemce. Tato stránka skutečně odesílá; náhledy v distribučním ZIPu nikoli.
3. Po aktivaci odešlete technický test znovu a ověřte jeho přijetí ve schránce.
4. Změňte `email.activated` na `true`, nahrajte konfiguraci a vynuceně obnovte rezervační stránku.
5. Odešlete vlastní zkušební poptávku a ověřte jak potvrzení na stránce, tak došlý e-mail s termínem, kontaktem a číslem poptávky. Tím ověříte i AJAX cestu. Po aktivaci se na veřejné stránce předvolí e-mail.

Při automatickém odesílání se kontaktní údaje a text předávají službě FormSubmit. Zelené potvrzení znamená přijetí k odeslání, nikoli potvrzené doručení do schránky či rezervaci termínu. Host musí dál dostat osobní potvrzení termínu. Automatický potvrzovací e-mail hostovi tato verze neposílá (FormSubmit `_autoresponse` není pro AJAX podporován).

Aktivační odpověď, chybná odpověď nebo časový limit se nevydávají za úspěch. Vyplněné údaje zůstávají zachované. Při nejasném výsledku se požadavek automaticky neopakuje, aby nevznikaly duplicity. Opakované kliknutí během odesílání je blokované; opakovaná totožná úspěšná poptávka je blokovaná do změny údajů nebo obnovení stránky. Číslo poptávky zůstává pro opakování stejného pokusu stejné, ale FormSubmit negarantuje potlačení duplicit podle tohoto čísla.

FormSubmit je vnější služba. Živé doručení ani chování CAPTCHA nebyly při přípravě souborů ověřovány skutečnou zprávou. Případné odmítnutí služby zobrazí kontaktní alternativy. Při změně cílové schránky je nutná nová aktivace a současná aktualizace kontaktů v `js/site.js`, `js/delivery-config.js`, `rezervace.html` a `aktivace_emailu.html`.

### WhatsApp na +420 725 866 862

Výchozí volba otevře `https://wa.me/420725866862?text=…` s připravenou zprávou. Návštěvník ji musí odeslat ve WhatsAppu. Web po otevření odkazu hlásí pouze tento další krok a neslibuje úspěšné odeslání.

Pro automatické odeslání je připravený klientský adaptér na vlastní HTTPS serverovou funkci. **Serverová funkce ani WhatsApp Business účet nejsou součástí tohoto balíčku.** Běžný GET/POST na `wa.me` tuto funkci nenahrazuje. Token WhatsApp Business API patří pouze na server, nikdy do veřejných souborů GitHub Pages.

Server přijme `POST` JSON: `{subject, text, name, phone, email, message, stays:[{studio,arrival,departure,nights}], requestId}`. Příjemce nastaví pevně na serveru, ověří vstupy, omezí zneužití, povolí CORS pro veřejný web a podle `requestId` zabrání duplicitám. Odesílá z autorizovaného firemního čísla přes Meta API, nikoli z účtu návštěvníka. Podle pravidel účtu a konverzace může být potřeba schválená šablona zprávy. Úspěšnou odpověď vrátí teprve po přijetí u poskytovatele, jako HTTP 2xx a `{accepted:true,messageId:"skutečné ID zprávy"}`. Skutečné doručení se případně sleduje samostatnými stavovými webhooky. Teprve URL takto připraveného serveru zapište do `whatsapp.endpoint`.

### Zdroje k odesílání

- [FormSubmit AJAX](https://formsubmit.co/ajax-documentation)
- [Aktivace a nápověda FormSubmit](https://formsubmit.co/help)
- [Dokumentace FormSubmit včetně omezení autoresponse](https://formsubmit.co/documentation)
- [WhatsApp Click to Chat](https://faq.whatsapp.com/5913398998672934)
- [WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview/)
- [HTML datumové pole](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date)

## Výběr termínu ve dvou krocích

Viditelný průvodce vede hosta od kliknutí na příjezd ke kliknutí na odjezd a funguje i na mobilu. Po výběru příjezdu se při pohybu myší ukazuje žlutý předběžný rozsah pouze směrem k pozdějšímu odjezdu a jen v řádku právě vybíraného studia. Tooltip u kurzoru radí, co kliknutí provede, a při výběru odjezdu uvádí počet nocí. Výběr lze zrušit příslušným tlačítkem; po platném výběru se zobrazí odkaz **Pokračovat k formuláři**.

## Ceny

Ceník na původním Google Sites je v obrázku. Do dema čísla nehádáme - hosté se zeptají v poptávce. Klimatizace 4 €/den a transfer 40 / 80 € jsou z původního webu.
