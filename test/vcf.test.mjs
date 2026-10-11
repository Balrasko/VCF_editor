import test from "node:test";
import assert from "node:assert/strict";
import { VcfDocument } from "../vcf.js";

const fixture = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Ján Novák",
  "TEL;TYPE=CELL:+420 901 234 567",
  "item1.TEL;TYPE=WORK:00420 2 1234 5678",
  "NOTE:riadok ktorý musí zostať",
  "END:VCARD",
  "BEGIN:VCARD",
  "VERSION:4.0",
  "N:Kováčová;Eva;;;",
  "TEL;TYPE=cell:tel:+421905111222",
  "END:VCARD"
].join("\r\n");

test("parses contacts, names and all TEL properties", () => {
  const document = new VcfDocument(fixture);
  assert.equal(document.cards.length, 2);
  assert.equal(document.phones.length, 3);
  assert.equal(document.cards[0].name, "Ján Novák");
  assert.equal(document.cards[1].name, "Eva Kováčová");
});

test("replaces only an exact leading prefix", () => {
  const document = new VcfDocument(fixture);
  assert.equal(document.replacePrefix("+420", "+421"), 1);
  assert.equal(document.phones[0].value, "+421 901 234 567");
  assert.equal(document.phones[1].value, "00420 2 1234 5678");
  assert.equal(document.phones[2].value, "+421905111222");
});

test("keeps tel URI form and untouched properties on export", () => {
  const document = new VcfDocument(fixture);
  document.setPhone(document.phones[2], "+420905111222");
  const exported = document.serialize();
  assert.match(exported, /TEL;TYPE=cell:tel:\+420905111222/);
  assert.match(exported, /NOTE:riadok ktorý musí zostať/);
});

test("preserves folded physical lines that were not edited", () => {
  const document = new VcfDocument("BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Test\r\nNOTE:dlhy\r\n riadok\r\nTEL:+4211\r\nEND:VCARD");
  document.setPhone(document.phones[0], "+4212");
  assert.match(document.serialize(), /NOTE:dlhy\r\n riadok/);
});

test("restores the exact original TEL folding after reset", () => {
  const source = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Test\r\nTEL:+421 900\r\n 111 222\r\nEND:VCARD";
  const document = new VcfDocument(source);
  document.setPhone(document.phones[0], "+420 900 111 222");
  document.resetPhone(document.phones[0]);
  assert.equal(document.serialize(), source);
});
