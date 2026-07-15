// ══════════════════════════════════════════════════
//  CALENDRIER connecté à Firebase
// ══════════════════════════════════════════════════
import { subscribeReservations, addReservation, subscribePeriodesFermees, getPeriodesFermees } from "./firebase-db.js";

const MONTHS = {
  fr: ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"],
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  it: ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"]
};

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

function fmtShort(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

const STATUS_LABELS = {
  fr: { en_attente: "En attente", confirmee: "Confirmée", famille: "Famille", refusee: "Refusée", ferme: "Non ouvert" },
  en: { en_attente: "Pending",    confirmee: "Confirmed", famille: "Family",  refusee: "Refused",  ferme: "Not open" },
  it: { en_attente: "In attesa",  confirmee: "Confermata", famille: "Famiglia", refusee: "Rifiutata", ferme: "Non aperto" }
};

function statusLabel(statut) {
  const lang = localStorage.getItem("lang") || "fr";
  return (STATUS_LABELS[lang] || STATUS_LABELS.fr)[statut] || statut || "";
}

const APT_SHORT_LABELS = {
  fr: { rdc: "rdc", famille: "1er", "2eme": "2eme" },
  en: { rdc: "ground", famille: "1st", "2eme": "2nd" },
  it: { rdc: "pt", famille: "1°", "2eme": "2°" }
};

const COMBINED_STATUS_LABELS = {
  fr: { booked: "loué", pending: "en attente", famille: "occupé", free: "libre", ferme: "non ouvert", "ferme-pending": "non ouvert — en attente" },
  en: { booked: "booked", pending: "pending", famille: "occupied", free: "free", ferme: "not open", "ferme-pending": "not open — pending" },
  it: { booked: "affittato", pending: "in attesa", famille: "occupato", free: "libero", ferme: "non aperto", "ferme-pending": "non aperto — in attesa" }
};

// ══════════════════════════════════════════════════
//  STORE PARTAGÉ — réservations + périodes fermées
// ══════════════════════════════════════════════════
const _store = { data: [], loaded: false, listeners: new Set(), unsub: null };
const _storeFerme = { data: [], loaded: false, listeners: new Set(), unsub: null };

function _ensureStore() {
  if (!_store.unsub) {
    _store.unsub = subscribeReservations(resas => {
      _store.data = resas;
      _store.loaded = true;
      _store.listeners.forEach(fn => fn(resas));
    });
  }
  if (!_storeFerme.unsub) {
    _storeFerme.unsub = subscribePeriodesFermees(periodes => {
      _storeFerme.data = periodes;
      _storeFerme.loaded = true;
      _storeFerme.listeners.forEach(fn => fn(periodes));
      // Re-déclenche aussi les listeners de réservations pour re-rendre les calendriers
      _store.listeners.forEach(fn => fn(_store.data));
    });
  }
}

export function subscribeAll(callback) {
  _ensureStore();
  _store.listeners.add(callback);
  if (_store.loaded) callback(_store.data);
  return () => _store.listeners.delete(callback);
}

export function subscribePeriodesStore(callback) {
  _ensureStore();
  _storeFerme.listeners.add(callback);
  if (_storeFerme.loaded) callback(_storeFerme.data);
  return () => _storeFerme.listeners.delete(callback);
}

// Retourne la période fermée qui couvre dateStr pour un apt donné (ou null)
export function getPeriodeFermeeForDate(apt, dateStr) {
  return _storeFerme.data.find(p =>
    p.start <= dateStr && p.end >= dateStr &&
    (p.apt === apt || p.apt === "all")
  ) || null;
}

// Vérifie si un intervalle [start, end] chevauche une période fermée pour un apt
export function isRangeFermee(apt, start, end) {
  return _storeFerme.data.some(p =>
    (p.apt === apt || p.apt === "all") &&
    p.start <= end && p.end >= start
  );
}

// ══════════════════════════════════════════════════
//  CALENDRIER PAR APPARTEMENT
// ══════════════════════════════════════════════════
export class FirebaseCalendar {
  constructor(el, options = {}) {
    this.el        = el;
    this.apt       = options.apt || null;        // null = tous (vue famille)
    this.showNames = options.showNames || false; // afficher noms (page famille uniquement)
    this.current   = new Date();
    this.current.setDate(1);
    this.reservations = [];
    this.unsubscribe = subscribeAll(resas => {
      this.reservations = this.apt ? resas.filter(r => r.apt === this.apt) : resas;
      this.render();
    });
  }

  destroy() { if (this.unsubscribe) this.unsubscribe(); }

  render() {
    const grid  = this.el.querySelector(".calendar-grid");
    const title = this.el.querySelector(".calendar-nav h4");
    if (!grid || !title) return;

    const lang  = localStorage.getItem("lang") || "fr";
    const year  = this.current.getFullYear();
    const month = this.current.getMonth();
    title.textContent = (MONTHS[lang]?.[month] || MONTHS.fr[month]) + " " + year;

    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today       = new Date();
    const startOffset = (firstDay + 6) % 7;

    // Garde les en-têtes (7 premiers enfants), retire les jours
    const headers = Array.from(grid.children).filter(c => c.classList.contains("calendar-day-name"));
    grid.innerHTML = "";
    headers.forEach(h => grid.appendChild(h));

    for (let i = 0; i < startOffset; i++) {
      const e = document.createElement("div");
      e.className = "calendar-day empty";
      grid.appendChild(e);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const cell    = document.createElement("div");
      cell.className = "calendar-day";
      const isToday = today.getDate()===d && today.getMonth()===month && today.getFullYear()===year;
      if (isToday) cell.classList.add("today");

      const resa = this.reservations.find(r =>
        r.start <= dateStr && r.end >= dateStr &&
        (this.apt === null || r.apt === this.apt)
      );

      // Période fermée (peut coexister avec une réservation en attente)
      const fermee = getPeriodeFermeeForDate(this.apt || "all", dateStr) ||
                     (this.apt ? getPeriodeFermeeForDate("all", dateStr) : null);

      const lang = localStorage.getItem("lang") || "fr";
      const lblFerme   = STATUS_LABELS[lang]?.ferme   || "Non ouvert";
      const lblAttente = STATUS_LABELS[lang]?.en_attente || "En attente";

      if (fermee || resa) {
        // Classe de base : fermé prime sur le reste, sauf si on veut aussi montrer en_attente
        if (fermee) {
          cell.classList.add("ferme");
          if (fermee.start === dateStr) cell.classList.add("resa-start");
          if (fermee.end   === dateStr) cell.classList.add("resa-end");
        }

        if (resa) {
          if (resa.statut === "en_attente") {
            // Si fermé ET en attente : cumule les deux classes
            cell.classList.add("pending");
          } else if (!fermee) {
            // Pas fermé : affichage normal selon statut
            if (resa.type === "famille" || resa.statut === "famille" || resa.apt === "famille") {
              cell.classList.add("reserved-family");
            } else {
              cell.classList.add("booked");
            }
            const variant = (hashStr(String(resa.id || resa.start + resa.end)) % 4) + 1;
            cell.classList.add(`variant-${variant}`);
          }
          if (resa.start === dateStr) cell.classList.add("resa-start");
          if (resa.end   === dateStr) cell.classList.add("resa-end");
        }

        const dot = document.createElement("span");
        dot.className = "day-dot";
        cell.appendChild(dot);

        // Tooltip et libellé visible
        if (this.showNames && resa) {
          const name  = (resa.tenant || resa.nom || "").trim();
          const range = `${fmtShort(resa.start)} → ${fmtShort(resa.end)}`;

          if (name) {
            const label = document.createElement("span");
            label.className = "day-tenant";
            label.textContent = name.split(/\s+/)[0];
            cell.appendChild(label);
          }

          if (fermee && resa.statut === "en_attente") {
            // "non ouvert - en attente <nom>"
            cell.title = `${lblFerme} — ${lblAttente}${name ? " " + name : ""} (${range})`;
          } else if (fermee) {
            cell.title = lblFerme;
          } else {
            const status = statusLabel(resa.statut);
            cell.title = (name ? `${name} (${range})` : range) + (status ? ` — ${status}` : "");
          }
        } else if (fermee && resa?.statut === "en_attente") {
          cell.title = `${lblFerme} — ${lblAttente}`;
        } else if (fermee) {
          cell.title = lblFerme;
        } else if (resa) {
          cell.title = `${fmtShort(resa.start)} → ${fmtShort(resa.end)}`;
        }
      }

      const num = document.createElement("span");
      num.className = "day-num";
      num.textContent = d;
      cell.appendChild(num);
      grid.appendChild(cell);
    }
  }

  prev() { this.current.setMonth(this.current.getMonth()-1); this.render(); }
  next() { this.current.setMonth(this.current.getMonth()+1); this.render(); }
}

// ══════════════════════════════════════════════════
//  CALENDRIER COMBINÉ (3 appartements en un seul)
// ══════════════════════════════════════════════════
const APT_ORDER = ["rdc", "famille", "2eme"];

export class CombinedCalendar {
  constructor(el) {
    this.el = el;
    this.current = new Date();
    this.current.setDate(1);
    this.reservations = [];
    this.unsubscribe = subscribeAll(resas => {
      this.reservations = resas;
      this.render();
    });
  }

  destroy() { if (this.unsubscribe) this.unsubscribe(); }

  _resaFor(apt, dateStr) {
    return this.reservations.find(r =>
      r.apt === apt && r.start <= dateStr && r.end >= dateStr
    );
  }

  _statusFor(apt, dateStr) {
    const fermee = getPeriodeFermeeForDate(apt, dateStr) ||
                   getPeriodeFermeeForDate("all", dateStr);
    const resa = this._resaFor(apt, dateStr);
    if (fermee && resa?.statut === "en_attente") return "ferme-pending";
    if (fermee) return "ferme";
    if (!resa) return "free";
    if (resa.statut === "en_attente") return "pending";
    if (apt === "famille" || resa.type === "famille" || resa.statut === "famille") return "famille";
    return "booked";
  }

  render() {
    const grid  = this.el.querySelector(".calendar-grid");
    const title = this.el.querySelector(".calendar-nav h4");
    if (!grid || !title) return;

    const lang  = localStorage.getItem("lang") || "fr";
    const year  = this.current.getFullYear();
    const month = this.current.getMonth();
    title.textContent = (MONTHS[lang]?.[month] || MONTHS.fr[month]) + " " + year;

    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today       = new Date();
    const startOffset = (firstDay + 6) % 7;

    const headers = Array.from(grid.children).filter(c => c.classList.contains("calendar-day-name"));
    grid.innerHTML = "";
    headers.forEach(h => grid.appendChild(h));

    for (let i = 0; i < startOffset; i++) {
      const e = document.createElement("div");
      e.className = "calendar-day combined empty";
      grid.appendChild(e);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const cell = document.createElement("div");
      cell.className = "calendar-day combined";
      const isToday = today.getDate()===d && today.getMonth()===month && today.getFullYear()===year;
      if (isToday) cell.classList.add("today");

      const num = document.createElement("span");
      num.className = "day-num";
      num.textContent = d;
      cell.appendChild(num);

      const bars = document.createElement("div");
      bars.className = "combined-bars";

      const lang2 = localStorage.getItem("lang") || "fr";
      const aptLabels    = APT_SHORT_LABELS[lang2] || APT_SHORT_LABELS.fr;
      const statusLabels = COMBINED_STATUS_LABELS[lang2] || COMBINED_STATUS_LABELS.fr;

      const tooltips = [];
      APT_ORDER.forEach(apt => {
        const status = this._statusFor(apt, dateStr);
        const bar = document.createElement("div");
        // "ferme-pending" → barre rouge comme ferme
        bar.className = `combined-bar bar-${apt} status-${status === "ferme-pending" ? "ferme" : status}`;
        bars.appendChild(bar);

        const resa = this._resaFor(apt, dateStr);
        const name = (resa?.tenant || resa?.nom || "").trim();

        if (status === "ferme-pending") {
          const lblFerme   = statusLabels.ferme   || "non ouvert";
          const lblAttente = statusLabels.pending  || "en attente";
          tooltips.push(`${aptLabels[apt]}: ${lblFerme} — ${lblAttente}${name ? " " + name : ""}`);
        } else if (status !== "free") {
          const suffix = name ? ` — ${name}` : "";
          tooltips.push(`${aptLabels[apt]}: ${statusLabels[status] || status}${suffix}`);
        } else {
          tooltips.push(`${aptLabels[apt]}: ${statusLabels.free || "libre"}`);
        }
      });
      cell.title = tooltips.join("\n");

      cell.appendChild(bars);
      grid.appendChild(cell);
    }
  }

  prev() { this.current.setMonth(this.current.getMonth()-1); this.render(); }
  next() { this.current.setMonth(this.current.getMonth()+1); this.render(); }
}

// ══════════════════════════════════════════════════
//  INIT DE TOUS LES CALENDRIERS SUR LA PAGE
// ══════════════════════════════════════════════════
export function initCalendars() {
  const cals = {};
  document.querySelectorAll("[data-calendar]").forEach(el => {
    const key = el.dataset.calendar;
    let cal;
    if (key === "combined") {
      cal = new CombinedCalendar(el);
    } else {
      const apt = key === "all" ? null : key;
      const showNames = el.dataset.showNames === "true";
      cal = new FirebaseCalendar(el, { apt, showNames });
    }
    cals[key] = cal;
    el.querySelector(".cal-prev")?.addEventListener("click", () => cal.prev());
    el.querySelector(".cal-next")?.addEventListener("click", () => cal.next());
  });
  window.calendars = cals;
  return cals;
}

// ══════════════════════════════════════════════════
//  CONTRAINTE DE DATES — la date de départ ne peut
//  pas être antérieure à la date d'arrivée
// ══════════════════════════════════════════════════
export function linkArrivalDeparture(arrivalInput, departureInput) {
  if (!arrivalInput || !departureInput) return;
  const sync = () => {
    if (arrivalInput.value) {
      departureInput.min = arrivalInput.value;
      if (departureInput.value && departureInput.value < arrivalInput.value) {
        departureInput.value = "";
      }
    } else {
      departureInput.removeAttribute("min");
    }
  };
  arrivalInput.addEventListener("change", sync);
  sync();
}

// ══════════════════════════════════════════════════
//  FORMULAIRE DE DEMANDE (locataires & famille)
// ══════════════════════════════════════════════════
export function initResaForms() {
  document.querySelectorAll("form.resa-form").forEach(form => {
    const arrivalInput   = form.querySelector("[name='arrival']");
    const departureInput = form.querySelector("[name='departure']");
    linkArrivalDeparture(arrivalInput, departureInput);

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const lang = localStorage.getItem("lang") || "fr";

      // L'appartement vient soit d'un <select name="apt"> (page famille),
      // soit de l'attribut data-apt (pages RDC / 2e étage)
      const aptSelect = form.querySelector("[name='apt']");
      const apt = aptSelect ? aptSelect.value : form.dataset.apt;

      const nom      = form.querySelector("[name='name']").value.trim();
      const email    = form.querySelector("[name='email']").value.trim();
      const phone    = form.querySelector("[name='phone']")?.value.trim() || "";
      const start    = arrivalInput.value;
      const end      = departureInput.value;
      const adults   = form.querySelector("[name='adults']")?.value || "1";
      const children = form.querySelector("[name='children']")?.value || "0";
      const pets     = form.querySelector("[name='pets']")?.checked || false;
      const message  = form.querySelector("[name='message']")?.value || "";

      const btns = form.querySelectorAll("[type='submit']");
      btns.forEach(b => b.disabled = true);

      // Vérifie si les dates chevauchent une période fermée (public uniquement)
      if (isRangeFermee(apt, start, end)) {
        const msgs = {
          fr: "Ces dates ne sont pas encore ouvertes à la réservation. Contactez-nous pour plus d'informations.",
          en: "These dates are not yet open for booking. Please contact us for more information.",
          it: "Queste date non sono ancora aperte alle prenotazioni. Contattateci per ulteriori informazioni."
        };
        showToast(msgs[lang] || msgs.fr, "error");
        btns.forEach(b => b.disabled = false);
        return;
      }

      try {
        await addReservation({
          apt, nom, email, phone, start, end, adults, children, pets, message,
          statut: "en_attente",
          type: "locataire",
          origine: "site web"
        });
        const msgs = { fr: "Demande envoyée ! Nous vous répondrons sous 48h.", en: "Request sent! We'll reply within 48h.", it: "Richiesta inviata! Risponderemo entro 48h." };
        showToast(msgs[lang] || msgs.fr, "success");
        form.reset();
        departureInput.removeAttribute("min");
      } catch {
        const msgs = { fr: "Erreur d'envoi. Contactez-nous par email.", en: "Send error. Please contact us by email.", it: "Errore. Contattateci per email." };
        showToast(msgs[lang] || msgs.fr, "error");
      } finally {
        btns.forEach(b => b.disabled = false);
      }
    });
  });
}
