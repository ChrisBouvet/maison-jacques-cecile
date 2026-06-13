import { initCalendars, initResaForms } from "./calendar-firebase.js";
import { initExtraGallery, initLightbox, applyMainCaptions } from "./extra-gallery.js";

document.addEventListener("DOMContentLoaded", () => {
  initCalendars();
  initResaForms();
  initLightbox();

  const section = document.getElementById("extraGallerySection");
  if (section) {
    const folder = section.dataset.folder;
    applyMainCaptions(folder);
    initExtraGallery(folder, "extraGallery", "extraGallerySection");
  }
});
