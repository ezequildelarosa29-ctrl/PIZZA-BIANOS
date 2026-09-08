/* ═══════════════════════════════════════════════════
   PIZZA BIANOS – Firebase Configuration
   ═══════════════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCa8xaQ9KrjzR5yuWjDo-vrx6AEz35MhEQ",
  authDomain:        "bianos-pizza.firebaseapp.com",
  projectId:         "bianos-pizza",
  storageBucket:     "bianos-pizza.firebasestorage.app",
  messagingSenderId: "434673666029",
  appId:             "1:434673666029:web:6f20a780c9219f3f1b09e4"
  /* measurementId removed — Analytics not needed */
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
