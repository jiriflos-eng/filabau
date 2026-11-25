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

## Příjezd, odjezd a navazující pobyty

Příjezd vybarvuje pravou polovinu políčka dne, odjezd levou. Dny mezi nimi jsou obsazené celé. Dva pobyty ve stejném studiu mohou sdílet den odjezdu a příjezdu; například pobyt 1.–7. července může bez překrytí navazovat na pobyt 7.–12. července. Překrytí obsazených nocí je blokované při výběru termínu i při ukládání v administraci.

Host vybírá příjezd a odjezd kliknutím v řádku studia. Volná část dne umožňuje příjezd po odjezdu jiného hosta nebo odjezd před jeho příjezdem. Baucis a Filemon se vybírají nezávisle a poptávka nadále vyžaduje alespoň 5 nocí. Barevné poloviny popisují dostupnost; nestanovují konkrétní čas předání studia.

Záznamy nadále používají datum `arrival` a `departure`; stávající data není potřeba převádět ani posouvat. Poptávka přes WhatsApp či e-mail rezervaci sama do kalendáře nezapisuje.

## Výběr termínu ve dvou krocích

Viditelný průvodce vede hosta od kliknutí na příjezd ke kliknutí na odjezd a funguje i na mobilu. Po výběru příjezdu se při pohybu myší ukazuje žlutý předběžný rozsah pouze směrem k pozdějšímu odjezdu a jen v řádku právě vybíraného studia. Tooltip u kurzoru radí, co kliknutí provede, a při výběru odjezdu uvádí počet nocí. Výběr lze zrušit příslušným tlačítkem; po platném výběru se zobrazí odkaz **Pokračovat k formuláři**.

## Ceny

Ceník na původním Google Sites je v obrázku. Do dema čísla nehádáme - hosté se zeptají v poptávce. Klimatizace 4 €/den a transfer 40 / 80 € jsou z původního webu.
