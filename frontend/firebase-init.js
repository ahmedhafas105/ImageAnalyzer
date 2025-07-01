// Import the functions you need from the SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Your web app's Firebase configuration
// PASTE YOUR FIREBASE CONFIG OBJECT HERE
const firebaseConfig = {
  apiKey: "====",
  authDomain: "====",
  projectId: "===",
  storageBucket: "===",
  messagingSenderId: "===",
  appId: "==="
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the services to be used in other files
export const auth = getAuth(app);
export const db = getFirestore(app);
