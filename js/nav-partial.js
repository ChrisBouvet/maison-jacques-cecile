// nav-partial.js — injects shared nav and footer into apartment/family pages
// Call initPage() after DOM loaded

function initNav(activePage) {
  const root = '../';
  const nav = document.querySelector('.nav');
  if (!nav) return;
  nav.innerHTML = `
    <a class="nav__logo" href="${root}index.html">Jacques <span>&</span> Cécile</a>
    <ul class="nav__links">
      <li><a href="${root}index.html#maison" data-lang="fr">La Maison</a><a href="${root}index.html#maison" data-lang="en" style="display:none">The House</a><a href="${root}index.html#maison" data-lang="it" style="display:none">La Casa</a></li>
      <li><a href="${root}index.html#station" data-lang="fr">La Station</a><a href="${root}index.html#station" data-lang="en" style="display:none">The Resort</a><a href="${root}index.html#station" data-lang="it" style="display:none">La stazione</a></li>
      <li><a href="${root}pages/rdc.html" data-lang="fr">Appt. RDC</a><a href="${root}pages/rdc.html" data-lang="en" style="display:none">Ground Apt.</a><a href="${root}pages/rdc.html" data-lang="it" style="display:none">App. PT</a></li>
      <li><a href="${root}pages/2eme.html" data-lang="fr">Appt. 2ème</a><a href="${root}pages/2eme.html" data-lang="en" style="display:none">2nd Floor Apt.</a><a href="${root}pages/2eme.html" data-lang="it" style="display:none">App. 2° Piano</a></li>
      <li><a href="${root}pages/famille.html" data-lang="fr">Famille</a><a href="${root}pages/famille.html" data-lang="en" style="display:none">Family</a><a href="${root}pages/famille.html" data-lang="it" style="display:none">Famiglia</a></li>
    </ul>
    <ul class="nav__lang">
      <li><a href="#" data-langbtn="fr">FR</a></li>
      <li><a href="#" data-langbtn="en">EN</a></li>
      <li><a href="#" data-langbtn="it">IT</a></li>
    </ul>
    <button class="nav__burger" aria-label="Menu"><span></span><span></span><span></span></button>
  `;
}

function initFooter() {
  const root = '../';
  const footer = document.querySelector('.footer');
  if (!footer) return;
  footer.innerHTML = `
    <div class="container">
      <div class="footer__grid">
        <div>
          <div class="footer__logo">Jacques <span>&</span> Cécile</div>
          <p data-lang="fr">336 rue de l'Église · 05100 Montgenèvre<br>Indivision Bouvet</p>
          <p data-lang="en" style="display:none">336 rue de l'Église · 05100 Montgenèvre<br>Indivision Bouvet</p>
          <p data-lang="it" style="display:none">336 rue de l'Église · 05100 Montgenèvre<br>Indivision Bouvet</p>
          <p style="margin-top:0.5rem;"><a href="mailto:montgenevre.indivision.bouvet@gmail.com" style="color:var(--or);">montgenevre.indivision.bouvet@gmail.com</a></p>
          <p><a href="tel:+33687534936" style="color:var(--or);">06 87 53 49 36</a></p>
        </div>
        <div>
          <h5 data-lang="fr">Appartements</h5>
          <h5 data-lang="en" style="display:none">Apartments</h5>
          <h5 data-lang="it" style="display:none">Appartamenti</h5>
          <ul class="footer__links">
            <li><a href="${root}pages/rdc.html" data-lang="fr">Appartement RDC</a><a href="${root}pages/rdc.html" data-lang="en" style="display:none">Ground Floor Apt.</a><a href="${root}pages/rdc.html" data-lang="it" style="display:none">App. Piano Terra</a></li>
            <li><a href="${root}pages/2eme.html" data-lang="fr">Appartement 2e étage</a><a href="${root}pages/2eme.html" data-lang="en" style="display:none">2nd Floor Apt.</a><a href="${root}pages/2eme.html" data-lang="it" style="display:none">App. 2° Piano</a></li>
            <li><a href="${root}pages/famille.html" data-lang="fr">Espace famille</a><a href="${root}pages/famille.html" data-lang="en" style="display:none">Family area</a><a href="${root}pages/famille.html" data-lang="it" style="display:none">Area famiglia</a></li>
          </ul>
        </div>
        <div>
          <h5 data-lang="fr">Contact</h5><h5 data-lang="en" style="display:none">Contact</h5><h5 data-lang="it" style="display:none">Contatto</h5>
          <ul class="footer__links">
            <li><a href="mailto:montgenevre.indivision.bouvet@gmail.com">montgenevre.indivision.bouvet@gmail.com</a></li>
            <li><a href="tel:+33687534936">06 87 53 49 36</a></li>
            <li><a href="${root}index.html#contact" data-lang="fr">Nous contacter</a><a href="${root}index.html#contact" data-lang="en" style="display:none">Contact us</a><a href="${root}index.html#contact" data-lang="it" style="display:none">Contattaci</a></li>
          </ul>
        </div>
      </div>
      <div class="footer__bottom">
        <span>© 2024 Indivision Bouvet · Montgenèvre</span>
        <span style="color:rgba(253,250,245,0.35);font-size:0.8rem;">Maison Jacques & Cécile</span>
      </div>
    </div>`;
}
