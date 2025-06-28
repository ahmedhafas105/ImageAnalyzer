// Import Firebase functions.
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut, getIdToken } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- DEBUG LOG #1: Check if the script file itself is loading ---
console.log("app.js script started.");

const FUNCTION_APP_URL = "http://localhost:7071/api";

// DOM references
const imageInput = document.getElementById('imageUploadInput');
const uploadTriggerButton = document.getElementById('upload-trigger-btn');
const galleryGrid = document.getElementById('galleryGrid');
const galleryLoadingText = document.getElementById('galleryLoadingText');
const authLoading = document.getElementById('auth-loading');
const appContent = document.getElementById('app-content');
// NEW: Reference to the toast container
const toastContainer = document.querySelector('.toast-container');
let imageModal, modalImage, confirmDeleteModal, deleteModalBody, confirmDeleteButton;
// NEW: Global variables to manage the polling state
let pollingInterval;
let imageCountBeforeUpload = 0;

// =================================================================
// MAIN APP ENTRY POINT
// =================================================================

// --- DEBUG LOG #2: Check if we are setting up the listener ---
console.log("Setting up onAuthStateChanged listener...");

onAuthStateChanged(auth, (user) => {
    // --- DEBUG LOG #3: This is the MOST IMPORTANT log. Does it fire? ---
    console.log("onAuthStateChanged has fired. User object:", user);

    if (user) {
        // --- DEBUG LOG #4: Did we correctly identify the user? ---
        console.log(`User is authenticated. UID: ${user.uid}. Showing app content...`);
        
        // The user is authenticated.
        authLoading.classList.add('d-none');
        appContent.classList.remove('d-none'); // Show the main app content
        initializeApp(user);
    } else {
        // --- DEBUG LOG #5: Did the listener fire but with NO user? ---
        console.log("No authenticated user found. Redirecting to signin.html...");
        // No user, hide spinner and redirect.
        authLoading.classList.add('d-none');
        window.location.replace('signin.html');
    }
});

/**
 * Initializes all app components. This is ONLY called if a user is confirmed.
 * @param {object} user - The authenticated user object from Firebase.
 */
function initializeApp(user) {
    // --- DEBUG LOG #6: Are we starting to initialize the components? ---
    console.log("initializeApp() called. Initializing modals and event listeners.");

    imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
    modalImage = document.getElementById('modalImage');
    confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
    deleteModalBody = document.getElementById('deleteModalBody');
    confirmDeleteButton = document.getElementById('confirmDeleteButton');

    uploadTriggerButton.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', handleUpload);
    confirmDeleteButton.addEventListener('click', executeDelete);
    
    addProfileDropdown(user);
    
    // For now, let's keep loadImages commented out to isolate the UI initialization.
    // loadImages();
    // --- DEBUG LOG #7: Did initialization complete?
    console.log("initializeApp() completed successfully. UI should be visible.");
    // Temporarily call loadImages() after a delay to ensure the UI has rendered
    setTimeout(() => {
        console.log("Attempting to load images now...");
        loadImages();
    }, 100);
}


// ALL OTHER FUNCTIONS BELOW THIS LINE DO NOT NEED TO BE CHANGED.
// You can copy the rest of your app.js functions (addProfileDropdown, getAuthHeader, handleUpload, etc.)
// right here. For brevity, I am omitting them as they are not part of this specific bug hunt.
// Just make sure they are present in your file.

async function addProfileDropdown(user) {
    const header = document.querySelector('.app-header');
    if (!header || document.getElementById('profile-dropdown')) return;
    
    let userName = user.email;
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) userName = userDoc.data().name;
    } catch (e) { console.error("Could not fetch user's name:", e); }
    
    const profileHTML = `
        <div class="dropdown" id="profile-dropdown">
            <button class="btn btn-dark rounded-circle d-flex align-items-center justify-content-center" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="width: 40px; height: 40px; background-color: #183055;">
                <i class="bi bi-person-fill fs-5"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end profile-dropdown-menu">
                <li><h6 class="dropdown-header">PROFILE</h6></li>
                <li>
                    <span class="dropdown-item-text profile-item profile-name">${userName}</span>
                </li>
                <li>
                    <span class="dropdown-item-text profile-item profile-email">${user.email}</span>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                    <button class="dropdown-item profile-item profile-logout" id="logout-btn">LOG OUT</button>
                </li>
            </ul>
        </div>
    `;

    header.style.position = 'relative';
    header.insertAdjacentHTML('beforeend', profileHTML);
    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
}


// =================================================================
// DYNAMIC REFRESH (POLLING) LOGIC
// =================================================================

/**
 * Starts polling the backend for new images every 5 seconds.
 * It will stop once the number of images increases.
 * @param {number} countBefore - The number of images before the upload.
 * @param {number} expectedCount - The expected number of images after upload.
 */
function startPollingForNewImages(countBefore, expectedCount) {
    // Clear any existing timer to be safe
    if (pollingInterval) clearInterval(pollingInterval);

    let attempts = 0;
    const maxAttempts = 12; // Poll for a maximum of 60 seconds (12 * 5s)

    pollingInterval = setInterval(async () => {
        attempts++;
        // Stop if it takes too long
        if (attempts > maxAttempts) {
            clearInterval(pollingInterval);
            showToast("Analysis is taking longer than usual. The gallery will update when ready.", "danger");
            setUploadButtonState(false);
            return;
        }

        const currentImages = await getImagesFromServer();
        if (currentImages && currentImages.length >= expectedCount) {
            // Success! We found the new images.
            clearInterval(pollingInterval);
            renderGallery(currentImages); // Render the final state
            setUploadButtonState(false);
            showToast("Analysis complete and gallery updated!", "primary");
        }
    }, 5000); // Poll every 5 seconds
}


async function handleUpload() {
    const files = imageInput.files;
    if (files.length === 0) return;
    setUploadButtonState(true);

    // --- FIX: DEFINE THE VARIABLE NEEDED FOR POLLING ---
    // We get the current image count from the global variable (set in renderGallery)
    // and calculate the expected count after the new uploads finish.
    const expectedImageCount = imageCountBeforeUpload + files.length;

    try {
        await Promise.all(Array.from(files).map(file => uploadSingleFile(file)));
        showToast(`Upload successful! Analyzing ${files.length} image(s)...`, "success");

        // Now this function call has the correct, defined variables.
        startPollingForNewImages(imageCountBeforeUpload, expectedImageCount);

    } catch (error) {
        showToast(`Error: ${error.message}`, 'danger');
        // Re-enable the button immediately if there was an error during upload.
        setUploadButtonState(false);
    } finally {
        // --- FIX: REMOVED setUploadButtonState(false) ---
        // The button state will now be correctly managed by the startPollingForNewImages function,
        // re-enabling only when the process is truly complete or has timed out.
        imageInput.value = '';
    }
}

async function uploadSingleFile(file) {
    const headers = await getAuthHeader();
    const getUrlResponse = await fetch(`${FUNCTION_APP_URL}/getUploadUrl?blobName=${encodeURIComponent(file.name)}`, { headers });
    if (!getUrlResponse.ok) throw new Error(`Server could not prepare upload for ${file.name}.`);
    const { uploadUrl } = await getUrlResponse.json();
    const uploadResponse = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'x-ms-blob-type': 'BlockBlob' } });
    if (!uploadResponse.ok) throw new Error(`Upload failed for ${file.name}.`);
}

function handleDelete(event) {
    event.stopPropagation();
    const blobName = event.currentTarget.dataset.blobName;
    deleteModalBody.textContent = `Are you sure you want to permanently delete "${blobName}"?`;
    confirmDeleteButton.dataset.blobName = blobName;
    confirmDeleteModal.show();
}

async function executeDelete() {
    const blobName = confirmDeleteButton.dataset.blobName;
    setConfirmDeleteButtonState(true);
    try {
        const headers = await getAuthHeader();
        await fetch(`${FUNCTION_APP_URL}/deleteImage`, {
            method: 'DELETE',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ blobName })
        });
        // MODIFIED: Use toast notification on success
        showToast(`Successfully deleted ${blobName}.`, 'warning');
        await loadImages();
    } catch (error) {
        // MODIFIED: Use toast notification for errors
        showToast(`Deletion failed: ${error.message}`, 'danger');
        console.log(`Deletion failed: ${error.message}`);
    } finally {
        confirmDeleteModal.hide();
        setConfirmDeleteButtonState(false);
    }
}

async function loadImages() {
    galleryLoadingText.style.display = 'block';
    galleryGrid.innerHTML = '';
    try {
        const images = await getImagesFromServer();
        if (images) {
            renderGallery(images);
        }
    } catch (error) {
        console.error('Error loading gallery:', error);
        galleryGrid.innerHTML = `<p class="text-danger text-center col-12">Could not load gallery. Please try again.</p>`;
    }
}

/**
 * NEW: Fetches the image list from the backend. Separated for reuse by polling function.
 */
async function getImagesFromServer() {
    try {
        const headers = await getAuthHeader();
        const response = await fetch(`${FUNCTION_APP_URL}/getImages`, { headers });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) window.location.replace('signin.html');
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error("Failed to get images from server:", error);
        return null;
    }
}

/**
 * NEW: Renders the images into the DOM. Separated for reuse.
* @param {Array} images - The array of image objects to render.
 */
function renderGallery(images) {
    galleryLoadingText.style.display = 'none';
    galleryGrid.innerHTML = '';
    
    if (images.length === 0) {
        galleryGrid.innerHTML = '<p class="text-muted text-center col-12">Your cloud is empty. Upload some images to get started!</p>';
        return;
    }

    // This is a global variable that the upload polling will use.
    imageCountBeforeUpload = images.length;

    images.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    images.forEach(image => {
        const col = document.createElement('div');
        col.className = 'col-xl-3 col-lg-4 col-md-6 col-sm-12 mb-4';
        const card = document.createElement('div');
        card.className = 'gallery-card';
        const img = document.createElement('img');
        img.src = image.displayUrl;
        img.alt = image.rowKey;
        img.addEventListener('click', () => {
            modalImage.src = img.src;
            imageModal.show();
        });

        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container';
        
        const createTag = (text, type) => {
            const tag = document.createElement('span');
            tag.className = `tag tag-${type}`;
            tag.textContent = text;
            tagsContainer.appendChild(tag);
        };

        if (image.isAdult) createTag('ADULT', 'adult');
        if (image.isViolent) createTag('VIOLENCE', 'violent');
        if (image.isGore) createTag('GORE', 'gore');
        if (image.isOffensive) createTag('OFFENSIVE', 'offensive');
        if (image.isWeapon) createTag('WEAPON', 'weapon');
        if (image.isDrugs) createTag('DRUGS', 'drugs');
        if (image.isSelfHarm) createTag('SELF-HARM', 'selfharm');

        const isFlagged = image.isAdult || image.isViolent || image.isOffensive || image.isWeapon || image.isDrugs || image.isSelfHarm || image.isGore;
        if (isFlagged) {
            img.classList.add('flagged-image');
        }
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '<i class="bi bi-trash3-fill"></i>';
        deleteButton.dataset.blobName = image.rowKey;
        deleteButton.addEventListener('click', handleDelete);

        // --- FIX: APPEND THE TAGS AND DELETE BUTTON ---
        // The tags container must be appended to the card to be visible.
        card.appendChild(tagsContainer); 
        card.appendChild(deleteButton);
        card.appendChild(img);
        col.appendChild(card);
        galleryGrid.appendChild(col);
    });
}

// --- UI HELPER FUNCTIONS ---

async function getAuthHeader() {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated.");
    const token = await getIdToken(user);
    return { 'Authorization': `Bearer ${token}` };
}

// =================================================================
// NEW TOAST NOTIFICATION FUNCTION
// =================================================================

/**
 * Creates and displays a floating toast notification.
 * @param {string} message The message to display.
 * @param {string} type 'success' or 'danger' for styling.
 */
function showToast(message, type = 'success') {
    const toastTemplate = document.getElementById('toastTemplate');
    const newToast = toastTemplate.cloneNode(true); // Create a copy
    newToast.id = ''; // Remove the ID from the clone
    
    const toastBody = newToast.querySelector('.toast-body');
    const toastIcon = newToast.querySelector('.toast-header i');

    toastBody.textContent = message;

    // Style the toast based on the type
    if (type === 'success') {
        newToast.classList.add('text-bg-success'); // Bootstrap 5 class for green toast
        toastIcon.className = 'bi bi-check-circle-fill me-2';
    } else if (type === 'warning') { // 'warning'
        newToast.classList.add('text-bg-warning'); // Bootstrap 5 class for red toast
        toastIcon.className = 'bi bi-exclamation-triangle-fill me-2';
    } else if (type === 'primary') { // 'info'
        newToast.classList.add('text-bg-primary'); // Bootstrap 5 class for red toast
        toastIcon.className = 'bi bi-check-circle-fill me-2';
    } else {
        newToast.classList.add('text-bg-danger'); // Default to red toast
        toastIcon.className = 'bi bi-x-circle-fill me-2';
    }

    toastContainer.appendChild(newToast);

    const toast = new bootstrap.Toast(newToast, { delay: 4000 }); // Autohide after 4 seconds
    toast.show();

    // Clean up the DOM after the toast is hidden
    newToast.addEventListener('hidden.bs.toast', () => {
        newToast.remove();
    });
}

function setUploadButtonState(isUploading) {
    uploadTriggerButton.disabled = isUploading;
    if (isUploading) {
        uploadTriggerButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        uploadTriggerButton.title = 'Processing...';
    } else {
        uploadTriggerButton.innerHTML = '<i class="bi bi-cloud-upload-fill"></i>';
        uploadTriggerButton.title = 'Upload Images';
    }
}

function setConfirmDeleteButtonState(isDeleting) {
    confirmDeleteButton.disabled = isDeleting;
    if (isDeleting) {
        confirmDeleteButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Deleting...';
    } else {
        confirmDeleteButton.innerHTML = 'Delete';
    }
}

// =============================================================================================================================================== //
// import { auth, db } from './firebase-init.js';
// import { onAuthStateChanged, signOut, getIdToken } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
// import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// const FUNCTION_APP_URL = "http://localhost:7071/api";

// // DOM references
// const imageInput = document.getElementById('imageUploadInput');
// // MODIFIED: Corrected button ID to match your new HTML
// const uploadTriggerButton = document.getElementById('upload-trigger-btn'); 
// const galleryGrid = document.getElementById('galleryGrid');
// const galleryLoadingText = document.getElementById('galleryLoadingText');
// const authLoading = document.getElementById('auth-loading');
// const appContent = document.getElementById('app-content');

// // MODIFICATION: We only DECLARE the modal variables here. We will INITIALIZE them later.
// let imageModal;
// let modalImage;
// let confirmDeleteModal;
// let deleteModalBody;
// let confirmDeleteButton;

// // AUTHENTICATION LOGIC - Main Entry Point
// onAuthStateChanged(auth, (user) => {
    
//     if (user) {
//         authLoading.style.display = 'none';
//         appContent.style.display = 'block'; // Show the main app content
//         // CORRECTED: Pass the 'user' object here
//         initializeApp(user); 
//     } else {
//         // No user is logged in, hide the spinner and redirect.
//         authLoading.style.display = 'none';
//         window.location.replace('signin.html');
//     }
// });

// // INITIALIZATION
// function initializeApp(user) {
//     imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
//     modalImage = document.getElementById('modalImage');
//     confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
//     deleteModalBody = document.getElementById('deleteModalBody');
//     confirmDeleteButton = document.getElementById('confirmDeleteButton');

//     // Attach event listeners
//     uploadTriggerButton.addEventListener('click', () => imageInput.click());
//     imageInput.addEventListener('change', handleUpload);
//     confirmDeleteButton.addEventListener('click', executeDelete);
    
//     // Pass the user object to the dropdown function
//     addProfileDropdown(user);
//     loadImages();
// }

// /**
//  * Creates the user profile dropdown UI, fetches user data, and adds it to the page.
//  * @param {object} user - The authenticated user object from Firebase.
//  */
// async function addProfileDropdown(user) {
//     const header = document.querySelector('header');
//     // Don't add the dropdown if it already exists
//     if (!header || document.getElementById('profile-dropdown')) return;

//     // Fetch the user's name from Firestore
//     let userName = user.email; // Default to email if name isn't found
//     try {
//         const userDocRef = doc(db, "users", user.uid);
//         const userDoc = await getDoc(userDocRef);
//         if (userDoc.exists()) {
//             userName = userDoc.data().name;
//         }
//     } catch (e) {
//         console.error("Could not fetch user's name from Firestore:", e);
//     }
    
//     // Create the HTML for the dropdown
//     const profileHTML = `
//         <div class="dropdown" id="profile-dropdown">
//             <button class="btn btn-dark rounded-circle d-flex align-items-center justify-content-center" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="width: 40px; height: 40px;">
//                 <i class="bi bi-person-fill fs-5"></i>
//             </button>
//             <ul class="dropdown-menu dropdown-menu-end">
//                 <li><h6 class="dropdown-header">PROFILE</h6></li>
//                 <li><span class="dropdown-item-text text-truncate">${userName}</span></li>
//                 <li><span class="dropdown-item-text text-muted small text-truncate">${user.email}</span></li>
//                 <li><hr class="dropdown-divider"></li>
//                 <li><button class="dropdown-item text-danger" id="logout-btn">Log Out</button></li>
//             </ul>
//         </div>
//     `;

//     header.insertAdjacentHTML('beforeend', profileHTML);
//     document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
// }

// // =======================================================================================================
// async function getAuthHeader() {
//     const user = auth.currentUser;
//     if (!user) {
//         // This case should ideally not happen due to the onAuthStateChanged check,
//         // but it's good defensive programming.
//         throw new Error("User not authenticated. Redirecting to login.");
//     }
//     const token = await getIdToken(user);
//     return { 'Authorization': `Bearer ${token}` };
// }



// // =================================================================
// // CORE APP FUNCTIONS
// // =================================================================

// async function handleUpload() {
//     const files = imageInput.files;
//     if (files.length === 0) {
//         updateStatus('Please select one or more files.', 'warning');
//         return;
//     }

//     uploadTriggerButton.disabled = true;
//     uploadTriggerButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';

//     try {
//         const uploadPromises = Array.from(files).map(file => uploadSingleFile(file));
//         await Promise.all(uploadPromises);
        
//         await loadImages();
//     } catch (error) {
//         console.error('An error occurred during one of the uploads:', error);
//         updateStatus(`Error: ${error.message}`, 'danger');
//     } finally {
//         uploadTriggerButton.disabled = false;
//         uploadTriggerButton.innerHTML = '<i class="bi bi-cloud-upload-fill"></i>';
//         imageInput.value = ''; // Reset file input
//     }
// }


// async function uploadSingleFile(file) {
//     try {
//         const headers = await getAuthHeader();
//         const getUrlResponse = await fetch(`${FUNCTION_APP_URL}/getUploadUrl?blobName=${encodeURIComponent(file.name)}`, { headers });
//         if (!getUrlResponse.ok) {
//             throw new Error(`Server could not prepare upload for ${file.name}.`);
//         }
//         const { uploadUrl } = await getUrlResponse.json();

//         const uploadResponse = await fetch(uploadUrl, {
//             method: 'PUT',
//             body: file,
//             headers: { 'x-ms-blob-type': 'BlockBlob' }
//         });

//         if (!uploadResponse.ok) {
//             throw new Error(`Upload failed for ${file.name}: ${uploadResponse.statusText}`);
//         }
//     } catch (authError) {
//         // If getting the header fails, redirect.
//         console.error("Authentication error during upload:", authError);
//         window.location.replace('signin.html');
//     }
// }


// /** 
//  * This function is called ONLY when the user clicks the "Delete" button inside the modal.
//  */
// async function executeDelete() {
//     const blobName = confirmDeleteButton.dataset.blobName;

//     // confirmDeleteButton.disabled = true;
//     // confirmDeleteButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';
//     confirmDeleteButton.disabled = true;
//     confirmDeleteButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';

//     try {
//         const headers = await getAuthHeader();
//         const response = await fetch(`${FUNCTION_APP_URL}/deleteImage`, {
//             method: 'DELETE',
//             headers: { ...headers, 'Content-Type': 'application/json' },
//             body: JSON.stringify({ blobName: blobName })
//         });
//         if (!response.ok) { 
//             const errorData = await response.text();
//             throw new Error(`Failed to delete: ${errorData}`);
//         }
//         // updateStatus(`Successfully deleted ${blobName}`, 'success');
//         await loadImages();
//     } catch (error) {
//         console.log(`Deletion failed: ${error.message}`);
//     } finally {
//         confirmDeleteModal.hide();
//         confirmDeleteButton.disabled = false;
//         confirmDeleteButton.innerHTML = 'Delete';
//     }
// }


// function handleDelete(event) {
//     event.stopPropagation();
//     const blobName = event.currentTarget.dataset.blobName;
//     deleteModalBody.textContent = `Are you sure you want to permanently delete "${blobName}"?`;
//     confirmDeleteButton.dataset.blobName = blobName;
//     confirmDeleteModal.show();
// }
// /**
//  * Fetches image data from our '/getImages' Azure Function and renders the gallery.
//  */
// async function loadImages() {
//     galleryLoadingText.style.display = 'block';
//     galleryGrid.innerHTML = '';

//     try {
//         const headers = await getAuthHeader();
//         const response = await fetch(`${FUNCTION_APP_URL}/getImages`, { headers });
//         if (!response.ok) {
//             // If the token is expired or invalid, the backend will return an error
//             if (response.status === 401 || response.status === 403) {
//                 window.location.replace('sigin.html');
//                 return;
//             }
//             throw new Error(`Failed to fetch images. Status: ${response.status}`);
//         }

//         const images = await response.json();
//         galleryLoadingText.style.display = 'none';

//         if (images.length === 0) {
//             galleryGrid.innerHTML = '<p class="text-muted text-center col-12">Your cloud is empty. Upload some images to get started!</p>';
//             return;
//         }

//         images.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
//         images.forEach(image => {
//             const col = document.createElement('div');
//             col.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';
//             const card = document.createElement('div');
//             card.className = 'gallery-card';
//             const img = document.createElement('img');
//             img.src = image.displayUrl;
//             img.alt = image.rowKey;

//             img.addEventListener('click', () => {
//                 modalImage.src = img.src;
//                 imageModal.show();
//             });

//             const deleteButton = document.createElement('button');
//             deleteButton.className = 'delete-button';
//             deleteButton.innerHTML = '<i class="bi bi-trash3-fill"></i>';
//             deleteButton.dataset.blobName = image.rowKey;
//             deleteButton.addEventListener('click', handleDelete);

//             // Add blur and tags for flagged content (not shown in your UI design but keeping the logic)
//             let isFlagged = image.isAdult || image.isViolent || image.isOffensive || image.isWeapon || image.isDrugs || image.isSelfHarm;
//             if (isFlagged) img.classList.add('flagged-image');
            
//             card.appendChild(deleteButton);
//             card.appendChild(img);
//             col.appendChild(card);
//             galleryGrid.appendChild(col);
//         });

//     } catch (error) {
//         console.error('Error loading gallery:', error);
//         if (error.message.includes("User not authenticated")) {
//             window.location.replace('login.html');
//         } else {
//             galleryLoadingText.style.display = 'none';
//             galleryGrid.innerHTML = `<p class="text-danger text-center col-12">Could not load gallery. Please try again.</p>`;
//         }
//     }
// }
// ================================================================================================================================================================================== //

// async function loadImages() {
//     galleryLoadingText.style.display = 'block';
//     galleryGrid.innerHTML = ''; 

//     try {
//         const response = await fetch(`${FUNCTION_APP_URL}/getImages`);
//         if (!response.ok) throw new Error(`Failed to fetch images. Status: ${response.status}`);
        
//         const images = await response.json();
//         galleryLoadingText.style.display = 'none';

//         if (images.length === 0) {
//             galleryGrid.innerHTML = '<p class="text-muted">No images have been uploaded yet.</p>';
//             return;
//         }

//         images.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
//         images.forEach(image => {
//             const col = document.createElement('div');
//             col.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';
//             const card = document.createElement('div');
//             card.className = 'gallery-card card shadow-sm';
//             const img = document.createElement('img');
//             img.src = image.displayUrl;
//             img.alt = image.rowKey;
            
//             img.addEventListener('click', () => {
//                 modalImage.src = img.src;
//                 imageModal.show();
//             });

//             const tagsContainer = document.createElement('div');
//             tagsContainer.className = 'tags-container';
//             let isFlagged = false;

//             const createTag = (text, type) => {
//                 const tag = document.createElement('span');
//                 tag.className = `tag tag-${type}`;
//                 tag.textContent = text;
//                 tagsContainer.appendChild(tag);
//                 isFlagged = true;
//             };

//             if (image.isAdult) createTag('ADULT', 'adult');
//             if (image.isViolent) createTag('VIOLENCE', 'violent');
//             if (image.isOffensive) createTag('OFFENSIVE', 'offensive');
//             if (image.isWeapon) createTag('WEAPON', 'weapon');
//             if (image.isDrugs) createTag('DRUGS', 'drugs');
//             if (image.isSelfHarm) createTag('SELF-HARM', 'selfharm');

//             if (isFlagged) {
//                 img.classList.add('adult-image');
//             }
//             card.appendChild(tagsContainer);

//             const deleteButton = document.createElement('button');
//             deleteButton.className = 'delete-button';
//             // --- MODIFICATION START: Updated to use the <i> tag for the icon ---
//             deleteButton.innerHTML = '<i class="bi bi-trash-fill"></i>';
//             // --- MODIFICATION END ---
//             deleteButton.dataset.blobName = image.rowKey;
//             deleteButton.addEventListener('click', handleDelete);

//             card.appendChild(deleteButton);
//             card.appendChild(img);
//             col.appendChild(card);
//             galleryGrid.appendChild(col);
//         });

//     } catch (error) {
//         console.error('Error loading gallery:', error);
//         galleryLoadingText.style.display = 'none';
//         galleryGrid.innerHTML = `<p class="text-danger">Could not load gallery. Is the backend running?</p>`;
//     }
// }


// =================================================================
// UI HELPER FUNCTIONS
// =================================================================
// =================================================================
// UI HELPER FUNCTIONS
// =================================================================
// function updateStatus(message, type) {
//     statusMessage.textContent = message;
//     statusMessage.className = message ? `ms-3 alert alert-${type}` : 'ms-3';
// }

// function setUploadUIState(isUploading, fileCount = 0) {
//     uploadButton.disabled = isUploading;
//     uploadSpinner.style.display = isUploading ? 'inline-block' : 'none';
//     uploadButtonText.textContent = isUploading ? `Uploading ${fileCount} file(s)...` : 'Upload Image';
// }

// function setConfirmDeleteButtonState(isDeleting) {
//     confirmDeleteButton.disabled = isDeleting;
//     if (isDeleting) {
//         confirmDeleteButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';
//     } else {
//         confirmDeleteButton.innerHTML = 'Delete';
//     }
// }

// // =================================================================
// // CONFIGURATION
// // =================================================================
// const FUNCTION_APP_URL = "http://localhost:7071/api";


// // =================================================================
// // DOM ELEMENT REFERENCES
// // =================================================================
// const imageInput = document.getElementById('imageUploadInput');
// const uploadButton = document.getElementById('uploadButton');
// const uploadSpinner = document.getElementById('uploadSpinner');
// const uploadButtonText = document.getElementById('uploadButtonText');
// const statusMessage = document.getElementById('statusMessage');
// const galleryGrid = document.getElementById('galleryGrid');
// const galleryLoadingText = document.getElementById('galleryLoadingText');




// // --- MODIFICATION START ---
// // We will declare the modal variables here, but NOT initialize them yet.
// let imageModal;
// let modalImage;
// let confirmDeleteModal;
// let deleteModalBody;
// let confirmDeleteButton;
// // --- MODIFICATION END ---

// // =================================================================
// // EVENT LISTENERS
// // =================================================================
// document.addEventListener('DOMContentLoaded', () => {
//     // --- MODIFICATION START: This block correctly initializes modals after the page loads ---
//     // This fixes the "Cannot read properties of undefined (reading 'backdrop')" error.
//     imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
//     modalImage = document.getElementById('modalImage');
//     confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
//     deleteModalBody = document.getElementById('deleteModalBody');
//     confirmDeleteButton = document.getElementById('confirmDeleteButton');
    
//     // Attach the delete event listener here as well.
//     confirmDeleteButton.addEventListener('click', executeDelete);
    
//     // Load the initial set of images.
//     loadImages();
//     // --- MODIFICATION END ---
// });

// uploadButton.addEventListener('click', handleUpload);


// // =================================================================
// // CORE FUNCTIONS
// // =================================================================

// /**
//  * The main upload handler. It now iterates through all selected files
//  * and uploads them in parallel.
//  */
// async function handleUpload() {
//     const files = imageInput.files;
//     if (files.length === 0) {
//         updateStatus('Please select one or more files first.', 'warning');
//         return;
//     }

//     setUploadUIState(true, files.length);

//     try {
//         // Create an array of upload promises
//         const uploadPromises = Array.from(files).map(file => uploadSingleFile(file));
        
//         // Wait for all uploads to complete
//         await Promise.all(uploadPromises);

//         updateStatus('All uploads successful! Refreshing gallery...', 'success');
        
//         // Refresh the gallery once all files are uploaded
//         await loadImages();

//     } catch (error) {
//         console.error('An error occurred during one of the uploads:', error);
//         updateStatus(`Error: ${error.message}`, 'danger');
//     } finally {
//         setUploadUIState(false);
//         imageInput.value = ''; // Clear the file input
//         setTimeout(() => updateStatus('', ''), 5000);
//     }
// }

// /**
//  * A helper function that handles the logic for uploading a single file.
//  * Returns a promise that resolves when the upload is complete.
//  * @param {File} file The file to upload.
//  */
// async function uploadSingleFile(file) {
//     // 1. Get a secure SAS URL from our Azure Function
//     const getUrlResponse = await fetch(`${FUNCTION_APP_URL}/getUploadUrl?blobName=${encodeURIComponent(file.name)}`);
//     if (!getUrlResponse.ok) {
//         throw new Error(`Could not get upload URL for ${file.name}.`);
//     }
//     const { uploadUrl } = await getUrlResponse.json();

//     // 2. Upload the file directly to Azure Blob Storage using the SAS URL
//     const uploadResponse = await fetch(uploadUrl, {
//         method: 'PUT',
//         body: file,
//         headers: { 'x-ms-blob-type': 'BlockBlob' }
//     });

//     if (!uploadResponse.ok) {
//         throw new Error(`Upload failed for ${file.name}: ${uploadResponse.statusText}`);
//     }
// }


// /** 
//  * UPDATED: This function now just opens the confirmation modal.
//  * The actual deletion logic is moved to a separate function.
//  */
// function handleDelete(event) {
//     event.stopPropagation();
//     const blobName = event.currentTarget.dataset.blobName;
    
//     // Set the confirmation message in the modal
//     deleteModalBody.textContent = `Are you sure you want to permanently delete "${blobName}"?`;
    
//     // Store the blobName on the confirm button to be used later
//     confirmDeleteButton.dataset.blobName = blobName;
    
//     // Show the modal
//     confirmDeleteModal.show();
// }

// /** 
//  * NEW: This function is called ONLY when the user clicks the "Delete" button inside the modal.
//  */
// async function executeDelete() {
//     const blobName = confirmDeleteButton.dataset.blobName;
    
//     // Show a loading state on the button
//     confirmDeleteButton.disabled = true;
//     confirmDeleteButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';
    
//     try {
//         const response = await fetch(`${FUNCTION_APP_URL}/deleteImage`, {
//             method: 'DELETE',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ blobName: blobName })
//         });
//         if (!response.ok) {
//             const errorData = await response.text();
//             throw new Error(`Failed to delete: ${errorData}`);
//         }
//         updateStatus(`Successfully deleted ${blobName}`, 'success');
//         await loadImages(); // Refresh the gallery
//     } catch (error) {
//         updateStatus(error.message, 'danger');
//     } finally {
//         // Hide the modal and reset the button
//         confirmDeleteModal.hide();
//         confirmDeleteButton.disabled = false;
//         confirmDeleteButton.innerHTML = 'Delete';
//     }
// }

// /**
//  * Fetches image data from our '/getImages' Azure Function and renders the gallery.
//  * (This function includes the new blur/tag logic)
//  */
// async function loadImages() {
//     galleryLoadingText.style.display = 'block';
//     galleryGrid.innerHTML = ''; 

//     try {
//         const response = await fetch(`${FUNCTION_APP_URL}/getImages`);
//         if (!response.ok) throw new Error(`Failed to fetch images. Status: ${response.status}`);
        
//         const images = await response.json();
//         galleryLoadingText.style.display = 'none';

//         if (images.length === 0) {
//             galleryGrid.innerHTML = '<p class="text-muted">No images have been uploaded yet.</p>';
//             return;
//         }

//         images.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
//         images.forEach(image => {
//             const col = document.createElement('div');
//             col.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';
//             const card = document.createElement('div');
//             card.className = 'gallery-card card shadow-sm';
//             const img = document.createElement('img');
//             img.src = image.displayUrl;
//             img.alt = image.rowKey;
            
//             img.addEventListener('click', () => {
//                 modalImage.src = img.src;
//                 imageModal.show();
//             });

//             // --- NEW TAGGING LOGIC ---
//             const tagsContainer = document.createElement('div');
//             tagsContainer.className = 'tags-container';
//             let isFlagged = false;

//             // Function to create a tag element
//             const createTag = (text, type) => {
//                 const tag = document.createElement('span');
//                 tag.className = `tag tag-${type}`;
//                 tag.textContent = text;
//                 tagsContainer.appendChild(tag);
//                 isFlagged = true;
//             };

//             if (image.isAdult) createTag('ADULT', 'adult');
//             if (image.isViolent) createTag('VIOLENCE', 'violent');
//             if (image.isOffensive) createTag('OFFENSIVE', 'offensive');
//             if (image.isWeapon) createTag('WEAPON', 'weapon');
//             if (image.isDrugs) createTag('DRUGS', 'drugs');
//             if (image.isSelfHarm) createTag('SELF-HARM', 'selfharm');

//             // Apply blur if any flag is true
//             if (isFlagged) {
//                 img.classList.add('adult-image');
//             }

//             card.appendChild(tagsContainer);

//             // Add the delete button
//             const deleteButton = document.createElement('button');
//             deleteButton.className = 'delete-button';
//             deleteButton.innerHTML = '<i class="bi bi-trash-fill"></i>'; // UPDATED: Use <i> tag for a Bootstrap trash icon
//             deleteButton.dataset.blobName = image.rowKey;
//             deleteButton.addEventListener('click', handleDelete);

//             card.appendChild(deleteButton);
//             card.appendChild(img);
//             col.appendChild(card);
//             galleryGrid.appendChild(col);
//         });

//     } catch (error) {
//         console.error('Error loading gallery:', error);
//         galleryLoadingText.style.display = 'none';
//         galleryGrid.innerHTML = `<p class="text-danger">Could not load gallery. Is the backend running?</p>`;
//     }
// }


// // =================================================================
// // UI HELPER FUNCTIONS
// // =================================================================

// function updateStatus(message, type) {
//     statusMessage.textContent = message;
//     statusMessage.className = message ? `ms-3 alert alert-${type}` : 'ms-3';
// }

// function setUploadUIState(isUploading, fileCount = 0) {
//     uploadButton.disabled = isUploading;
//     uploadSpinner.style.display = isUploading ? 'inline-block' : 'none';
//     if (isUploading) {
//         uploadButtonText.textContent = `Uploading ${fileCount} file(s)...`;
//     } else {
//         uploadButtonText.textContent = 'Upload Image';
//     }
// }