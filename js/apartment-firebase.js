// Script commun aux pages d'appartement (RDC et 2ème)
// Charge le calendrier Firebase, le formulaire de demande,
// la galerie "Plus de photos" et la lightbox.

import { initCalendars, initResaForms } from "./calendar-firebase.js";
import { initExtraGallery, initLightbox } from "./extra-gallery.js";

document.addEventListener("DOMContentLoaded", () => {
  initCalendars();
  initResaForms();
  initLightbox();

  const section = document.getElementById("extraGallerySection");
  if (section) {
    initExtraGallery(section.dataset.folder, "extraGallery", "extraGallerySection");
  }
});
