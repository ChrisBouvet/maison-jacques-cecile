// ══════════════════════════════════════════════════
//  GALERIE EXTENSIBLE + LÉGENDES + LIGHTBOX
// ══════════════════════════════════════════════════

const MAX_EXTRA = 30;

// ── CHARGEMENT DES LÉGENDES ──
// Charge ../img/<folder>/captions.json
// Retourne {} si absent ou invalide.
async function loadCaptions(folder) {
  try {
    const res = await fetch(`../img/${folder}/captions.json`);
    if (!res.ok) return {};
    return await res.json();
  } catch { return {}; }
}

// Retourne la légende dans la langue courante, ou "" si absente.
function getCaption(captions, key) {
  const lang = localStorage.getItem("lang") || "fr";
  return captions?.[key]?.[lang] || "";
}

// ── GALERIE PRINCIPALE — injection des légendes ──
export async function applyMainCaptions(folder) {
  const captions = await loadCaptions(folder);
  if (!Object.keys(captions).length) return;

  document.querySelectorAll(".gallery-photo").forEach(wrapper => {
    const img = wrapper.querySelector("img");
    if (!img) return;

    // Extrait la clé depuis le chemin : ../img/rdc/chambre-1.jpg → chambre-1
    const key = img.src.split("/").pop().replace(/\.[^.]+$/, "");
    const text = getCaption(captions, key);
    if (!text) return;

    // Supprime une éventuelle légende existante
    wrapper.querySelector(".photo-caption")?.remove();
    const cap = document.createElement("p");
    cap.className = "photo-caption";
    cap.textContent = text;
    wrapper.appendChild(cap);
  });

  // Mémorise pour relecture lors d'un changement de langue
  wrapper_lang_update(folder, captions);
}

function wrapper_lang_update(folder, captions) {
  document.querySelectorAll(".nav__lang a").forEach(a => {
    a.addEventListener("click", () => {
      setTimeout(() => {
        document.querySelectorAll(".gallery-photo, .extra-photo").forEach(wrapper => {
          const img = wrapper.querySelector("img");
          if (!img) return;
          const key = img.src.split("/").pop().replace(/\.[^.]+$/, "");
          const cap = wrapper.querySelector(".photo-caption");
          const text = getCaption(captions, key);
          if (cap) cap.textContent = text;
        });
      }, 50);
    });
  });
}

// ── GALERIE EXTENSIBLE ──
export async function initExtraGallery(folder, containerId, sectionId) {
  const container = document.getElementById(containerId);
  const section   = document.getElementById(sectionId);
  if (!container || !folder) return;

  const captions = await loadCaptions(folder);

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

  const found = (await Promise.all(checks)).filter(r => r.ok).sort((a, b) => a.i - b.i);
  if (found.length === 0) return;

  container.innerHTML = found.map(r => {
    const key  = `extra-${r.i}`;
    const text = getCaption(captions, key);
    return `
      <div class="extra-photo">
        <img src="${r.src}" alt="Photo ${r.i}" loading="lazy">
        ${text ? `<p class="photo-caption">${text}</p>` : ""}
      </div>`;
  }).join("");

  container.querySelectorAll("img").forEach(img => {
    img.addEventListener("click", () => openLightbox(img.src, img.closest(".extra-photo")?.querySelector(".photo-caption")?.textContent || ""));
  });

  if (section) section.style.display = "";
}

// ── LIGHTBOX ──
export function initLightbox() {
  document.querySelectorAll(".gallery-photo img").forEach(img => {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => {
      const caption = img.closest(".gallery-photo")?.querySelector(".photo-caption")?.textContent || "";
      openLightbox(img.src, caption);
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
    if (e.target === overlay || e.target.classList.contains("lightbox-close")) {
      overlay.classList.remove("open");
    }
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
