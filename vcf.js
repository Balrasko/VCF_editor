function unfoldPhysicalLines(text) {
  const physical = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
  const logical = [];

  for (const raw of physical) {
    if (/^[ \t]/.test(raw) && logical.length) {
      const previous = logical.at(-1);
      previous.raw.push(raw);
      previous.text += raw.slice(1);
    } else {
      logical.push({ raw: [raw], text: raw, originalText: raw, dirty: false });
    }
  }

  logical.forEach((line) => {
    line.originalText = line.text;
  });

  return logical;
}

function propertyParts(line) {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  return { key: line.slice(0, colon), value: line.slice(colon + 1), colon };
}

function propertyName(key) {
  return key.split(";", 1)[0].split(".").at(-1).toUpperCase();
}

function decodeVCardText(value) {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function nameFromCard(lines) {
  const findValue = (wanted) => {
    const line = lines.find((item) => {
      const parts = propertyParts(item.text);
      return parts && propertyName(parts.key) === wanted;
    });
    return line ? propertyParts(line.text).value : "";
  };

  const fullName = decodeVCardText(findValue("FN"));
  if (fullName) return fullName;

  const structured = findValue("N").split(";").map(decodeVCardText);
  const fallback = [structured[1], structured[0]].filter(Boolean).join(" ");
  return fallback;
}

function phoneDisplayValue(value) {
  return value.replace(/^tel:/i, "");
}

export class VcfDocument {
  constructor(text) {
    this.lines = unfoldPhysicalLines(text);
    this.cards = [];
    this.phones = [];
    this.parse();
  }

  parse() {
    let current = null;

    this.lines.forEach((line, lineIndex) => {
      if (/^BEGIN:VCARD\s*$/i.test(line.text)) {
        current = { lines: [], phones: [], index: this.cards.length };
      }

      if (current) current.lines.push(line);

      if (/^END:VCARD\s*$/i.test(line.text) && current) {
        current.name = nameFromCard(current.lines);
        current.lines.forEach((candidate) => {
          const parts = propertyParts(candidate.text);
          if (!parts || propertyName(parts.key) !== "TEL") return;
          const phone = {
            id: `phone-${this.phones.length}`,
            card: current,
            line: candidate,
            key: parts.key,
            hadTelScheme: /^tel:/i.test(parts.value),
            original: phoneDisplayValue(parts.value),
            value: phoneDisplayValue(parts.value)
          };
          current.phones.push(phone);
          this.phones.push(phone);
        });
        this.cards.push(current);
        current = null;
      }
    });
  }

  setPhone(phone, nextValue) {
    if (!phone || !this.phones.includes(phone)) return;
    phone.value = nextValue;
    const prefix = phone.hadTelScheme && !/^tel:/i.test(nextValue) ? "tel:" : "";
    phone.line.text = `${phone.key}:${prefix}${nextValue}`;
    phone.line.dirty = phone.line.text !== phone.line.originalText;
  }

  resetPhone(phone) {
    this.setPhone(phone, phone.original);
  }

  replacePrefix(oldPrefix, newPrefix) {
    if (!oldPrefix) return 0;
    let changes = 0;
    this.phones.forEach((phone) => {
      const leading = phone.value.match(/^\s*/)?.[0] ?? "";
      const comparable = phone.value.slice(leading.length);
      if (comparable.startsWith(oldPrefix)) {
        this.setPhone(phone, `${leading}${newPrefix}${comparable.slice(oldPrefix.length)}`);
        changes += 1;
      }
    });
    return changes;
  }

  get changedPhones() {
    return this.phones.filter((phone) => phone.value !== phone.original);
  }

  serialize() {
    return this.lines
      .flatMap((line) => (line.dirty ? [line.text] : line.raw))
      .join("\r\n");
  }
}

export async function readVcfFile(file) {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1250").decode(bytes);
  }
}
