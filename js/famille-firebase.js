import { addReservation, updateReservation, deleteReservation,
         addPeriodeFermee, deletePeriodeFermee,
         hashPassword, getFamilleHash } from "./firebase-db.js";
import { initCalendars, initResaForms, subscribeAll, subscribePeriodesStore, linkArrivalDeparture } from "./calendar-firebase.js";

// ══════════════════════════════════════════════════
//  AUTHENTIFICATION — mot de passe hashé dans Firestore
// ══════════════════════════════════════════════════
async function checkPassword() {
  const input   = document.getElementById("famillePassword");
  const gate    = document.getElementById("passwordGate");
  const content = document.getElementById("privateContent");
  const errEls  = document.querySelectorAll("#pwError");
  if (!input) return;

  const entered = input.value;
  if (!entered) return;

  // Affiche un indicateur de chargement
  const btn = document.querySelector("#pwSubmitFr, #pwSubmitEn, #pwSubmitIt");

  try {
    const enteredHash = await hashPassword(entered);
    const storedHash  = await getFamilleHash();

    if (storedHash && enteredHash === storedHash) {
      gate.style.display = "none";
      content.classList.add("unlocked");
      sessionStorage.setItem("famille_auth", "1");
      sessionStorage.setItem("famille_hash", enteredHash);
      startFamilleApp();
    } else {
      errEls.forEach(e => e.style.display = "block");
      input.value = "";
      input.focus();
    }
  } catch (e) {
    console.error("checkPassword error:", e);
    errEls.forEach(el => el.style.display = "block");
  }
}

let _started = false;
function startFamilleApp() {
  if (_started) return;
  _started = true;

  // Calendriers (combiné + 3 détaillés) — temps réel via store partagé
  initCalendars();

  // Formulaire de demande de réservation (onglet Planning)
  initResaForms();
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

  renderPagination(sorted.length);
}

function renderPagination(total) {
  const container = document.getElementById("reservationPagination");
  if (!container) return;

  if (total === 0) { container.innerHTML = ""; return; }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startN = (_currentPage - 1) * PAGE_SIZE + 1;
  const endN   = Math.min(_currentPage * PAGE_SIZE, total);

  let html = `<span class="pagination-info">${startN}–${endN} / ${total}</span>`;

  if (totalPages > 1) {
    html += `<button class="page-btn" data-page="${_currentPage-1}" ${_currentPage===1?"disabled":""}>←</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="page-btn ${i===_currentPage?"active":""}" data-page="${i}">${i}</button>`;
    }
    html += `<button class="page-btn" data-page="${_currentPage+1}" ${_currentPage===totalPages?"disabled":""}>→</button>`;
  }

  container.innerHTML = html;
}

// Délégation d'événements : un seul listener pour tous les boutons de pagination
document.addEventListener("click", e => {
  const btn = e.target.closest("#reservationPagination .page-btn");
  if (!btn || btn.disabled) return;
  const page = parseInt(btn.dataset.page, 10);
  if (Number.isNaN(page)) return;
  _currentPage = page;
  renderTable(window._reservationsCache || []);
});

// ══════════════════════════════════════════════════
//  ACTIONS ADMIN
// ══════════════════════════════════════════════════

// "Valider" : passe une demande en attente en confirmée (ou "famille" si apt = famille)
window.validateResa = async (id) => {
  const r = (window._reservationsCache || []).find(x => x.id === id);
  const statut = (r && (r.apt === "famille" || r.type === "famille")) ? "famille" : "confirmee";
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

  form.querySelector("select[name='apt']").value    = r.apt || "rdc";
  form.querySelector("select[name='statut']").value = r.statut || "confirmee";
  syncTypeFromApt(form); // ajuste type + origine en fonction de l'apt chargé

  const startInput = form.querySelector("input[name='start']");
  const endInput   = form.querySelector("input[name='end']");
  startInput.value = r.start || "";
  endInput.min     = r.start || "";
  endInput.value   = r.end || "";

  form.querySelector("input[name='tenant']").value  = r.tenant || r.nom || "";
  document.getElementById("adminEmail").value       = r.email || "";
  document.getElementById("adminPhone").value       = r.phone || "";
  document.getElementById("adminNotes").value       = r.notes || r.message || "";
  const adultsEl = form.querySelector("select[name='adults']");
  if (adultsEl && r.adults) adultsEl.value = r.adults;
  const childrenEl = form.querySelector("select[name='children']");
  if (childrenEl && r.children !== undefined) childrenEl.value = r.children;
  const typeEl = form.querySelector("select[name='type']");
  if (typeEl) typeEl.value = r.type || "locataire";
  const origineEl = form.querySelector("select[name='origine']");
  if (origineEl) { origineEl.value = r.origine || ""; syncOrigineField(form); }
  const petsEl = form.querySelector("input[name='adminPets']");
  if (petsEl) petsEl.checked = r.pets || false;

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

// Affiche un récapitulatif en lecture seule des informations complémentaires
// fournies par le demandeur (adultes/enfants, animal, message).
function renderEditRequestInfo(r) {
  const box = document.getElementById("editRequestInfo");
  if (!box) return;

  const hasRequestInfo = r.adults || r.children || r.pets || r.message;
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
      <div><strong data-lang="fr">Adultes</strong><strong data-lang="en" style="display:none">Adults</strong><strong data-lang="it" style="display:none">Adulti</strong><br>${adults}</div>
      <div><strong data-lang="fr">Enfants</strong><strong data-lang="en" style="display:none">Children</strong><strong data-lang="it" style="display:none">Bambini</strong><br>${children}</div>
      <div><strong data-lang="fr">Animal</strong><strong data-lang="en" style="display:none">Pet</strong><strong data-lang="it" style="display:none">Animale</strong><br>${petsLabel}</div>
      ${r.origine ? `<div><strong data-lang="fr">Origine</strong><strong data-lang="en" style="display:none">Source</strong><strong data-lang="it" style="display:none">Provenienza</strong><br>${r.origine}</div>` : ""}
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

  syncTypeFromApt(document.getElementById("adminResaForm"));

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

// Affiche le champ "Origine" seulement si type = locataire
function syncOrigineField(form) {
  const type = form.querySelector("select[name='type']")?.value || "locataire";
  const origineGroup = document.getElementById("adminOrigineGroup");
  if (origineGroup) origineGroup.style.display = type === "locataire" ? "" : "none";
}

// Quand apt = "famille" → force type = "famille" et grise l'option "locataire"
function syncTypeFromApt(form) {
  const apt        = document.getElementById("adminAptSelect")?.value;
  const typeSelect = document.getElementById("adminTypeSelect");
  if (!typeSelect) return;

  if (apt === "famille") {
    typeSelect.value = "famille";
    // Grise l'option locataire
    typeSelect.querySelectorAll("option[value='locataire']").forEach(o => {
      o.disabled = true;
      o.style.color = "var(--gris)";
    });
  } else {
    // Restaure les options locataire
    typeSelect.querySelectorAll("option[value='locataire']").forEach(o => {
      o.disabled = false;
      o.style.color = "";
    });
    // Remet locataire par défaut si on repasse à un appt locatif
    if (typeSelect.value === "famille") typeSelect.value = "locataire";
  }

  // Resynchronise le champ origine selon le nouveau type
  syncOrigineField(form);
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

  // Affiche/masque le champ origine selon le type
  const typeSelect = form.querySelector("select[name='type']");
  typeSelect?.addEventListener("change", () => syncOrigineField(form));
  syncOrigineField(form);

  // Quand l'appartement change :
  // – si "1er étage (famille)" → force type=famille, grise locataire
  // – sinon → restaure le select type
  const aptSelect = document.getElementById("adminAptSelect");
  aptSelect?.addEventListener("change", () => syncTypeFromApt(form));
  syncTypeFromApt(form);

  btn.addEventListener("click", async () => {
    const apt    = form.querySelector("select[name='apt']").value;
    const statut = form.querySelector("select[name='statut']").value;
    const start  = form.querySelector("input[name='start']").value;
    const end    = form.querySelector("input[name='end']").value;
    const tenant   = form.querySelector("input[name='tenant']").value;
    const email    = document.getElementById("adminEmail")?.value.trim() || "";
    const phone    = document.getElementById("adminPhone")?.value.trim() || "";
    const notes    = document.getElementById("adminNotes")?.value || "";
    const type     = form.querySelector("select[name='type']")?.value || "locataire";
    const origine  = type === "locataire" ? (form.querySelector("select[name='origine']")?.value || "") : "";
    const pets     = form.querySelector("input[name='adminPets']")?.checked || false;
    const adults   = form.querySelector("select[name='adults']")?.value || "2";
    const children = form.querySelector("select[name='children']")?.value || "0";

    if (!start) { showToast("Veuillez saisir la date d'arrivée.", "error"); return; }
    if (!end)   { showToast("Veuillez saisir la date de départ.", "error"); return; }
    if (start > end) { showToast("La date de départ doit être après l'arrivée.", "error"); return; }

    btn.disabled = true;
    const editingId = window._editingId;

    try {
      const data = {
        apt, start, end,
        nom: tenant, tenant,
        email, phone,
        adults, children,
        statut, notes,
        type, origine, pets
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
  const rows  = [["Appartement","Type","Origine","Arrivée","Départ","Locataire","Email","Téléphone","Adultes","Enfants","Animal","Statut","Notes"]];
  sortReservations(resas).forEach(r => rows.push([
    APT_LABELS[r.apt]||r.apt, r.type||"", r.origine||"", r.start, r.end,
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
//  GESTION DES PÉRIODES FERMÉES (onglet Admin)
// ══════════════════════════════════════════════════
const APT_LABELS_FERME = { all: "Tous", famille: "1er étage", rdc: "RDC", "2eme": "2ème étage" };

function initPeriodesFermees() {
  subscribePeriodesStore(renderFermeList);

  const fermeStartEl = document.getElementById("fermeStart");
  const fermeEndEl   = document.getElementById("fermeEnd");
  linkArrivalDeparture(fermeStartEl, fermeEndEl);

  document.getElementById("addFermeBtn")?.addEventListener("click", async () => {
    const apt   = document.getElementById("fermeApt")?.value || "all";
    const start = fermeStartEl?.value;
    const end   = fermeEndEl?.value;
    const label = document.getElementById("fermeLabel")?.value.trim() || "";

    if (!start || !end) { showToast("Veuillez saisir les dates.", "error"); return; }
    if (start > end)    { showToast("La date de fin doit être après le début.", "error"); return; }

    try {
      await addPeriodeFermee({ apt, start, end, label });
      showToast("Période fermée ajoutée.", "success");
      fermeStartEl.value = "";
      fermeEndEl.value   = "";
      fermeEndEl.removeAttribute("min");
      document.getElementById("fermeLabel").value = "";
    } catch { showToast("Erreur lors de l'ajout.", "error"); }
  });
}

window.deleteFerme = async (id) => {
  if (!confirm("Supprimer cette période fermée ?")) return;
  try {
    await deletePeriodeFermee(id);
    showToast("Période supprimée.", "success");
  } catch { showToast("Erreur de suppression.", "error"); }
};

function renderFermeList(periodes) {
  const container = document.getElementById("fermeList");
  if (!container) return;
  if (!periodes || periodes.length === 0) {
    container.innerHTML = `<p style="color:var(--gris);font-size:0.88rem;font-style:italic;">Aucune période fermée.</p>`;
    return;
  }
  const sorted = [...periodes].sort((a,b) => (a.start||"").localeCompare(b.start||""));
  container.innerHTML = `<table class="planning-table" style="margin-bottom:0;">
    <thead><tr>
      <th>Appartement</th><th>Du</th><th>Au</th><th>Libellé</th><th></th>
    </tr></thead>
    <tbody>${sorted.map(p => `
      <tr>
        <td>${APT_LABELS_FERME[p.apt] || p.apt}</td>
        <td>${fmt(p.start)}</td>
        <td>${fmt(p.end)}</td>
        <td style="font-size:0.85rem;color:var(--gris)">${p.label || "—"}</td>
        <td><button onclick="deleteFerme('${p.id}')" class="btn-action btn-refuse" title="Supprimer">🗑</button></td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}

// ══════════════════════════════════════════════════
//  MIGRATION FIREBASE : "family" → "famille"
//  À appeler une seule fois depuis la console admin.
//  window.migrateTypeFamily()
// ══════════════════════════════════════════════════
window.migrateTypeFamily = async () => {
  const { getReservations, updateReservation } = await import("./firebase-db.js");
  const resas = await getReservations();
  const toFix = resas.filter(r => r.type === "family");
  if (toFix.length === 0) { showToast("Aucune migration nécessaire.", "success"); return; }
  for (const r of toFix) {
    await updateReservation(r.id, { type: "famille" });
  }
  showToast(`${toFix.length} enregistrement(s) migré(s) : "family" → "famille".`, "success");
};
document.addEventListener("DOMContentLoaded", () => {
  // Boutons mot de passe
  ["pwSubmitFr","pwSubmitEn","pwSubmitIt"].forEach(id =>
    document.getElementById(id)?.addEventListener("click", checkPassword)
  );
  document.getElementById("famillePassword")?.addEventListener("keydown", e => {
    if (e.key === "Enter") checkPassword();
  });

  // Auto-unlock si déjà authentifié cette session (vérifie le hash en session)
  const storedSessionHash = sessionStorage.getItem("famille_hash");
  if (sessionStorage.getItem("famille_auth") === "1" && storedSessionHash) {
    // Revérifie le hash contre Firestore pour s'assurer que le mot de passe n'a pas changé
    getFamilleHash().then(firestoreHash => {
      if (firestoreHash && storedSessionHash === firestoreHash) {
        const gate    = document.getElementById("passwordGate");
        const content = document.getElementById("privateContent");
        if (gate)    gate.style.display = "none";
        if (content) content.classList.add("unlocked");
        startFamilleApp();
      } else {
        // Mot de passe changé depuis la dernière session → force reconnexion
        sessionStorage.removeItem("famille_auth");
        sessionStorage.removeItem("famille_hash");
      }
    });
  } else {
    sessionStorage.removeItem("famille_auth");
    sessionStorage.removeItem("famille_hash");
  }
});
