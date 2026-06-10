// ══════════════════════════════════════════════════
//  CALENDRIER connecté à Firebase
//  Remplace l'ancien Calendar qui utilisait localStorage
// ══════════════════════════════════════════════════
import { subscribeReservations, getReservations, addReservation } from "./firebase-db.js";

const MONTHS = {
  fr: ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"],
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  it: ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"]
};

export class FirebaseCalendar {
  constructor(el, options = {}) {
    this.el       = el;
    this.apt      = options.apt || null;   // null = tous (page famille)
    this.current  = new Date();
    this.current.setDate(1);
    this.reservations = [];
    this.unsubscribe  = null;
    this._init();
  }

  _init() {
    // Écoute temps réel si page famille (apt=null), lecture simple sinon
    if (this.apt === null) {
      this.unsubscribe = subscribeReservations(resas => {
        this.reservations = resas;
        this.render();
        if (window.refreshFamilleTable) window.refreshFamilleTable(resas);
      });
    } else {
      getReservations(this.apt).then(resas => {
        this.reservations = resas;
        this.render();
      });
    }
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
        if (resa.statut === "en_attente") {
          cell.classList.add("pending");
        } else if (resa.type === "family" || resa.statut === "famille") {
          cell.classList.add("reserved-family");
        } else {
          cell.classList.add("booked");
        }
        const dot = document.createElement("span");
        dot.className = "day-dot";
        cell.appendChild(dot);
        cell.title = resa.tenant || resa.nom || "";
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

// ── CALENDRIER COMBINÉ (3 appartements en un seul) ──
const APT_ORDER = ["famille", "rdc", "2eme"];

export class CombinedCalendar {
  constructor(el) {
    this.el = el;
    this.current = new Date();
    this.current.setDate(1);
    this.reservations = [];
    this.unsubscribe = subscribeReservations(resas => {
      this.reservations = resas;
      this.render();
    });
  }

  destroy() { if (this.unsubscribe) this.unsubscribe(); }

  _statusFor(apt, dateStr) {
    const resa = this.reservations.find(r =>
      r.apt === apt && r.start <= dateStr && r.end >= dateStr
    );
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
          tooltips.push(`${labels[apt]}: ${statusLabels[status]}`);
        }
      });
      if (tooltips.length) cell.title = tooltips.join(" · ");

      cell.appendChild(bars);
      grid.appendChild(cell);
    }
  }

  prev() { this.current.setMonth(this.current.getMonth()-1); this.render(); }
  next() { this.current.setMonth(this.current.getMonth()+1); this.render(); }
}

// ── INIT DE TOUS LES CALENDRIERS SUR LA PAGE ──
export function initCalendars() {
  const cals = {};
  document.querySelectorAll("[data-calendar]").forEach(el => {
    const key = el.dataset.calendar;
    let cal;
    if (key === "combined") {
      cal = new CombinedCalendar(el);
    } else {
      const apt = key === "all" ? null : key;
      cal = new FirebaseCalendar(el, { apt });
    }
    cals[key] = cal;
    el.querySelector(".cal-prev")?.addEventListener("click", () => cal.prev());
    el.querySelector(".cal-next")?.addEventListener("click", () => cal.next());
  });
  window.calendars = cals;
  return cals;
}

// ── FORMULAIRE DE DEMANDE (locataires) ──
export function initResaForms() {
  document.querySelectorAll(".resa-form").forEach(form => {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const lang    = localStorage.getItem("lang") || "fr";
      const apt     = form.dataset.apt;
      const nom     = form.querySelector("[name='name']").value.trim();
      const email   = form.querySelector("[name='email']").value.trim();
      const start   = form.querySelector("[name='arrival']").value;
      const end     = form.querySelector("[name='departure']").value;
      const guests  = form.querySelector("[name='guests']").value;
      const message = form.querySelector("[name='message']")?.value || "";

      const btn = form.querySelector("[type='submit']");
      btn.disabled = true;

      try {
        await addReservation({ apt, nom, email, start, end, guests, message, statut: "en_attente", type: "locataire" });
        const msgs = { fr: "Demande envoyée ! Nous vous répondrons sous 48h.", en: "Request sent! We'll reply within 48h.", it: "Richiesta inviata! Risponderemo entro 48h." };
        showToast(msgs[lang] || msgs.fr, "success");
        form.reset();
      } catch {
        const msgs = { fr: "Erreur d'envoi. Contactez-nous par email.", en: "Send error. Please contact us by email.", it: "Errore. Contattateci per email." };
        showToast(msgs[lang] || msgs.fr, "error");
      } finally {
        btn.disabled = false;
      }
    });
  });
}
