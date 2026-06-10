// ══════════════════════════════════════════════════
//  FIREBASE — configuration Maison Bouvet
// ══════════════════════════════════════════════════
import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore,
         collection, addDoc, getDocs,
         doc, updateDoc, deleteDoc,
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
