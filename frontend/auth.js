import { auth, db } from './firebase-init.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const errorMessageDiv = document.getElementById('error-message');

// --- Helper function to show errors ---
const showAuthError = (message) => {
    errorMessageDiv.textContent = message;
    errorMessageDiv.classList.remove('d-none');
};

// --- Sign Up Logic ---
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;

        if (password !== confirmPassword) {
            showAuthError("Passwords do not match.");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save user info (like name) to Firestore
            await setDoc(doc(db, "users", user.uid), {
                name: name,
                email: email
            });

            // Redirect to the main app page
            window.location.href = 'index.html';

        } catch (error) {
            showAuthError(error.message);
        }
    });
}

// --- Login Logic ---
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Redirect to the main app page on successful login
            window.location.href = 'index.html';

        } catch (error) {
            showAuthError(error.message);
        }
    });
}