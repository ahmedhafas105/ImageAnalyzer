// Import the functions you need from the SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Your web app's Firebase configuration
// PASTE YOUR FIREBASE CONFIG OBJECT HERE
const firebaseConfig = {
  apiKey: "AIzaSyBWvFsWbWc_g9ThMMs0jIaN4OBBh1tBJQg",
  authDomain: "image-moderator-auth.firebaseapp.com",
  projectId: "image-moderator-auth",
  storageBucket: "image-moderator-auth.firebasestorage.app",
  messagingSenderId: "1027136931852",
  appId: "1:1027136931852:web:0b43f5233e593e40034629"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the services to be used in other files
export const auth = getAuth(app);
export const db = getFirestore(app);