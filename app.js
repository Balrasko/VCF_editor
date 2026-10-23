import { VcfDocument, readVcfFile } from "./vcf.js";
import { createI18n, resolveLocale } from "./i18n.js";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const avatarColors = ["#e8e1f1", "#e2ece8", "#f1e7dc", "#e4e8f2", "#efe1e4"];
const LANGUAGE_STORAGE_KEY = "vcf-editor-language";
let savedLanguage;
try {
  savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
} catch {
  // Language detection still works when browser storage is unavailable.
}
const i18n = createI18n(resolveLocale([savedLanguage, ...(navigator.languages || [navigator.language])]));
const t = (key, values) => i18n.t(key, values);

const elements = {
  languageSelect: document.querySelector("#language-select"),
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
let currentFileName = "";
let toastTimer = null;
let toastMessage = null;
let prefixFeedback = null;

function applyLanguage() {
  document.documentElement.lang = i18n.locale;
  elements.languageSelect.value = i18n.locale;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  for (const attribute of ["aria-label", "placeholder", "content"]) {
    document.querySelectorAll(`[data-i18n-${attribute}]`).forEach((element) => {
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
    });
  }
  if (documentModel) {
    updateFileSummary();
    renderContacts(elements.searchInput.value);
    updateChangedState();
  }
  if (prefixFeedback) elements.replaceFeedback.textContent = t(prefixFeedback.key, prefixFeedback.values);
  if (toastMessage) elements.toast.textContent = t(toastMessage.key, toastMessage.values);
}

function updateFileSummary() {
  elements.fileSummary.textContent = `${t("contactCount", { count: documentModel.cards.length })} · ${t("phoneCount", { count: documentModel.phones.length })}`;
}

function contactName(card) {
  return card.name || t("unnamedContact", { number: card.index + 1 });
}

function setPrefixFeedback(key, values = {}) {
  prefixFeedback = { key, values };
  elements.replaceFeedback.textContent = t(key, values);
}

function showToast(key, values = {}, isError = false) {
  clearTimeout(toastTimer);
  toastMessage = { key, values };
  elements.toast.textContent = t(key, values);
  elements.toast.classList.toggle("is-error", isError);
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("is-visible");
    toastMessage = null;
  }, 3200);
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
  if (!typeMatch) return t("phone");
  const type = typeMatch[1].split(",")[0].toLowerCase();
  const labels = { cell: "mobile", mobile: "mobile", home: "home", work: "work", fax: "fax" };
  return Object.hasOwn(labels, type) ? t(labels[type]) : typeMatch[1].split(",")[0];
}

function createContactRow(card, index) {
  const displayName = contactName(card);
  const row = document.createElement("article");
  row.className = "contact-row";
  row.dataset.search = `${displayName} ${card.phones.map((phone) => phone.value).join(" ")}`.toLocaleLowerCase(i18n.locale);
  row.style.setProperty("--avatar", avatarColors[index % avatarColors.length]);

  const person = document.createElement("div");
  person.className = "contact-person";
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.textContent = initials(displayName);
  const nameBlock = document.createElement("span");
  const name = document.createElement("strong");
  name.textContent = displayName;
  const phoneMeta = document.createElement("small");
  phoneMeta.textContent = card.phones.length === 1 ? phoneType(card.phones[0]) : t("phoneCount", { count: card.phones.length });
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
    hiddenLabel.textContent = t("phoneLabel", { type: phoneType(phone), name: displayName });
    const input = document.createElement("input");
    input.className = "phone-input";
    input.type = "tel";
    input.value = phone.value;
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      documentModel.setPhone(phone, input.value);
      row.dataset.search = `${displayName} ${card.phones.map((item) => item.value).join(" ")}`.toLocaleLowerCase(i18n.locale);
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
  reset.textContent = t("reset");
  reset.title = t("resetTitle");
  reset.addEventListener("click", () => {
    card.phones.forEach((phone) => documentModel.resetPhone(phone));
    renderContacts(elements.searchInput.value);
    updateChangedState();
  });

  row.append(person, fields, reset);
  return row;
}

function renderContacts(filter = "") {
  const query = filter.trim().toLocaleLowerCase(i18n.locale);
  elements.contactsList.replaceChildren();
  const cards = documentModel.cards.filter((card) => card.phones.length > 0);
  let visible = 0;

  cards.forEach((card, index) => {
    const haystack = `${contactName(card)} ${card.phones.map((phone) => phone.value).join(" ")}`.toLocaleLowerCase(i18n.locale);
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
  elements.changeCount.textContent = count === 0 ? t("noChanges") : t("changedCount", { count });

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
    showToast("invalidFile", {}, true);
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    showToast("fileTooLarge", {}, true);
    return;
  }

  try {
    const text = await readVcfFile(file);
    const parsed = new VcfDocument(text);
    if (parsed.cards.length === 0) {
      showToast("noContacts", {}, true);
      return;
    }

    documentModel = parsed;
    currentFileName = file.name;
    elements.fileName.textContent = file.name;
    updateFileSummary();
    elements.oldPrefix.value = "";
    elements.newPrefix.value = "";
    elements.searchInput.value = "";
    elements.replaceFeedback.textContent = "";
    prefixFeedback = null;
    elements.uploadView.hidden = true;
    elements.editorView.hidden = false;
    renderContacts();
    updateChangedState();
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("fileLoaded", { name: file.name });
  } catch {
    showToast("fileReadError", {}, true);
  } finally {
    elements.fileInput.value = "";
  }
}

elements.languageSelect.addEventListener("change", () => {
  i18n.setLocale(elements.languageSelect.value);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, i18n.locale);
  } catch {
    // Switching languages does not depend on persistent storage.
  }
  applyLanguage();
});

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
    setPrefixFeedback("enterOldPrefix");
    return;
  }

  const count = documentModel.replacePrefix(oldPrefix, newPrefix);
  if (count === 0) setPrefixFeedback("noPrefixMatches", { prefix: oldPrefix });
  else setPrefixFeedback("prefixReplaced", { count });
  renderContacts(elements.searchInput.value);
  updateChangedState();
});

elements.searchInput.addEventListener("input", () => renderContacts(elements.searchInput.value));

elements.downloadButton.addEventListener("click", () => {
  const content = documentModel.serialize();
  const blob = new Blob([content], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const baseName = currentFileName.replace(/\.vcf$/i, "") || t("fileBaseName");
  link.href = url;
  link.download = `${baseName}-${t("fileSuffix")}.vcf`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("downloadReady");
});

applyLanguage();

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && documentModel) {
    event.preventDefault();
    elements.downloadButton.click();
  }
});
