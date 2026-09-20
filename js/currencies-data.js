// Pure content: curated real-world currencies. No logic.

var CURRENCIES = [
    { code: "AED", name: "UAE Dirham" },
    { code: "AUD", name: "Australian Dollar" },
    { code: "BRL", name: "Brazilian Real" },
    { code: "CAD", name: "Canadian Dollar" },
    { code: "CHF", name: "Swiss Franc" },
    { code: "CNY", name: "Chinese Yuan" },
    { code: "CZK", name: "Czech Koruna" },
    { code: "DKK", name: "Danish Krone" },
    { code: "EUR", name: "Euro" },
    { code: "GBP", name: "British Pound" },
    { code: "HKD", name: "Hong Kong Dollar" },
    { code: "HUF", name: "Hungarian Forint" },
    { code: "IDR", name: "Indonesian Rupiah" },
    { code: "ILS", name: "Israeli Shekel" },
    { code: "INR", name: "Indian Rupee" },
    { code: "JPY", name: "Japanese Yen" },
    { code: "KRW", name: "South Korean Won" },
    { code: "MXN", name: "Mexican Peso" },
    { code: "NOK", name: "Norwegian Krone" },
    { code: "NZD", name: "New Zealand Dollar" },
    { code: "PLN", name: "Polish Zloty" },
    { code: "RON", name: "Romanian Leu" },
    { code: "RSD", name: "Serbian Dinar" },
    { code: "RUB", name: "Russian Ruble" },
    { code: "SEK", name: "Swedish Krona" },
    { code: "SGD", name: "Singapore Dollar" },
    { code: "THB", name: "Thai Baht" },
    { code: "TRY", name: "Turkish Lira" },
    { code: "USD", name: "US Dollar" },
    { code: "ZAR", name: "South African Rand" }
];

// Maps a locale region subtag to the matching entry in CURRENCIES, used to
// preselect a currency on the onboarding screen. Not exhaustive, just the
// regions that map onto the curated list above.
var CURRENCY_BY_REGION = {
    AE: "AED", AU: "AUD", BR: "BRL", CA: "CAD", CH: "CHF", CN: "CNY",
    CZ: "CZK", DK: "DKK",
    AT: "EUR", BE: "EUR", CY: "EUR", DE: "EUR", EE: "EUR", ES: "EUR",
    FI: "EUR", FR: "EUR", GR: "EUR", IE: "EUR", IT: "EUR", LT: "EUR",
    LU: "EUR", LV: "EUR", MT: "EUR", NL: "EUR", PT: "EUR", SI: "EUR",
    SK: "EUR",
    GB: "GBP", HK: "HKD", HU: "HUF", ID: "IDR", IL: "ILS", IN: "INR",
    JP: "JPY", KR: "KRW", MX: "MXN", NO: "NOK", NZ: "NZD", PL: "PLN",
    RO: "RON", RS: "RSD", RU: "RUB", SE: "SEK", SG: "SGD", TH: "THB",
    TR: "TRY", US: "USD", ZA: "ZAR"
};
