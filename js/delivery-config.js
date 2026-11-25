// Pouze veřejná konfigurace. Hesla ani přístupové tokeny sem nepatří.
const INQUIRY_DELIVERY = Object.freeze({
  email: Object.freeze({
    provider: "formsubmit",
    endpoint: "https://formsubmit.co/ajax/jiripilnaj@seznam.cz",
    // Změňte na true až po potvrzení aktivace cílové adresy u FormSubmit
    // a ověření skutečné testovací poptávky z webu. Samotný přepínač nic neaktivuje.
    // Do té doby stránka nabídne ruční odeslání v poštovním programu.
    activated: false,
  }),
  whatsapp: Object.freeze({
    provider: "webhook",
    // Veřejný HTTPS endpoint vlastního serveru; prázdný znamená ruční WhatsApp.
    // Server ověřuje vstupy a omezuje zneužití, povoluje CORS pro tento web
    // a drží token WhatsApp Business API výhradně na serveru.
    // Přijímá JSON poptávky a vrací {accepted:true,messageId:"ID od poskytovatele"}.
    // Tato odpověď potvrzuje přijetí k odeslání, nikoli doručení; to ověřují webhooky.
    endpoint: "",
  }),
  timeoutMs: 20000,
});
