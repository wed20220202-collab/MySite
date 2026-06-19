import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  onDisconnect,
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
const PRESENCE_PATH = "festival/presence";
const LOGIN_STATES_PATH = "festival/loginStates";

function getClientId() {
  const key = "festival_client_id";
  let id = localStorage.getItem(key);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }

  return id;
}

function getNow() {
  return Date.now();
}

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

export async function setPagePresence(pageName, studentId = "") {
  const clientId = getClientId();
  const pageRef = ref(db, `${PRESENCE_PATH}/${pageName}/${clientId}`);
  const payload = {
    clientId,
    pageName,
    studentId: studentId || "guest",
    enteredAt: getNow(),
    updatedAt: getNow(),
    status: "in"
  };

  await set(pageRef, payload);
  onDisconnect(pageRef).set({
    ...payload,
    status: "out",
    leftAt: getNow(),
    updatedAt: getNow()
  });

  const leave = async () => {
    try {
      await set(pageRef, {
        ...payload,
        status: "out",
        leftAt: getNow(),
        updatedAt: getNow()
      });
    } catch (error) {
      console.warn("presence leave failed", error);
    }
  };

  window.addEventListener("pagehide", leave, { once: true });
  return payload;
}

export async function setUserLoginState(studentId, isLoggedIn, extra = {}) {
  if (!studentId) return;

  const loginRef = ref(db, `${LOGIN_STATES_PATH}/${studentId}`);
  const payload = {
    studentId,
    status: isLoggedIn ? "login" : "logout",
    isLoggedIn,
    updatedAt: getNow(),
    ...extra
  };

  await set(loginRef, payload);

  if (isLoggedIn) {
    onDisconnect(loginRef).set({
      ...payload,
      status: "logout",
      isLoggedIn: false,
      updatedAt: getNow()
    });
  }
}

export function watchPagePresence(callback) {
  onValue(ref(db, PRESENCE_PATH), snapshot => {
    callback(snapshot.exists() ? snapshot.val() : {});
  });
}

export function watchLoginStates(callback) {
  onValue(ref(db, LOGIN_STATES_PATH), snapshot => {
    callback(snapshot.exists() ? snapshot.val() : {});
  });
}
