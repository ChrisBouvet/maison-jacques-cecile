import { addReservation, updateReservation, deleteReservation, subscribeReservations } from "./firebase-db.js";
import { initCalendars } from "./calendar-firebase.js";

// ── MOT DE PASSE FAMILLE ──
const FAMILLE_PASSWORD = "bouvet2024";

function checkPassword() {
  const input   = document.getElementById("famillePassword");
  const gate    = document.getElementById("passwordGate");
  const content = document.getElementById("privateContent");
  if (!input) return;

  if (input.value === FAMILLE_PASSWORD) {
    gate.style.display = "none";
    content.classList.add("unlocked");
    sessionStorage.setItem("famille_auth", "1");
    startFamilleApp();
  } else {
    document.querySelectorAll("#pwError").forEach(e => e.style.display = "block");
    input.value = "";
    input.focus();
  }
}

function startFamilleApp() {
  // Initialise les 3 calendriers (apt=null = tous)
  const cals = initCalendars();

  // Écoute temps réel → mise à jour table
  window.refreshFamilleTable = renderTable;
  subscribeReservations(renderTable);

  initAdminForm(cals);
}

// ── TABLE DES RÉSERVATIONS ──
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

function renderTable(resas) {
  const tbody = document.getElementById("reservationTableBody");
  if (!tbody) return;

  if (!resas || resas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--gris);font-style:italic;padding:1.5rem;">Aucune réservation.</td></tr>`;
    return;
  }

  const sorted = [...resas].sort((a,b) => (a.start||"").localeCompare(b.start||""));
  tbody.innerHTML = sorted.map(r => `
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
            <button onclick="confirmResa('${r.id}')" class="btn-action btn-confirm" title="Confirmer">✓</button>
            <button onclick="refuseResa('${r.id}')" class="btn-action btn-refuse" title="Refuser">✗</button>
          ` : ""}
          <button onclick="deleteResa('${r.id}')" class="btn-action btn-delete" title="Supprimer">🗑</button>
        </div>
      </td>
    </tr>
  `).join("");
}

// ── ACTIONS ADMIN ──
window.confirmResa = async (id) => {
  try {
    await updateReservation(id, { statut: "confirmee" });
    showToast("Réservation confirmée !", "success");
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
  } catch { showToast("Erreur de suppression.", "error"); }
};

// ── FORMULAIRE ADMIN (ajout direct) ──
function initAdminForm(cals) {
  const form = document.getElementById("adminResaForm");
  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const apt    = form.querySelector("[name='apt']").value;
    const start  = form.querySelector("[name='start']").value;
    const end    = form.querySelector("[name='end']").value;
    const tenant = form.querySelector("[name='tenant']").value;
    const type   = form.querySelector("[name='type']").value;
    const notes  = form.querySelector("[name='notes']")?.value || "";

    if (!start || !end) { showToast("Veuillez saisir les dates.", "error"); return; }
    if (start > end)    { showToast("Date de départ invalide.", "error"); return; }

    const btn = form.querySelector("[type='submit']");
    btn.disabled = true;
    try {
      await addReservation({
        apt, start, end,
        nom: tenant, tenant,
        type, notes,
        statut: type === "family" ? "famille" : "confirmee"
      });
      showToast("Réservation ajoutée !", "success");
      form.reset();
      // Refresh calendars
      Object.values(cals).forEach(c => c._init && c._init());
    } catch { showToast("Erreur d'enregistrement.", "error"); }
    finally { btn.disabled = false; }
  });
}

// ── EXPORT CSV ──
window.exportReservations = async () => {
  const { getReservations } = await import("./firebase-db.js");
  const resas = await getReservations();
  const rows  = [["Appartement","Arrivée","Départ","Locataire","Email","Statut","Notes"]];
  resas.forEach(r => rows.push([
    APT_LABELS[r.apt]||r.apt, r.start, r.end,
    r.nom||r.tenant||"", r.email||"", r.statut, r.notes||r.message||""
  ]));
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv], { type:"text/csv;charset=utf-8;" });
  const a    = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `reservations-bouvet-${new Date().toISOString().slice(0,10)}.csv`
  });
  a.click(); URL.revokeObjectURL(a.href);
};

// ── INIT PAGE ──
document.addEventListener("DOMContentLoaded", () => {
  // Boutons mot de passe
  ["pwSubmitFr","pwSubmitEn","pwSubmitIt"].forEach(id =>
    document.getElementById(id)?.addEventListener("click", checkPassword)
  );
  document.getElementById("famillePassword")?.addEventListener("keydown", e => {
    if (e.key === "Enter") checkPassword();
  });

  // Auto-unlock si déjà authentifié cette session
  if (sessionStorage.getItem("famille_auth") === "1") {
    const gate    = document.getElementById("passwordGate");
    const content = document.getElementById("privateContent");
    if (gate)    gate.style.display = "none";
    if (content) content.classList.add("unlocked");
    startFamilleApp();
  }

  // Refresh table sur onglet planning
  document.querySelectorAll(".tab-btn").forEach(btn =>
    btn.addEventListener("click", () => {
      if (btn.dataset.tab === "planning") setTimeout(() => {
        subscribeReservations(renderTable);
      }, 100);
    })
  );
});
