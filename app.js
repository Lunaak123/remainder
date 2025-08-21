// Simple Notes + Reminders app (localStorage)
// Author: ChatGPT (example)
// Filename: app.js

const STORAGE_KEY = "notes_app_v1";

// DOM
const notesList = document.getElementById("notes-list");
const searchInput = document.getElementById("search");
const btnNew = document.getElementById("btn-new");
const btnExport = document.getElementById("btn-export");
const btnImport = document.getElementById("btn-import");
const importFile = document.getElementById("import-file");
const btnNotifRequest = document.getElementById("btn-notif-request");

const form = document.getElementById("note-form");
const inputId = document.getElementById("note-id");
const inputTitle = document.getElementById("note-title");
const inputBody = document.getElementById("note-body");
const inputReminder = document.getElementById("note-reminder");
const inputPin = document.getElementById("note-pin");
const btnSave = document.getElementById("btn-save");
const btnCancel = document.getElementById("btn-cancel");
const btnDelete = document.getElementById("btn-delete");

let notes = [];

// Utils
function nowISO() { return new Date().toISOString(); }
function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  notes = raw ? JSON.parse(raw) : [];
  notes.forEach(n => { if (n.reminder && typeof n.reminder === "string") n.reminder = n.reminder; });
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); }

// Render
function renderList(filter = "") {
  notesList.innerHTML = "";
  const sorted = [...notes].sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0) || new Date(b.updatedAt) - new Date(a.updatedAt));
  const now = new Date();
  const filtered = sorted.filter(n => {
    if (!filter) return true;
    const s = filter.toLowerCase();
    return (n.title||"").toLowerCase().includes(s) || (n.body||"").toLowerCase().includes(s);
  });
  filtered.forEach(n => {
    const el = document.createElement("div");
    el.className = "note-item";
    if (n.pinned) el.classList.add("pinned");
    const meta = document.createElement("div");
    meta.className = "meta";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = n.title || "(no title)";

    const snippet = document.createElement("div");
    snippet.textContent = (n.body || "").slice(0,120);

    const small = document.createElement("div");
    small.className = "meta";
    const updated = new Date(n.updatedAt);
    let remText = "";
    if (n.reminder) {
      const r = new Date(n.reminder);
      const isPast = r - now < 0;
      remText = ` • 🔔 ${r.toLocaleString()}`;
      if (isPast) el.classList.add("overdue");
      else if (r - now < 1000*60*60*24) el.classList.add("due");
    }
    small.textContent = `${updated.toLocaleString()}${remText}`;

    meta.appendChild(title);
    meta.appendChild(snippet);

    const right = document.createElement("div");
    right.style.textAlign = "right";
    const openBtn = document.createElement("button");
    openBtn.textContent = "Open";
    openBtn.style.padding = "6px 8px";
    openBtn.onclick = (e) => { e.stopPropagation(); openNote(n.id); };
    right.appendChild(openBtn);

    el.appendChild(meta);
    el.appendChild(right);
    el.onclick = () => openNote(n.id);

    notesList.appendChild(el);
  });

  if (filtered.length === 0) {
    const no = document.createElement("div");
    no.className = "small";
    no.textContent = "No notes found.";
    notesList.appendChild(no);
  }
}

// CRUD
function createNote() {
  const id = "n_" + Date.now();
  const note = { id, title: "", body: "", createdAt: nowISO(), updatedAt: nowISO(), reminder: null, pinned:false };
  notes.unshift(note);
  save();
  openNote(id);
  renderList(searchInput.value);
}

function openNote(id) {
  const n = notes.find(x => x.id === id);
  if (!n) return alert("Note not found");
  inputId.value = n.id;
  inputTitle.value = n.title;
  inputBody.value = n.body;
  inputReminder.value = n.reminder ? formatForInput(n.reminder) : "";
  inputPin.checked = !!n.pinned;
  btnDelete.style.display = "inline-block";
}

function clearForm() {
  inputId.value = "";
  inputTitle.value = "";
  inputBody.value = "";
  inputReminder.value = "";
  inputPin.checked = false;
  btnDelete.style.display = "none";
}

function saveForm(e) {
  e && e.preventDefault();
  const id = inputId.value;
  if (!inputTitle.value && !inputBody.value) {
    // prevent creating empty notes
    return alert("Please add a title or body.");
  }
  if (id) {
    const n = notes.find(x => x.id === id);
    if (!n) return alert("Note not found.");
    n.title = inputTitle.value;
    n.body = inputBody.value;
    n.reminder = inputReminder.value ? new Date(inputReminder.value).toISOString() : null;
    n.pinned = !!inputPin.checked;
    n.updatedAt = nowISO();
  } else {
    const newNote = {
      id: "n_" + Date.now(),
      title: inputTitle.value,
      body: inputBody.value,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      reminder: inputReminder.value ? new Date(inputReminder.value).toISOString() : null,
      pinned: !!inputPin.checked
    };
    notes.unshift(newNote);
  }
  save();
  clearForm();
  renderList(searchInput.value);
}

function deleteCurrent() {
  const id = inputId.value;
  if (!id) return;
  if (!confirm("Delete this note?")) return;
  notes = notes.filter(n => n.id !== id);
  save();
  clearForm();
  renderList(searchInput.value);
}

// Helpers
function formatForInput(iso) {
  if(!iso) return "";
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset();
  // local datetime-local expects local time portion
  const local = new Date(d.getTime() - (tzOffset*60*1000));
  return local.toISOString().slice(0,16);
}

// Reminders check
function checkReminders() {
  const now = new Date();
  notes.forEach(n => {
    if (!n.reminder || n.reminderFired) return;
    const r = new Date(n.reminder);
    // Allow small tolerance: fire if r <= now + 1s
    if (r - now <= 1000) {
      n.reminderFired = true; // mark so we don't repeat
      save();
      notifyReminder(n);
    }
  });
}

// Notification
async function notifyReminder(note) {
  try {
    if (Notification.permission === "granted") {
      const t = note.title || "Reminder";
      const body = (note.body && note.body.slice(0,120)) || "You have a reminder.";
      const nobj = new Notification(t, { body, tag: note.id, renotify: true });
      // optional: click to focus the tab
      nobj.onclick = () => window.focus();
    } else {
      // fallback: simple in-app alert
      alert(`Reminder: ${note.title || "(no title)"}\n${note.body ? note.body.slice(0,200) : ""}`);
    }
  } catch (err) {
    console.error("Notification error:", err);
  }
}

// Import/Export
function exportNotes() {
  const blob = new Blob([JSON.stringify(notes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `notes_export_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importNotesFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("Invalid file format");
      // Keep existing notes and merge (prevent ID collisions)
      const existingIds = new Set(notes.map(n=>n.id));
      data.forEach(n => {
        if (!n.id) n.id = "n_" + Date.now() + "_" + Math.floor(Math.random()*1000);
        if (existingIds.has(n.id)) n.id += "_" + Math.floor(Math.random()*1000);
        notes.push(n);
      });
      save();
      renderList(searchInput.value);
      alert("Import completed.");
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  };
  reader.readAsText(file);
}

// Notification permission
async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("This browser does not support Notifications.");
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    alert("Notifications enabled.");
  } else {
    alert("Notifications not granted.");
  }
}

// Set up periodic check
let reminderInterval = null;
function startReminderLoop() {
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = setInterval(checkReminders, 15000); // every 15 seconds
  // Also run once now
  setTimeout(checkReminders, 1000);
}

// Listeners
btnNew.onclick = () => { createNote(); };
btnExport.onclick = () => { exportNotes(); };
btnImport.onclick = () => importFile.click();
importFile.onchange = (e) => {
  const f = e.target.files[0];
  if (f) importNotesFile(f);
  importFile.value = "";
};
btnNotifRequest.onclick = () => requestNotificationPermission();

searchInput.oninput = () => renderList(searchInput.value);

form.addEventListener("submit", saveForm);
btnCancel.addEventListener("click", (e) => { e.preventDefault(); clearForm(); });
btnDelete.addEventListener("click", (e) => { e.preventDefault(); deleteCurrent(); });

// initial load
load();
renderList();
startReminderLoop();

// To ensure reminders still fire after page reload for already fired flags,
// reset reminderFired for future reminders
notes.forEach(n => {
  if (n.reminder && !n.reminderFired) {
    // keep as is
  } else if (n.reminder && n.reminderFired) {
    // if reminder time is still in future (possible due to timezone string issues), reset
    const r = new Date(n.reminder);
    if (r - new Date() > 0) n.reminderFired = false;
  }
});
save();
