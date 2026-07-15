// ══════════════════════════════════════════════════
//  FIREBASE — configuration Maison Bouvet
// ══════════════════════════════════════════════════
import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore,
         collection, addDoc, getDocs,
         doc, getDoc, updateDoc, deleteDoc, setDoc,
         query, orderBy, where,
         onSnapshot }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA9CAebB6SzWUY5jJkpMWRxY3X0GlGtQeU",
  authDomain:        "maison-bouvet.firebaseapp.com",
  projectId:         "maison-bouvet",
  storageBucket:     "maison-bouvet.firebasestorage.app",
  messagingSenderId: "176249623190",
  appId:             "1:176249623190:web:b9ac4a813857c449ea68b7"
};

const app = initializeApp(FIREBASE_CONFIG);
const db  = getFirestore(app);
const COL = "reservations";

// ── ÉCOUTE TEMPS RÉEL ──
export function subscribeReservations(callback) {
  const q = query(collection(db, COL), orderBy("start"));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => console.error("Firestore snapshot error:", err));
}

// ── LECTURE UNIQUE (pages publiques) ──
// Note: on trie côté client pour éviter l'index composite apt+start
export async function getReservations(apt = null) {
  try {
    const q = apt
      ? query(collection(db, COL), where("apt", "==", apt))
      : query(collection(db, COL), orderBy("start"));
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Tri côté client par date de début
    return docs.sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  } catch (e) {
    console.error("Firestore read error:", e);
    return [];
  }
}

// ── AJOUT ──
export async function addReservation(data) {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: new Date().toISOString(),
    statut: data.statut || "en_attente"
  });
  return ref.id;
}

// ── MISE À JOUR ──
export async function updateReservation(id, data) {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: new Date().toISOString()
  });
}

// ── SUPPRESSION ──
export async function deleteReservation(id) {
  await deleteDoc(doc(db, COL, id));
}

// ══════════════════════════════════════════════════
//  PÉRIODES FERMÉES (non ouvertes à la réservation)
// ══════════════════════════════════════════════════
const COL_FERME = "periodes_fermees";

export function subscribePeriodesFermees(callback) {
  const q = query(collection(db, COL_FERME), orderBy("start"));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => console.error("periodes_fermees snapshot error:", err));
}

export async function getPeriodesFermees(apt = null) {
  try {
    const q = apt
      ? query(collection(db, COL_FERME), where("apt", "==", apt))
      : query(collection(db, COL_FERME), orderBy("start"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  } catch (e) {
    console.error("periodes_fermees read error:", e);
    return [];
  }
}

export async function addPeriodeFermee(data) {
  const ref = await addDoc(collection(db, COL_FERME), {
    ...data,
    createdAt: new Date().toISOString()
  });
  return ref.id;
}

export async function deletePeriodeFermee(id) {
  await deleteDoc(doc(db, COL_FERME, id));
}

// ══════════════════════════════════════════════════
//  AUTH CONFIG — mot de passe famille (hash SHA-256)
//  Stocké dans Firestore : config/auth { familleHash }
// ══════════════════════════════════════════════════

// Hash SHA-256 d'un mot de passe (natif navigateur)
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// Récupère le hash stocké dans Firestore
export async function getFamilleHash() {
  try {
    const snap = await getDoc(doc(db, "config", "auth"));
    return snap.exists() ? snap.data().familleHash : null;
  } catch (e) {
    console.error("getFamilleHash error:", e);
    return null;
  }
}

// Enregistre un nouveau hash dans Firestore (appelé depuis admin)
export async function setFamilleHash(hash) {
  await setDoc(doc(db, "config", "auth"), { familleHash: hash }, { merge: true });
}
