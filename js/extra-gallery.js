// ══════════════════════════════════════════════════
//  GALERIE + LIGHTBOX — légendes via captions.json
// ══════════════════════════════════════════════════

const MAX_EXTRA = 30;

// Charge ../img/<folder>/captions.json, retourne {} si absent.
async function loadCaptions(folder) {
  try {
    const res = await fetch(`../img/${folder}/captions.json`);
    if (!res.ok) return {};
    return await res.json();
  } catch { return {}; }
}

// Retourne la légende dans la langue courante pour une clé donnée.
function caption(captions, key) {
  const lang = localStorage.getItem("lang") || "fr";
  return captions?.[key]?.[lang] || captions?.[key]?.fr || "";
}

// Applique ou met à jour la légende d'un wrapper de photo.
function setCaption(wrapper, captions, key) {
  let p = wrapper.querySelector(".photo-caption");
  const text = caption(captions, key);
  if (!text) { p?.remove(); return; }
  if (!p) {
    p = document.createElement("p");
    p.className = "photo-caption";
    wrapper.appendChild(p);
  }
  p.textContent = text;
}

// Clé d'une photo depuis son src : "../img/rdc/chambre-1.jpg" → "chambre-1"
function keyFromSrc(src) {
  return src.split("/").pop().replace(/\.[^.]+$/, "");
}

// ── LÉGENDES — galerie principale (5 photos nommées) ──
export async function applyMainCaptions(folder) {
  const captions = await loadCaptions(folder);
  if (!Object.keys(captions).length) return;

  function refresh() {
    document.querySelectorAll(".gallery-photo").forEach(wrapper => {
      const img = wrapper.querySelector("img");
      if (!img) return;
      setCaption(wrapper, captions, keyFromSrc(img.src));
    });
  }

  refresh();

  // Relecture à chaque changement de langue
  document.querySelectorAll(".nav__lang a").forEach(a =>
    a.addEventListener("click", () => setTimeout(refresh, 50))
  );
}

// ── GALERIE EXTENSIBLE (extra-1.jpg … extra-N.jpg) ──
export async function initExtraGallery(folder, containerId, sectionId) {
  const container = document.getElementById(containerId);
  const section   = document.getElementById(sectionId);
  if (!container || !folder) return;

  // Charge les captions AVANT de tester les images
  const captions = await loadCaptions(folder);

  // Teste l'existence de chaque extra-N.jpg en parallèle
  const checks = Array.from({ length: MAX_EXTRA }, (_, idx) => {
    const i = idx + 1;
    const src = `../img/${folder}/extra-${i}.jpg`;
    return new Promise(resolve => {
      const img = new Image();
      img.onload  = () => resolve({ i, src, ok: true });
      img.onerror = () => resolve({ i, src, ok: false });
      img.src = src;
    });
  });

  const found = (await Promise.all(checks))
    .filter(r => r.ok)
    .sort((a, b) => a.i - b.i);

  if (found.length === 0) return;

  // Injecte les photos avec la légende dans la langue courante
  function renderExtra() {
    container.innerHTML = found.map(r => {
      const key  = `extra-${r.i}`;
      const text = caption(captions, key);
      return `
        <div class="extra-photo">
          <img src="${r.src}" alt="${text || `Photo ${r.i}`}" loading="lazy">
          ${text ? `<p class="photo-caption">${text}</p>` : ""}
        </div>`;
    }).join("");

    // Lightbox au clic
    container.querySelectorAll("img").forEach(img => {
      img.addEventListener("click", () => {
        const cap = img.nextElementSibling?.textContent || "";
        openLightbox(img.src, cap);
      });
    });
  }

  renderExtra();

  // Rerender à chaque changement de langue
  document.querySelectorAll(".nav__lang a").forEach(a =>
    a.addEventListener("click", () => setTimeout(renderExtra, 50))
  );

  if (section) section.style.display = "";
}

// ── LIGHTBOX ──
export function initLightbox() {
  document.querySelectorAll(".gallery-photo img").forEach(img => {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => {
      const cap = img.closest(".gallery-photo")?.querySelector(".photo-caption")?.textContent || "";
      openLightbox(img.src, cap);
    });
  });
}

function ensureLightbox() {
  let overlay = document.getElementById("photoLightbox");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "photoLightbox";
  overlay.className = "lightbox";
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="Fermer">×</button>
    <figure class="lightbox-figure">
      <img alt="">
      <figcaption class="lightbox-caption"></figcaption>
    </figure>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", e => {
    if (e.target === overlay || e.target.classList.contains("lightbox-close"))
      overlay.classList.remove("open");
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") overlay.classList.remove("open");
  });

  return overlay;
}

function openLightbox(src, caption = "") {
  const overlay = ensureLightbox();
  overlay.querySelector("img").src = src;
  const cap = overlay.querySelector(".lightbox-caption");
  cap.textContent = caption;
  cap.style.display = caption ? "" : "none";
  overlay.classList.add("open");
}
