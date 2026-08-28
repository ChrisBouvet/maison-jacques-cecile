// js/vacances-scolaires.js
// ══════════════════════════════════════════════════
//  VACANCES SCOLAIRES (zones A / B / C)
//  Source : API officielle data.education.gouv.fr
// ══════════════════════════════════════════════════

const API_URL = "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records";
const CACHE_KEY = "vacances_scolaires_cache_v4";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

// Filet de sécurité si l'API est injoignable (hors-ligne, quota, etc.)
// À mettre à jour une fois par an si besoin — les dates officielles
// sont publiées plusieurs mois à l'avance par le ministère.
const FALLBACK = [
  { zone: "A", start: "2025-10-18", end: "2025-11-03" },
  { zone: "B", start: "2025-10-18", end: "2025-11-03" },
  { zone: "C", start: "2025-10-18", end: "2025-11-03" },
  { zone: "A", start: "2025-12-20", end: "2026-01-05" },
  { zone: "B", start: "2025-12-20", end: "2026-01-05" },
  { zone: "C", start: "2025-12-20", end: "2026-01-05" },
  { zone: "A", start: "2026-02-07", end: "2026-02-23" },
  { zone: "B", start: "2026-02-14", end: "2026-03-02" },
  { zone: "C", start: "2026-02-21", end: "2026-03-09" },
  { zone: "A", start: "2026-04-04", end: "2026-04-19" },
  { zone: "B", start: "2026-04-25", end: "2026-05-10" },
  { zone: "C", start: "2026-04-11", end: "2026-04-26" },
  { zone: "A", start: "2026-07-04", end: "2026-09-01" },
  { zone: "B", start: "2026-07-04", end: "2026-09-01" },
  { zone: "C", start: "2026-07-04", end: "2026-09-01" },
  // Année scolaire 2026-2027 (arrêté du 22 octobre 2025)
  { zone: "A", start: "2026-10-17", end: "2026-11-02" },
  { zone: "B", start: "2026-10-17", end: "2026-11-02" },
  { zone: "C", start: "2026-10-17", end: "2026-11-02" },
  { zone: "A", start: "2026-12-19", end: "2027-01-04" },
  { zone: "B", start: "2026-12-19", end: "2027-01-04" },
  { zone: "C", start: "2026-12-19", end: "2027-01-04" },
  { zone: "C", start: "2027-02-06", end: "2027-02-22" },
  { zone: "A", start: "2027-02-13", end: "2027-03-01" },
  { zone: "B", start: "2027-02-20", end: "2027-03-08" },
  { zone: "C", start: "2027-04-03", end: "2027-04-19" },
  { zone: "A", start: "2027-04-10", end: "2027-04-26" },
  { zone: "B", start: "2027-04-17", end: "2027-05-03" },
  { zone: "A", start: "2027-07-03", end: "2027-09-02" },
  { zone: "B", start: "2027-07-03", end: "2027-09-02" },
  { zone: "C", start: "2027-07-03", end: "2027-09-02" },
];

let _periods = null;
let _loading = null;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw);
    if (Date.now() - savedAt > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // stockage plein ou indisponible : tant pis, on retentera au prochain chargement
  }
}

// Calcule le libellé "AAAA-AAAA" de l'année scolaire en cours à la date donnée
// (la rentrée a lieu fin août / début septembre : mois >= 7 => nouvelle année scolaire)
function anneeScolaire(d) {
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

async function fetchFromApi() {
  const zones = ["Zone A", "Zone B", "Zone C"];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const anneeActuelle = anneeScolaire(now);
  const anneeSuivante = anneeScolaire(new Date(now.getFullYear() + 1, now.getMonth(), 1));

  const results = [];
  for (const zone of zones) {
    const url = `${API_URL}?limit=99&refine=zones:"${zone}"`
      + `&refine=population:"Élèves"&refine=population:"-"`
      + `&refine=annee_scolaire:"${anneeActuelle}"&refine=annee_scolaire:"${anneeSuivante}"`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("API vacances scolaires indisponible");
    const json = await res.json();
    (json.results || []).forEach(r => {
      if (r.start_date && r.end_date && r.end_date.slice(0, 10) >= today) {
        results.push({
          zone: zone.replace("Zone ", ""),
          start: r.start_date.slice(0, 10),
          end: r.end_date.slice(0, 10),
        });
      }
    });
  }
  if (!results.length) throw new Error("API vacances scolaires : réponse vide");
  return results;
}

// Charge les périodes de vacances (cache localStorage 7 jours, sinon API,
// sinon fallback codé en dur). Doit être appelé avant zonesForDate().
export async function loadVacances() {
  if (_periods) return _periods;
  if (_loading) return _loading;

  const cached = readCache();
  if (cached) {
    _periods = cached;
    return _periods;
  }

  _loading = fetchFromApi()
    .then(data => {
      _periods = data;
      writeCache(data);
      return data;
    })
    .catch(err => {
      console.warn("Vacances scolaires : API indisponible, utilisation du fallback.", err);
      _periods = FALLBACK;
      return _periods;
    })
    .finally(() => {
      _loading = null;
    });

  return _loading;
}

// Retourne les zones (ex. ['A'], ['A','B']) en vacances à une date donnée.
export function zonesForDate(dateStr) {
  if (!_periods) return [];
  const zones = new Set();
  for (const p of _periods) {
    if (p.start <= dateStr && dateStr <= p.end) zones.add(p.zone);
  }
  return [...zones].sort();
}
