import { VcfDocument, readVcfFile } from "./vcf.js";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const avatarColors = ["#e8e1f1", "#e2ece8", "#f1e7dc", "#e4e8f2", "#efe1e4"];

const elements = {
  uploadView: document.querySelector("#upload-view"),
  editorView: document.querySelector("#editor-view"),
  fileInput: document.querySelector("#file-input"),
  dropZone: document.querySelector("#drop-zone"),
  fileName: document.querySelector("#file-name"),
  fileSummary: document.querySelector("#file-summary"),
  chooseAnother: document.querySelector("#choose-another"),
  oldPrefix: document.querySelector("#old-prefix"),
  newPrefix: document.querySelector("#new-prefix"),
  replacePrefix: document.querySelector("#replace-prefix"),
  replaceFeedback: document.querySelector("#replace-feedback"),
  searchInput: document.querySelector("#search-input"),
  visibleCount: document.querySelector("#visible-count"),
  contactsList: document.querySelector("#contacts-list"),
  emptySearch: document.querySelector("#empty-search"),
  changeCount: document.querySelector("#change-count"),
  downloadButton: document.querySelector("#download-button"),
  toast: document.querySelector("#toast")
};

let documentModel = null;
let currentFileName = "kontakty.vcf";
let toastTimer = null;

function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", isError);
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 3200);
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function phoneType(phone) {
  const typeMatch = phone.key.match(/(?:^|;)TYPE=([^;:]+)/i);
  if (!typeMatch) return "Telefón";
  const type = typeMatch[1].split(",")[0].toLowerCase();
  const labels = { cell: "Mobil", mobile: "Mobil", home: "Domov", work: "Práca", fax: "Fax" };
  return labels[type] || typeMatch[1].split(",")[0];
}

function createContactRow(card, index) {
  const row = document.createElement("article");
  row.className = "contact-row";
  row.dataset.search = `${card.name} ${card.phones.map((phone) => phone.value).join(" ")}`.toLocaleLowerCase("sk");
  row.style.setProperty("--avatar", avatarColors[index % avatarColors.length]);

  const person = document.createElement("div");
  person.className = "contact-person";
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.textContent = initials(card.name);
  const nameBlock = document.createElement("span");
  const name = document.createElement("strong");
  name.textContent = card.name;
  const phoneMeta = document.createElement("small");
  phoneMeta.textContent = card.phones.length === 1 ? phoneType(card.phones[0]) : `${card.phones.length} telefónne čísla`;
  nameBlock.append(name, phoneMeta);
  person.append(avatar, nameBlock);

  const fields = document.createElement("div");
  fields.className = "phone-fields";
  card.phones.forEach((phone) => {
    const wrapper = document.createElement("label");
    wrapper.className = "phone-wrap";
    wrapper.dataset.phoneId = phone.id;
    const hiddenLabel = document.createElement("span");
    hiddenLabel.className = "sr-only";
    hiddenLabel.textContent = `${phoneType(phone)} pre ${card.name}`;
    const input = document.createElement("input");
    input.className = "phone-input";
    input.type = "tel";
    input.value = phone.value;
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      documentModel.setPhone(phone, input.value);
      row.dataset.search = `${card.name} ${card.phones.map((item) => item.value).join(" ")}`.toLocaleLowerCase("sk");
      updateChangedState();
    });
    const dot = document.createElement("span");
    dot.className = "edited-dot";
    dot.setAttribute("aria-hidden", "true");
    wrapper.append(hiddenLabel, input, dot);
    fields.append(wrapper);
  });

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "reset-phone";
  reset.textContent = "Vrátiť";
  reset.title = "Vrátiť pôvodné čísla kontaktu";
  reset.addEventListener("click", () => {
    card.phones.forEach((phone) => documentModel.resetPhone(phone));
    renderContacts(elements.searchInput.value);
    updateChangedState();
  });

  row.append(person, fields, reset);
  return row;
}

function renderContacts(filter = "") {
  const query = filter.trim().toLocaleLowerCase("sk");
  elements.contactsList.replaceChildren();
  const cards = documentModel.cards.filter((card) => card.phones.length > 0);
  let visible = 0;

  cards.forEach((card, index) => {
    const haystack = `${card.name} ${card.phones.map((phone) => phone.value).join(" ")}`.toLocaleLowerCase("sk");
    if (query && !haystack.includes(query)) return;
    const row = createContactRow(card, index);
    const cardChanged = card.phones.some((phone) => phone.value !== phone.original);
    row.classList.toggle("is-edited", cardChanged);
    card.phones.forEach((phone) => {
      row.querySelector(`[data-phone-id="${phone.id}"]`)?.classList.toggle("is-edited", phone.value !== phone.original);
    });
    elements.contactsList.append(row);
    visible += 1;
  });

  elements.visibleCount.textContent = `(${visible})`;
  elements.contactsList.hidden = visible === 0;
  elements.emptySearch.hidden = visible !== 0;
}

function updateChangedState() {
  const count = documentModel.changedPhones.length;
  elements.changeCount.textContent = count === 0
    ? "Zatiaľ bez zmien"
    : count === 1
      ? "Upravené 1 telefónne číslo"
      : `Upravených ${count} telefónnych čísel`;

  document.querySelectorAll(".contact-row").forEach((row) => {
    const wrappers = [...row.querySelectorAll(".phone-wrap")];
    let rowChanged = false;
    wrappers.forEach((wrapper) => {
      const phone = documentModel.phones.find((item) => item.id === wrapper.dataset.phoneId);
      const changed = Boolean(phone && phone.value !== phone.original);
      wrapper.classList.toggle("is-edited", changed);
      rowChanged ||= changed;
    });
    row.classList.toggle("is-edited", rowChanged);
  });
}

async function loadFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".vcf")) {
    showToast("Vyberte súbor s príponou .vcf.", true);
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    showToast("Súbor je väčší ako povolených 20 MB.", true);
    return;
  }

  try {
    const text = await readVcfFile(file);
    const parsed = new VcfDocument(text);
    if (parsed.cards.length === 0) throw new Error("VCF neobsahuje žiadne karty kontaktov.");

    documentModel = parsed;
    currentFileName = file.name;
    elements.fileName.textContent = file.name;
    const contactWord = parsed.cards.length === 1 ? "kontakt" : parsed.cards.length < 5 ? "kontakty" : "kontaktov";
    const phoneWord = parsed.phones.length === 1 ? "číslo" : parsed.phones.length < 5 ? "čísla" : "čísel";
    elements.fileSummary.textContent = `${parsed.cards.length} ${contactWord} · ${parsed.phones.length} telefónnych ${phoneWord}`;
    elements.oldPrefix.value = "";
    elements.newPrefix.value = "";
    elements.searchInput.value = "";
    elements.replaceFeedback.textContent = "";
    elements.uploadView.hidden = true;
    elements.editorView.hidden = false;
    renderContacts();
    updateChangedState();
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast(`Načítaný súbor ${file.name}`);
  } catch (error) {
    showToast(error.message || "VCF súbor sa nepodarilo načítať.", true);
  } finally {
    elements.fileInput.value = "";
  }
}

elements.fileInput.addEventListener("change", (event) => loadFile(event.target.files[0]));
elements.chooseAnother.addEventListener("click", () => elements.fileInput.click());

["dragenter", "dragover"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
  });
});

elements.dropZone.addEventListener("drop", (event) => loadFile(event.dataTransfer.files[0]));

elements.replacePrefix.addEventListener("click", () => {
  const oldPrefix = elements.oldPrefix.value.trim();
  const newPrefix = elements.newPrefix.value.trim();
  if (!oldPrefix) {
    elements.oldPrefix.focus();
    elements.replaceFeedback.textContent = "Zadajte starú predvoľbu.";
    return;
  }

  const count = documentModel.replacePrefix(oldPrefix, newPrefix);
  elements.replaceFeedback.textContent = count === 0
    ? `Nenašlo sa žiadne číslo začínajúce na ${oldPrefix}.`
    : count === 1
      ? "Predvoľba bola nahradená v 1 čísle."
      : `Predvoľba bola nahradená v ${count} číslach.`;
  renderContacts(elements.searchInput.value);
  updateChangedState();
});

elements.searchInput.addEventListener("input", () => renderContacts(elements.searchInput.value));

elements.downloadButton.addEventListener("click", () => {
  const content = documentModel.serialize();
  const blob = new Blob([content], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const baseName = currentFileName.replace(/\.vcf$/i, "") || "kontakty";
  link.href = url;
  link.download = `${baseName}-upravene.vcf`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Upravený VCF súbor je pripravený.");
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && documentModel) {
    event.preventDefault();
    elements.downloadButton.click();
  }
});
