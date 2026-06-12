// ══════════════════════════════════════════════════
//  GALERIE EXTENSIBLE + LIGHTBOX
//  Cherche automatiquement img/<folder>/extra-1.jpg,
//  extra-2.jpg, etc. (jusqu'à MAX_EXTRA) et affiche
//  uniquement les fichiers présents.
// ══════════════════════════════════════════════════

const MAX_EXTRA = 30;

export function initExtraGallery(folder, containerId, sectionId) {
  const container = document.getElementById(containerId);
  const section   = document.getElementById(sectionId);
  if (!container || !folder) return;

  const checks = [];
  for (let i = 1; i <= MAX_EXTRA; i++) {
    const src = `../img/${folder}/extra-${i}.jpg`;
    checks.push(new Promise(resolve => {
      const img = new Image();
      img.onload  = () => resolve({ i, src, ok: true });
      img.onerror = () => resolve({ i, src, ok: false });
      img.src = src;
    }));
  }

  Promise.all(checks).then(results => {
    const found = results.filter(r => r.ok).sort((a, b) => a.i - b.i);
    if (found.length === 0) return; // section reste masquée

    container.innerHTML = found.map(r => `
      <div class="extra-photo">
        <img src="${r.src}" alt="Photo ${r.i}" loading="lazy">
      </div>
    `).join("");

    container.querySelectorAll("img").forEach(img => {
      img.addEventListener("click", () => openLightbox(img.src));
    });

    if (section) section.style.display = "";
  });
}

// ── LIGHTBOX (plein écran) ──
export function initLightbox() {
  // Clic sur les photos de la galerie principale
  document.querySelectorAll(".gallery-photo img").forEach(img => {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => openLightbox(img.src));
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
    <img alt="">
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", e => {
    if (e.target === overlay || e.target.classList.contains("lightbox-close")) {
      overlay.classList.remove("open");
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") overlay.classList.remove("open");
  });

  return overlay;
}

function openLightbox(src) {
  const overlay = ensureLightbox();
  overlay.querySelector("img").src = src;
  overlay.classList.add("open");
}
