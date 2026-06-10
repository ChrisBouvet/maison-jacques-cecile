// Script commun aux pages d'appartement (RDC et 2ème)
// Charge le calendrier Firebase + gère le formulaire de demande

import { initCalendars, initResaForms } from "./calendar-firebase.js";

document.addEventListener("DOMContentLoaded", () => {
  initCalendars();
  initResaForms();
});
