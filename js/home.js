// ── HERO BACKGROUND PHOTO ──
function setHeroBg(season) {
  const el = document.getElementById('heroBg');
  if (!el) return;
  el.classList.toggle('summer', season === 'summer');
}

// ── PHOTO DE LA MAISON (hiver / été) ──
function setMaisonPhoto(season) {
  const img = document.getElementById('maisonPhoto');
  if (!img) return;
  const url = season === 'summer' ? img.dataset.summer : img.dataset.winter;
  if (url && img.getAttribute('src') !== url) {
    // Réaffiche l'image (au cas où elle aurait été masquée par onerror précédemment)
    img.style.display = '';
    img.nextElementSibling.style.display = 'none';
    img.src = url;
  }
}

// ── SEASON TOGGLE (Hero) ──
let currentSeason = 'winter';

document.querySelectorAll('.season-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const season = btn.dataset.season;
    if (season === currentSeason) return;
    currentSeason = season;

    document.querySelectorAll('.season-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.season === season);
    });

    // Show correct hero content
    document.querySelectorAll('[data-season-content]').forEach(el => {
      const lang = el.dataset.lang;
      const activeLang = localStorage.getItem('lang') || 'fr';
      el.style.display = (el.dataset.seasonContent === season && lang === activeLang) ? '' : 'none';
    });

    // Update hero background with real Montgenèvre photos
    setHeroBg(season);

    // Update house photo (été / hiver)
    setMaisonPhoto(season);
  });
});

// ── SEASON TABS (Station section) ──
document.querySelectorAll('.season-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.stab;
    document.querySelectorAll('.season-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.season-tab-content').forEach(c => {
      c.style.display = c.dataset.stabContent === tab ? '' : 'none';
      c.classList.toggle('active', c.dataset.stabContent === tab);
    });
  });
});

// ── CONTACT FORM ──
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    const lang = localStorage.getItem('lang') || 'fr';
    const name = contactForm.querySelector('[name="name"]').value;
    const email = contactForm.querySelector('[name="email"]').value;
    const apt = contactForm.querySelector('[name="apt"]').value;
    const message = contactForm.querySelector('[name="message"]').value;

    const subjects = {
      fr: `Renseignement – Maison Jacques & Cécile (${apt})`,
      en: `Enquiry – Maison Jacques & Cécile (${apt})`,
      it: `Informazioni – Casa Jacques & Cécile (${apt})`
    };
    const bodies = {
      fr: `Bonjour,\n\nJe m'appelle ${name} (${email}).\n\nAppartement concerné : ${apt}\n\n${message}`,
      en: `Hello,\n\nMy name is ${name} (${email}).\n\nApartment: ${apt}\n\n${message}`,
      it: `Buongiorno,\n\nMi chiamo ${name} (${email}).\n\nAppartamento: ${apt}\n\n${message}`
    };

    const subject = encodeURIComponent(subjects[lang] || subjects.fr);
    const body = encodeURIComponent(bodies[lang] || bodies.fr);
    window.location.href = `mailto:montgenevre.indivision.bouvet@gmail.com?subject=${subject}&body=${body}`;

    const msgs = { fr: 'Message préparé ! Votre client mail va s\'ouvrir.', en: 'Message ready! Your mail client will open.', it: 'Messaggio pronto! Si aprirà il vostro client email.' };
    showToast(msgs[lang] || msgs.fr, 'success');
    contactForm.reset();
  });
}

// ── OVERRIDE SETLANG to handle season content ──
const origSetLang = window.setLang;
window.setLang = function(lang) {
  if (origSetLang) origSetLang(lang);
  // Also update season hero content
  document.querySelectorAll('[data-season-content]').forEach(el => {
    el.style.display = (el.dataset.seasonContent === currentSeason && el.dataset.lang === lang) ? '' : 'none';
  });
};

// Init hero photo on page load
document.addEventListener('DOMContentLoaded', () => setHeroBg('winter'));
