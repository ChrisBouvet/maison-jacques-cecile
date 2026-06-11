import { addReservation, updateReservation, deleteReservation } from "./firebase-db.js";
import { initCalendars, initResaForms, subscribeAll, linkArrivalDeparture } from "./calendar-firebase.js";

// ══════════════════════════════════════════════════
//  RÔLES & MOTS DE PASSE
//  "famille" → accès planning / instructions / contacts
//  "admin"   → accès complet + onglet Admin
// ══════════════════════════════════════════════════
const PASSWORDS = {
  "bouvet2024": "famille",
  "bouvetadmin2024": "admin"
};

function checkPassword() {
  const input   = document.getElementById("famillePassword");
  const gate    = document.getElementById("passwordGate");
  const content = document.getElementById("privateContent");
  if (!input) return;

  const role = PASSWORDS[input.value];
  if (role) {
    gate.style.display = "none";
    content.classList.add("unlocked");
    sessionStorage.setItem("famille_auth", "1");
    sessionStorage.setItem("famille_role", role);
    startFamilleApp(role);
  } else {
    document.querySelectorAll("#pwError").forEach(e => e.style.display = "block");
    input.value = "";
    input.focus();
  }
}

function applyRole(role) {
  const adminTabBtn = document.getElementById("adminTabBtn");
  if (!adminTabBtn) return;
  if (role === "admin") {
    adminTabBtn.style.display = "";
  } else {
    adminTabBtn.style.display = "none";
    // Si on était sur l'onglet admin (session précédente) et qu'on n'a plus le rôle, basculer sur planning
    if (adminTabBtn.classList.contains("active")) {
      document.querySelector('.tab-btn[data-tab="planning"]')?.click();
    }
  }
}

let _started = false;
function startFamilleApp(role) {
  applyRole(role);
  if (_started) return;
  _started = true;

  // Calendriers (combiné + 3 détaillés) — temps réel via store partagé
  initCalendars();

  // Formulaire de demande de réservation (onglet Planning)
  initResaForms();

  // Tableau récapitulatif (onglet Admin) — temps réel via store partagé
  subscribeAll(renderTable);

  initAdminForm();
}

// ══════════════════════════════════════════════════
//  TABLE DES RÉSERVATIONS (onglet Admin)
// ══════════════════════════════════════════════════
const APT_LABELS = { famille: "1er étage – Famille", rdc: "RDC", "2eme": "2e étage" };

function statusBadge(statut) {
  const map = {
    en_attente: { label: "En attente", bg: "#FAEEDA", color: "#633806", border: "#EF9F27" },
    confirmee:  { label: "Confirmée",  bg: "#EAF3DE", color: "#3B6D11", border: "#639922" },
    refusee:    { label: "Refusée",    bg: "#FCEBEB", color: "#A32D2D", border: "#E24B4A" },
    famille:    { label: "Famille",    bg: "#E6F1FB", color: "#185FA5", border: "#378ADD" },
  };
  const s = map[statut] || map.en_attente;
  return `<span style="padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:500;background:${s.bg};color:${s.color};border:1px solid ${s.border}">${s.label}</span>`;
}

function fmt(d) { if (!d) return "—"; const [y,m,j]=d.split("-"); return `${j}/${m}/${y}`; }

// Tri : réservations "en attente" en premier, puis du séjour le plus
// récent au plus ancien (date d'arrivée décroissante).
function sortReservations(resas) {
  return [...resas].sort((a, b) => {
    const aPending = a.statut === "en_attente" ? 0 : 1;
    const bPending = b.statut === "en_attente" ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    return (b.start || "").localeCompare(a.start || ""); // décroissant
  });
}

const PAGE_SIZE = 5;
let _currentPage = 1;

function renderTable(resas) {
  const tbody = document.getElementById("reservationTableBody");
  if (!tbody) return;

  const sorted = sortReservations(resas || []);
  window._reservationsCache = sorted;

  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--gris);font-style:italic;padding:1.5rem;">Aucune réservation.</td></tr>`;
    renderPagination(0);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  if (_currentPage > totalPages) _currentPage = totalPages;
  if (_currentPage < 1) _currentPage = 1;

  const startIdx = (_currentPage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(startIdx, startIdx + PAGE_SIZE);

  tbody.innerHTML = pageItems.map(r => `
    <tr data-id="${r.id}">
      <td>${APT_LABELS[r.apt] || r.apt || "—"}</td>
      <td>${fmt(r.start)}</td>
      <td>${fmt(r.end)}</td>
      <td>${r.nom || r.tenant || "—"}<br><span style="font-size:0.78rem;color:var(--gris)">${r.email||""}</span></td>
      <td>${statusBadge(r.statut)}</td>
      <td style="font-size:0.8rem;color:var(--gris)">${r.message||r.notes||""}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${r.statut === "en_attente" ? `
            <button onclick="validateResa('${r.id}')" class="btn-action btn-confirm" title="Valider">✓</button>
            <button onclick="refuseResa('${r.id}')" class="btn-action btn-refuse" title="Refuser">✗</button>
          ` : ""}
          <button onclick="editResa('${r.id}')" class="btn-action btn-edit" title="Modifier">✎</button>
          <button onclick="deleteResa('${r.id}')" class="btn-action btn-delete" title="Supprimer">🗑</button>
        </div>
      </td>
    </tr>
  `).join("");

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const container = document.getElementById("reservationPagination");
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ""; return; }

  let html = `<button class="page-btn" ${_currentPage===1?"disabled":""} onclick="changeResaPage(${_currentPage-1})">←</button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i===_currentPage?"active":""}" onclick="changeResaPage(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" ${_currentPage===totalPages?"disabled":""} onclick="changeResaPage(${_currentPage+1})">→</button>`;
  container.innerHTML = html;
}

window.changeResaPage = (p) => {
  _currentPage = p;
  renderTable(window._reservationsCache || []);
};

// ══════════════════════════════════════════════════
//  ACTIONS ADMIN
// ══════════════════════════════════════════════════

// "Valider" : passe une demande en attente en confirmée (ou "famille" si apt = famille)
window.validateResa = async (id) => {
  const r = (window._reservationsCache || []).find(x => x.id === id);
  const statut = (r && r.apt === "famille") ? "famille" : "confirmee";
  try {
    await updateReservation(id, { statut });
    showToast("Réservation validée !", "success");
  } catch { showToast("Erreur de mise à jour.", "error"); }
};

window.refuseResa = async (id) => {
  if (!confirm("Refuser cette réservation ?")) return;
  try {
    await updateReservation(id, { statut: "refusee" });
    showToast("Réservation refusée.", "");
  } catch { showToast("Erreur de mise à jour.", "error"); }
};

window.deleteResa = async (id) => {
  if (!confirm("Supprimer définitivement ?")) return;
  try {
    await deleteReservation(id);
    showToast("Supprimée.", "");
    if (window._editingId === id) resetAdminForm();
  } catch { showToast("Erreur de suppression.", "error"); }
};

// "Modifier" : charge la réservation dans le formulaire admin
window.editResa = (id) => {
  const r = (window._reservationsCache || []).find(x => x.id === id);
  if (!r) return;

  const form = document.getElementById("adminResaForm");
  if (!form) return;

  form.querySelector("select[name='apt']").value    = r.apt || "famille";
  form.querySelector("select[name='statut']").value = r.statut || "confirmee";

  const startInput = form.querySelector("input[name='start']");
  const endInput   = form.querySelector("input[name='end']");
  startInput.value = r.start || "";
  endInput.min     = r.start || "";
  endInput.value   = r.end || "";

  form.querySelector("input[name='tenant']").value  = r.tenant || r.nom || "";
  document.getElementById("adminNotes").value       = r.notes || r.message || "";

  window._editingId = id;
  document.getElementById("adminEditId").value = id;

  // Met à jour le bouton et affiche "Annuler"
  const submitBtn = document.getElementById("adminSubmitBtn");
  submitBtn.innerHTML = `
    <span data-lang="fr">💾 Enregistrer les modifications</span>
    <span data-lang="en" style="display:none">💾 Save changes</span>
    <span data-lang="it" style="display:none">💾 Salva modifiche</span>`;
  applyCurrentLang(submitBtn);

  document.getElementById("adminCancelEditBtn").style.display = "";

  // Affiche les informations complètes de la demande d'origine (lecture seule)
  renderEditRequestInfo(r);

  // Scroll jusqu'au formulaire
  document.querySelector(".admin-form-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

// Affiche un récapitulatif en lecture seule des informations fournies
// par le demandeur (email, téléphone, adultes/enfants, animal, message).
function renderEditRequestInfo(r) {
  const box = document.getElementById("editRequestInfo");
  if (!box) return;

  const hasRequestInfo = r.email || r.phone || r.adults || r.children || r.pets || r.message;
  if (!hasRequestInfo) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  const petsLabel = r.pets ? "Oui 🐾" : "Non";
  const adults    = r.adults || "—";
  const children  = r.children || "0";

  box.innerHTML = `
    <h4 data-lang="fr">Détails de la demande</h4>
    <h4 data-lang="en" style="display:none">Request details</h4>
    <h4 data-lang="it" style="display:none">Dettagli della richiesta</h4>
    <div class="edit-request-grid">
      <div><strong data-lang="fr">Email</strong><strong data-lang="en" style="display:none">Email</strong><strong data-lang="it" style="display:none">Email</strong><br>${r.email || "—"}</div>
      <div><strong data-lang="fr">Téléphone</strong><strong data-lang="en" style="display:none">Phone</strong><strong data-lang="it" style="display:none">Telefono</strong><br>${r.phone || "—"}</div>
      <div><strong data-lang="fr">Adultes</strong><strong data-lang="en" style="display:none">Adults</strong><strong data-lang="it" style="display:none">Adulti</strong><br>${adults}</div>
      <div><strong data-lang="fr">Enfants</strong><strong data-lang="en" style="display:none">Children</strong><strong data-lang="it" style="display:none">Bambini</strong><br>${children}</div>
      <div><strong data-lang="fr">Animal</strong><strong data-lang="en" style="display:none">Pet</strong><strong data-lang="it" style="display:none">Animale</strong><br>${petsLabel}</div>
    </div>
    ${r.message ? `<div class="mt-1"><strong data-lang="fr">Message</strong><strong data-lang="en" style="display:none">Message</strong><strong data-lang="it" style="display:none">Messaggio</strong><p style="margin:0.25rem 0 0;">${r.message}</p></div>` : ""}
  `;
  applyCurrentLang(box);
  box.style.display = "";
}

function resetAdminForm() {
  const form = document.getElementById("adminResaForm");
  if (!form) return;
  form.reset();
  form.querySelector("input[name='end']")?.removeAttribute("min");
  window._editingId = null;
  document.getElementById("adminEditId").value = "";

  const box = document.getElementById("editRequestInfo");
  if (box) { box.style.display = "none"; box.innerHTML = ""; }

  const submitBtn = document.getElementById("adminSubmitBtn");
  submitBtn.innerHTML = `
    <span data-lang="fr">✓ Ajouter la réservation</span>
    <span data-lang="en" style="display:none">✓ Add reservation</span>
    <span data-lang="it" style="display:none">✓ Aggiungi prenotazione</span>`;
  applyCurrentLang(submitBtn);
  document.getElementById("adminCancelEditBtn").style.display = "none";
}

// Applique la langue courante aux éléments [data-lang] nouvellement injectés
function applyCurrentLang(container) {
  const lang = localStorage.getItem("lang") || "fr";
  container.querySelectorAll("[data-lang]").forEach(el => {
    el.style.display = el.dataset.lang === lang ? "" : "none";
  });
}

// ══════════════════════════════════════════════════
//  FORMULAIRE ADMIN (ajout / modification)
// ══════════════════════════════════════════════════
function initAdminForm() {
  const form = document.getElementById("adminResaForm");
  const btn  = document.getElementById("adminSubmitBtn");
  const cancelBtn = document.getElementById("adminCancelEditBtn");
  if (!form || !btn) return;

  // Contrainte départ >= arrivée
  linkArrivalDeparture(form.querySelector("input[name='start']"), form.querySelector("input[name='end']"));

  cancelBtn?.addEventListener("click", resetAdminForm);

  btn.addEventListener("click", async () => {
    const apt    = form.querySelector("select[name='apt']").value;
    const statut = form.querySelector("select[name='statut']").value;
    const start  = form.querySelector("input[name='start']").value;
    const end    = form.querySelector("input[name='end']").value;
    const tenant = form.querySelector("input[name='tenant']").value;
    const notes  = document.getElementById("adminNotes")?.value || "";

    if (!start) { showToast("Veuillez saisir la date d'arrivée.", "error"); return; }
    if (!end)   { showToast("Veuillez saisir la date de départ.", "error"); return; }
    if (start > end) { showToast("La date de départ doit être après l'arrivée.", "error"); return; }

    btn.disabled = true;
    const editingId = window._editingId;

    try {
      const data = {
        apt, start, end,
        nom: tenant, tenant,
        statut, notes,
        type: statut === "famille" ? "family" : "locataire"
      };

      if (editingId) {
        await updateReservation(editingId, data);
        showToast("Réservation modifiée !", "success");
      } else {
        await addReservation(data);
        showToast("Réservation ajoutée !", "success");
      }
      resetAdminForm();
    } catch (err) {
      console.error(err);
      showToast("Erreur d'enregistrement.", "error");
    } finally {
      btn.disabled = false;
    }
  });
}

// ══════════════════════════════════════════════════
//  EXPORT CSV
// ══════════════════════════════════════════════════
window.exportReservations = async () => {
  const { getReservations } = await import("./firebase-db.js");
  const resas = await getReservations();
  const rows  = [["Appartement","Arrivée","Départ","Locataire","Email","Téléphone","Adultes","Enfants","Animal","Statut","Notes"]];
  sortReservations(resas).forEach(r => rows.push([
    APT_LABELS[r.apt]||r.apt, r.start, r.end,
    r.nom||r.tenant||"", r.email||"", r.phone||"",
    r.adults||"", r.children||"0", r.pets ? "Oui" : "Non",
    r.statut, r.notes||r.message||""
  ]));
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv], { type:"text/csv;charset=utf-8;" });
  const a    = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `reservations-bouvet-${new Date().toISOString().slice(0,10)}.csv`
  });
  a.click(); URL.revokeObjectURL(a.href);
};

// ══════════════════════════════════════════════════
//  INIT PAGE
// ══════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  // Boutons mot de passe
  ["pwSubmitFr","pwSubmitEn","pwSubmitIt"].forEach(id =>
    document.getElementById(id)?.addEventListener("click", checkPassword)
  );
  document.getElementById("famillePassword")?.addEventListener("keydown", e => {
    if (e.key === "Enter") checkPassword();
  });

  // Auto-unlock si déjà authentifié cette session (et rôle valide)
  const validRoles = Object.values(PASSWORDS); // ["famille", "admin"]
  const storedRole = sessionStorage.getItem("famille_role");
  if (sessionStorage.getItem("famille_auth") === "1" && validRoles.includes(storedRole)) {
    const gate    = document.getElementById("passwordGate");
    const content = document.getElementById("privateContent");
    if (gate)    gate.style.display = "none";
    if (content) content.classList.add("unlocked");
    startFamilleApp(storedRole);
  } else {
    // Session invalide ou absente : on s'assure que l'accès reste verrouillé
    sessionStorage.removeItem("famille_auth");
    sessionStorage.removeItem("famille_role");
  }
});
