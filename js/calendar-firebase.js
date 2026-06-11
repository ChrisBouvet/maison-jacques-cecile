// ══════════════════════════════════════════════════
//  CALENDRIER connecté à Firebase
// ══════════════════════════════════════════════════
import { subscribeReservations, addReservation } from "./firebase-db.js";

const MONTHS = {
  fr: ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"],
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  it: ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"]
};

// Petit hash déterministe pour attribuer une variante de couleur par réservation
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

// ══════════════════════════════════════════════════
//  STORE PARTAGÉ — un seul listener Firestore pour
//  toute la page (calendriers + tableau récapitulatif)
// ══════════════════════════════════════════════════
const _store = { data: [], loaded: false, listeners: new Set(), unsub: null };

function _ensureStore() {
  if (!_store.unsub) {
    _store.unsub = subscribeReservations(resas => {
      _store.data = resas;
      _store.loaded = true;
      _store.listeners.forEach(fn => fn(resas));
    });
  }
}

// S'abonne aux changements de réservations (temps réel).
// Retourne une fonction de désabonnement.
export function subscribeAll(callback) {
  _ensureStore();
  _store.listeners.add(callback);
  if (_store.loaded) callback(_store.data);
  return () => _store.listeners.delete(callback);
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

      if (resa) {
        let baseClass;
        if (resa.statut === "en_attente") {
          baseClass = "pending";
        } else if (resa.type === "family" || resa.statut === "famille") {
          baseClass = "reserved-family";
        } else {
          baseClass = "booked";
        }
        cell.classList.add(baseClass);

        // Variante de couleur par réservation (pour distinguer 2 réservations consécutives du même type)
        const variant = (hashStr(String(resa.id || resa.start + resa.end)) % 4) + 1;
        cell.classList.add(`variant-${variant}`);

        // Marque le début / fin du séjour (coins arrondis pour délimiter le bloc)
        if (resa.start === dateStr) cell.classList.add("resa-start");
        if (resa.end === dateStr) cell.classList.add("resa-end");

        const dot = document.createElement("span");
        dot.className = "day-dot";
        cell.appendChild(dot);

        const range = `${fmtShort(resa.start)} → ${fmtShort(resa.end)}`;
        const name  = (resa.tenant || resa.nom || "").trim();

        if (this.showNames) {
          if (name) {
            const label = document.createElement("span");
            label.className = "day-tenant";
            label.textContent = name.split(/\s+/)[0];
            cell.appendChild(label);
          }
          cell.title = name ? `${name} (${range})` : range;
        } else {
          cell.title = range;
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
const APT_ORDER = ["famille", "rdc", "2eme"];

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
    const resa = this._resaFor(apt, dateStr);
    if (!resa) return "free";
    if (resa.statut === "en_attente") return "pending";
    if (apt === "famille" || resa.type === "family" || resa.statut === "famille") return "famille";
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

      const tooltips = [];
      APT_ORDER.forEach(apt => {
        const status = this._statusFor(apt, dateStr);
        const bar = document.createElement("div");
        bar.className = `combined-bar bar-${apt} status-${status}`;
        bars.appendChild(bar);
        if (status !== "free") {
          const labels = { famille: "1er", rdc: "RDC", "2eme": "2e" };
          const statusLabels = { booked: "loué", pending: "en attente", famille: "occupé" };
          const resa = this._resaFor(apt, dateStr);
          const name = (resa?.tenant || resa?.nom || "").trim();
          const suffix = name ? ` — ${name}` : "";
          tooltips.push(`${labels[apt]}: ${statusLabels[status]}${suffix}`);
        }
      });
      if (tooltips.length) cell.title = tooltips.join("\n");

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

      const nom     = form.querySelector("[name='name']").value.trim();
      const email   = form.querySelector("[name='email']").value.trim();
      const start   = arrivalInput.value;
      const end     = departureInput.value;
      const guests  = form.querySelector("[name='guests']")?.value || "";
      const message = form.querySelector("[name='message']")?.value || "";

      const btns = form.querySelectorAll("[type='submit']");
      btns.forEach(b => b.disabled = true);

      try {
        await addReservation({
          apt, nom, email, start, end, guests, message,
          statut: "en_attente",
          type: apt === "famille" ? "family" : "locataire"
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
