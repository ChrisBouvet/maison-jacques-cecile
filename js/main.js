// ── NAV SCROLL EFFECT ──
const nav = document.querySelector('.nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  });
}

// ── BURGER MENU ──
const burger = document.querySelector('.nav__burger');
const navLinks = document.querySelector('.nav__links');
if (burger && navLinks) {
  burger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}

// ── LANGUAGE SWITCHER ──
function setLang(lang) {
  localStorage.setItem('lang', lang);
  document.querySelectorAll('[data-lang]').forEach(el => {
    el.style.display = el.dataset.lang === lang ? '' : 'none';
  });
  document.querySelectorAll('.nav__lang a').forEach(a => {
    a.classList.toggle('active', a.dataset.langbtn === lang);
  });
}

document.querySelectorAll('.nav__lang a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    setLang(a.dataset.langbtn);
  });
});

// Init language from localStorage or browser
const savedLang = localStorage.getItem('lang') || (navigator.language.startsWith('it') ? 'it' : navigator.language.startsWith('fr') ? 'fr' : 'en');
setLang(['fr','en','it'].includes(savedLang) ? savedLang : 'fr');

// ── ACCORDION ──
document.querySelectorAll('.accordion-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const content = btn.nextElementSibling;
    const isOpen = btn.classList.contains('open');
    // Close all
    document.querySelectorAll('.accordion-btn.open').forEach(b => {
      b.classList.remove('open');
      b.nextElementSibling.style.maxHeight = null;
    });
    if (!isOpen) {
      btn.classList.add('open');
      content.style.maxHeight = content.scrollHeight + 'px';
    }
  });
});

// ── TABS ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    const container = btn.closest('.tabs');
    container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    container.querySelector(`[data-panel="${target}"]`).classList.add('active');
  });
});

// ── CALENDAR ──
class Calendar {
  constructor(el, options = {}) {
    this.el = el;
    this.options = options;
    this.current = new Date();
    this.current.setDate(1);
    this.reservations = JSON.parse(localStorage.getItem('reservations_' + (options.apt || 'all')) || '[]');
    this.render();
  }

  render() {
    const grid = this.el.querySelector('.calendar-grid');
    const title = this.el.querySelector('.calendar-nav h4');
    if (!grid || !title) return;

    const year = this.current.getFullYear();
    const month = this.current.getMonth();
    const months = {
      fr: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
      en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      it: ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
    };
    const lang = localStorage.getItem('lang') || 'fr';
    title.textContent = (months[lang]?.[month] || months.fr[month]) + ' ' + year;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    // Remove existing day cells (keep headers)
    grid.querySelectorAll('.calendar-day').forEach(d => d.remove());

    // Empty cells before first day
    const startOffset = (firstDay + 6) % 7; // Mon-based
    for (let i = 0; i < startOffset; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-day empty';
      grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-day';
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
      if (isToday) cell.classList.add('today');

      const resa = this.reservations.find(r => r.start <= dateStr && r.end >= dateStr);
      if (resa) {
        cell.classList.add(resa.type === 'family' ? 'reserved-family' : 'booked');
        const dot = document.createElement('span');
        dot.className = 'day-dot';
        cell.appendChild(dot);
      }

      const num = document.createElement('span');
      num.className = 'day-num';
      num.textContent = d;
      cell.appendChild(num);

      if (this.options.selectable && !resa) {
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', () => this.selectDate(dateStr, cell));
      }
      grid.appendChild(cell);
    }
  }

  selectDate(date, cell) {
    if (!this.selectedStart) {
      this.el.querySelectorAll('.calendar-day.selected').forEach(c => c.classList.remove('selected'));
      this.selectedStart = date;
      cell.classList.add('selected');
      cell.style.background = 'rgba(201,169,110,0.3)';
    } else {
      this.selectedEnd = date;
      if (this.options.onSelect) {
        this.options.onSelect(this.selectedStart, this.selectedEnd);
      }
      this.selectedStart = null;
    }
  }

  prev() {
    this.current.setMonth(this.current.getMonth() - 1);
    this.render();
  }
  next() {
    this.current.setMonth(this.current.getMonth() + 1);
    this.render();
  }

  addReservation(r) {
    this.reservations.push(r);
    localStorage.setItem('reservations_' + (this.options.apt || 'all'), JSON.stringify(this.reservations));
    this.render();
  }

  getReservations() { return this.reservations; }
}

// Init calendars on page
const calEls = document.querySelectorAll('[data-calendar]');
const calendars = {};
calEls.forEach(el => {
  const apt = el.dataset.calendar;
  const selectable = el.dataset.selectable === 'true';
  const cal = new Calendar(el, { apt, selectable });
  calendars[apt] = cal;

  el.querySelector('.cal-prev')?.addEventListener('click', () => cal.prev());
  el.querySelector('.cal-next')?.addEventListener('click', () => cal.next());
});

// ── RESERVATION REQUEST FORM ──
document.querySelectorAll('.resa-form').forEach(form => {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const apt = form.dataset.apt;
    const name = form.querySelector('[name="name"]').value;
    const email = form.querySelector('[name="email"]').value;
    const arrival = form.querySelector('[name="arrival"]').value;
    const departure = form.querySelector('[name="departure"]').value;
    const guests = form.querySelector('[name="guests"]').value;
    const msg = form.querySelector('[name="message"]')?.value || '';

    // Compose mailto
    const subjectMap = { fr: `Demande de réservation - ${apt}`, en: `Booking request - ${apt}`, it: `Richiesta di prenotazione - ${apt}` };
    const lang = localStorage.getItem('lang') || 'fr';
    const subject = encodeURIComponent(subjectMap[lang] || subjectMap.fr);
    const body = encodeURIComponent(`Nom: ${name}\nEmail: ${email}\nArrivée: ${arrival}\nDépart: ${departure}\nPersonnes: ${guests}\n\n${msg}`);
    window.location.href = `mailto:contact@maison-jacques-cecile.fr?subject=${subject}&body=${body}`;
    showToast(lang === 'fr' ? 'Votre demande a été préparée !' : lang === 'it' ? 'La tua richiesta è pronta!' : 'Your request is ready!', 'success');
    form.reset();
  });
});

// ── ADMIN PANEL ──
const ADMIN_PASSWORD = 'montgenèvre2024'; // Change in production
let isAdmin = false;

const adminToggle = document.querySelector('.admin-toggle');
const adminOverlay = document.querySelector('.admin-overlay');
const adminClose = document.querySelector('.admin-close');
const adminForm = document.querySelector('.admin-login-form');
const adminPanel = document.querySelector('.admin-panel');

if (adminToggle && adminOverlay) {
  adminToggle.addEventListener('click', () => {
    adminOverlay.classList.add('open');
  });
  adminClose?.addEventListener('click', () => adminOverlay.classList.remove('open'));
  adminOverlay.addEventListener('click', e => { if (e.target === adminOverlay) adminOverlay.classList.remove('open'); });
}

if (adminForm) {
  adminForm.addEventListener('submit', e => {
    e.preventDefault();
    const pw = adminForm.querySelector('[name="password"]').value;
    if (pw === ADMIN_PASSWORD) {
      isAdmin = true;
      adminForm.style.display = 'none';
      adminPanel?.style.setProperty('display','block');
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
      showToast('Accès administrateur accordé', 'success');
    } else {
      showToast('Mot de passe incorrect', 'error');
    }
  });
}

// Admin — add reservation
const adminResaForm = document.querySelector('.admin-resa-form');
if (adminResaForm) {
  adminResaForm.addEventListener('submit', e => {
    e.preventDefault();
    const apt = adminResaForm.querySelector('[name="apt"]').value;
    const start = adminResaForm.querySelector('[name="start"]').value;
    const end = adminResaForm.querySelector('[name="end"]').value;
    const tenant = adminResaForm.querySelector('[name="tenant"]').value;
    const type = adminResaForm.querySelector('[name="type"]').value;
    if (calendars[apt]) {
      calendars[apt].addReservation({ start, end, tenant, type });
      showToast('Réservation ajoutée !', 'success');
      adminResaForm.reset();
    }
  });
}

// ── TOAST ──
function showToast(msg, type = '') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 4000);
}

// ── SMOOTH REVEAL ON SCROLL ──
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});
