import { initCalendars, initResaForms } from "./calendar-firebase.js";
import { applyMainCaptions, initExtraGallery, initLightbox } from "./extra-gallery.js";

document.addEventListener("DOMContentLoaded", () => {
  initCalendars();
  initResaForms();
  initLightbox();  // attache le zoom sur les 5 photos nommées

  const section = document.getElementById("extraGallerySection");
  if (section) {
    const folder = section.dataset.folder;
    applyMainCaptions(folder);          // légendes des 5 photos nommées
    initExtraGallery(folder, "extraGallery", "extraGallerySection");
  } else {
    // Page sans galerie extra : applique quand même les captions si folder disponible
    const folderMeta = document.querySelector("[data-folder]");
    if (folderMeta) applyMainCaptions(folderMeta.dataset.folder);
  }
});
