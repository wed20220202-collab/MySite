import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC7oudfhfJC7zssUb0KR98tFy_lxvVT0bI",
  authDomain: "sanfestival-7a016.firebaseapp.com",
  databaseURL: "https://sanfestival-7a016-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sanfestival-7a016",
  storageBucket: "sanfestival-7a016.firebasestorage.app",
  messagingSenderId: "819550776861",
  appId: "1:819550776861:web:f38613132aef5bc3c7e0f4",
  measurementId: "G-516PDY0SYD"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const ACTIVE_PATH = "festival/activeSession";
const SEQUENCES_PATH = "festival/sequences";

export async function modeLabel() {
  return "FIREBASE MODE / Realtime Database";
}

export async function getSequences() {
  const snapshot = await get(ref(db, SEQUENCES_PATH));

  if (!snapshot.exists()) {
    return [];
  }

  const data = snapshot.val();

  return Object.entries(data).map(([id, value]) => ({
    id,
    ...value
  }));
}

export async function saveSequence(sequence) {
  const id = sequence.id || crypto.randomUUID();

  const newSequence = {
    ...sequence,
    id,
    createdAt: Date.now()
  };

  await set(ref(db, `${SEQUENCES_PATH}/${id}`), newSequence);

  return newSequence;
}

export async function clearSequences() {
  await remove(ref(db, SEQUENCES_PATH));
}

export async function setActiveSession(session) {
  const data = {
    ...session,
    updatedAt: Date.now()
  };

  await set(ref(db, ACTIVE_PATH), data);

  return data;
}

export function watchActiveSession(callback) {
  onValue(ref(db, ACTIVE_PATH), snapshot => {
    if (!snapshot.exists()) return;

    const data = snapshot.val();

    if (!data || !data.color) return;

    callback(data);
  });
}