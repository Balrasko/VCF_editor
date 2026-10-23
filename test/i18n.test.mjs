import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createI18n, resolveLocale, translations } from "../i18n.js";

test("matches saved and browser preferences, including regional language tags", () => {
  assert.equal(resolveLocale(["de", "fr-FR"]), "de");
  assert.equal(resolveLocale(["es-ES", "fr-CA", "de-DE"]), "fr");
  assert.equal(resolveLocale([null, "unsupported", "SK-sk"]), "sk");
  assert.equal(resolveLocale(["EN_us"]), "en");
  assert.equal(resolveLocale(["es-ES", "ja"]), "en");
  assert.equal(resolveLocale([]), "en");
});

test("all languages cover the same messages and interpolation values", () => {
  const keys = Object.keys(translations.en).sort();
  const placeholders = (message) => [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [locale, dictionary] of Object.entries(translations)) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys, locale);
    for (const key of keys) {
      const reference = translations.en[key];
      const expected = placeholders(typeof reference === "string" ? reference : reference.other);
      const message = dictionary[key];
      const forms = typeof message === "string" ? [message] : Object.values(message);
      if (typeof reference === "object") assert.ok(message.other, `${locale}.${key}.other`);
      for (const form of forms) {
        assert.ok(form.trim(), `${locale}.${key}`);
        assert.deepEqual(placeholders(form), expected, `${locale}.${key}`);
      }
    }
  }
});

test("all HTML translation hooks refer to existing messages", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const [, key] of html.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)) {
    assert.ok(Object.hasOwn(translations.en, key), key);
  }
});

test("uses each language's plural rules, including Slovak few and French zero", () => {
  const i18n = createI18n("en");
  assert.equal(i18n.t("contactCount", { count: 1 }), "1 contact");
  assert.equal(i18n.t("contactCount", { count: 2 }), "2 contacts");
  i18n.setLocale("sk");
  assert.equal(i18n.t("contactCount", { count: 0 }), "0 kontaktov");
  assert.equal(i18n.t("contactCount", { count: 1 }), "1 kontakt");
  assert.equal(i18n.t("contactCount", { count: 3 }), "3 kontakty");
  assert.equal(i18n.t("contactCount", { count: 5 }), "5 kontaktov");
  assert.equal(i18n.t("changedCount", { count: 2 }), "Upravené 2 telefónne čísla");
  i18n.setLocale("de");
  assert.equal(i18n.t("phoneCount", { count: 1 }), "1 Telefonnummer");
  assert.equal(i18n.t("phoneCount", { count: 2 }), "2 Telefonnummern");
  i18n.setLocale("fr");
  assert.equal(i18n.t("phoneCount", { count: 0 }), "0 numéro de téléphone");
  assert.equal(i18n.t("phoneCount", { count: 2 }), "2 numéros de téléphone");
});

test("interpolates user data literally and formats numbers in the selected locale", () => {
  const i18n = createI18n("de");
  assert.equal(i18n.t("contactCount", { count: 1234 }), "1.234 Kontakte");
  assert.equal(i18n.t("fileLoaded", { name: "<b>{count} $&.vcf</b>" }), "Datei <b>{count} $&.vcf</b> geladen");
  assert.equal(i18n.t("phoneLabel", { type: "Mobil", name: "Ján Novák" }), "Mobil für Ján Novák");
});

test("switching languages updates messages and unsupported locales fall back to English", () => {
  const i18n = createI18n("fr-CA");
  assert.equal(i18n.locale, "fr");
  assert.equal(i18n.t("download"), "Télécharger le VCF modifié");
  i18n.setLocale("de-DE");
  assert.equal(i18n.t("download"), "Bearbeitete VCF herunterladen");
  i18n.setLocale("unsupported");
  assert.equal(i18n.locale, "en");
  assert.equal(i18n.t("download"), "Download edited VCF");
});
