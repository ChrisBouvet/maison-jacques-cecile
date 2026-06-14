// ══════════════════════════════════════════════════
//  GALERIE EXTENSIBLE + LIGHTBOX + NAVIGATION
// ══════════════════════════════════════════════════

const MAX_EXTRA = 30;

async function loadCaptions(folder) {
  try {
    const res = await fetch(`../img/${folder}/captions.json`);
    if (!res.ok) return {};
    return await res.json();
  } catch { return {}; }
}

function caption(captions, key) {
  const lang = localStorage.getItem("lang") || "fr";
  return captions?.[key]?.[lang] || captions?.[key]?.fr || "";
}

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

function keyFromSrc(src) {
  return src.split("/").pop().replace(/\.[^.]+$/, "");
}

// ── LÉGENDES galerie principale ──
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
  document.addEventListener("click", e => {
    if (e.target.closest(".nav__lang a[data-langbtn]"))
      setTimeout(refresh, 80);
  });
}

// ── GALERIE EXTENSIBLE ──
export async function initExtraGallery(folder, containerId, sectionId) {
  const container = document.getElementById(containerId);
  const section   = document.getElementById(sectionId);
  if (!container || !folder) return;

  const captions = await loadCaptions(folder);

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

  function renderExtra() {
    container.innerHTML = found.map((r, idx) => {
      const key  = `extra-${r.i}`;
      const text = caption(captions, key);
      return `
        <div class="extra-photo" data-idx="${idx}">
          <img src="${r.src}" alt="${text || `Photo ${r.i}`}" loading="lazy">
          ${text ? `<p class="photo-caption">${text}</p>` : ""}
        </div>`;
    }).join("");

    container.querySelectorAll(".extra-photo").forEach(ph => {
      ph.addEventListener("click", () => {
        const idx = parseInt(ph.dataset.idx, 10);
        openLightbox(found, captions, idx);
      });
    });
  }

  renderExtra();
  document.addEventListener("click", e => {
    if (e.target.closest(".nav__lang a[data-langbtn]"))
      setTimeout(renderExtra, 80);
  });

  if (section) section.style.display = "";
}

// ── LIGHTBOX avec navigation ──
let _lightboxItems  = [];  // tableau {src, cap}
let _lightboxIndex  = 0;

export function initLightbox() {
  document.querySelectorAll(".gallery-photo img").forEach((img, idx, all) => {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => {
      const items = Array.from(all).map(i => ({
        src: i.src,
        cap: i.closest(".gallery-photo")?.querySelector(".photo-caption")?.textContent || ""
      }));
      openLightbox(items, null, idx);
    });
  });
}

function openLightbox(itemsOrFound, captions, startIdx) {
  // Normalise en tableau {src, cap}
  let items;
  if (captions !== null) {
    // appelé depuis la galerie extra : itemsOrFound = found[]
    items = itemsOrFound.map(r => ({
      src: r.src,
      cap: caption(captions, `extra-${r.i}`)
    }));
  } else {
    // appelé depuis initLightbox : itemsOrFound déjà normalisé
    items = itemsOrFound;
  }

  _lightboxItems = items;
  _lightboxIndex = startIdx;
  showLightboxSlide();
  ensureLightbox().classList.add("open");
}

function showLightboxSlide() {
  const overlay = ensureLightbox();
  const item = _lightboxItems[_lightboxIndex];
  if (!item) return;

  overlay.querySelector("img").src = item.src;
  const cap = overlay.querySelector(".lightbox-caption");
  cap.textContent = item.cap || "";
  cap.style.display = item.cap ? "" : "none";

  // Affiche/masque les flèches selon le nombre d'images
  const showNav = _lightboxItems.length > 1;
  overlay.querySelector(".lightbox-prev").style.display = showNav ? "" : "none";
  overlay.querySelector(".lightbox-next").style.display = showNav ? "" : "none";

  // Counter
  const counter = overlay.querySelector(".lightbox-counter");
  counter.textContent = showNav ? `${_lightboxIndex + 1} / ${_lightboxItems.length}` : "";
}

function ensureLightbox() {
  let overlay = document.getElementById("photoLightbox");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "photoLightbox";
  overlay.className = "lightbox";
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="Fermer">×</button>
    <button class="lightbox-prev" aria-label="Précédent">&#8249;</button>
    <figure class="lightbox-figure">
      <img alt="">
      <figcaption class="lightbox-caption"></figcaption>
    </figure>
    <button class="lightbox-next" aria-label="Suivant">&#8250;</button>
    <span class="lightbox-counter"></span>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector(".lightbox-close").addEventListener("click", () =>
    overlay.classList.remove("open"));

  overlay.querySelector(".lightbox-prev").addEventListener("click", e => {
    e.stopPropagation();
    _lightboxIndex = (_lightboxIndex - 1 + _lightboxItems.length) % _lightboxItems.length;
    showLightboxSlide();
  });

  overlay.querySelector(".lightbox-next").addEventListener("click", e => {
    e.stopPropagation();
    _lightboxIndex = (_lightboxIndex + 1) % _lightboxItems.length;
    showLightboxSlide();
  });

  // Clic sur le fond
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.remove("open");
  });

  // Clavier
  document.addEventListener("keydown", e => {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape")     overlay.classList.remove("open");
    if (e.key === "ArrowLeft")  { _lightboxIndex = (_lightboxIndex - 1 + _lightboxItems.length) % _lightboxItems.length; showLightboxSlide(); }
    if (e.key === "ArrowRight") { _lightboxIndex = (_lightboxIndex + 1) % _lightboxItems.length; showLightboxSlide(); }
  });

  return overlay;
}
