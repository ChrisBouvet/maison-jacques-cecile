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
  // Re-render any Firebase calendars so month names / tooltips follow the new language
  if (window.calendars) {
    Object.values(window.calendars).forEach(cal => cal.render && cal.render());
  }
}

// Délégation d'événements : fonctionne même si la nav est injectée après (pages rdc/2eme/famille)
document.addEventListener('click', e => {
  const a = e.target.closest('.nav__lang a[data-langbtn]');
  if (!a) return;
  e.preventDefault();
  setLang(a.dataset.langbtn);
});

// Init language from localStorage or browser
const savedLang = localStorage.getItem('lang') || (navigator.language.startsWith('it') ? 'it' : navigator.language.startsWith('fr') ? 'fr' : 'en');

// Sur les pages avec nav injectée, on attend que initNav() ait tourné
if (document.querySelector('.nav__logo')) {
  // Nav statique (index.html) : applique tout de suite
  setLang(['fr','en','it'].includes(savedLang) ? savedLang : 'fr');
} else {
  // Nav dynamique (rdc/2eme/famille) : attend le DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    setLang(['fr','en','it'].includes(savedLang) ? savedLang : 'fr');
  });
}

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

// ── TOAST ──
// Utilisé par calendar-firebase.js / famille-firebase.js / apartment-firebase.js
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
window.showToast = showToast;

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
