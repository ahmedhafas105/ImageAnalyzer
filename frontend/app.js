// =================================================================
// CONFIGURATION
// =================================================================
const FUNCTION_APP_URL = "http://localhost:7071/api";


// =================================================================
// DOM ELEMENT REFERENCES
// =================================================================
const imageInput = document.getElementById('imageUploadInput');
const uploadButton = document.getElementById('uploadButton');
const uploadSpinner = document.getElementById('uploadSpinner');
const uploadButtonText = document.getElementById('uploadButtonText');
const statusMessage = document.getElementById('statusMessage');
const galleryGrid = document.getElementById('galleryGrid');
const galleryLoadingText = document.getElementById('galleryLoadingText');
// Initialize the Bootstrap Modal from the HTML
// const imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
// const modalImage = document.getElementById('modalImage');
// // NEW: Confirmation Modal for Deletion
// const confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
// const deleteModalBody = document.getElementById('deleteModalBody');
// const confirmDeleteButton = document.getElementById('confirmDeleteButton');



// --- MODIFICATION START ---
// We will declare the modal variables here, but NOT initialize them yet.
let imageModal;
let modalImage;
let confirmDeleteModal;
let deleteModalBody;
let confirmDeleteButton;
// --- MODIFICATION END ---

// =================================================================
// EVENT LISTENERS
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // --- MODIFICATION START ---
    // NOW that the page is fully loaded, we can safely find our HTML elements
    // and initialize the Bootstrap modals.
    imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
    modalImage = document.getElementById('modalImage');
    confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
    deleteModalBody = document.getElementById('deleteModalBody');
    confirmDeleteButton = document.getElementById('confirmDeleteButton');
    
    // Attach the delete event listener here as well.
    confirmDeleteButton.addEventListener('click', executeDelete);
    
    // Load the initial set of images.
    loadImages();
    // --- MODIFICATION END ---
});

uploadButton.addEventListener('click', handleUpload);


// =================================================================
// CORE FUNCTIONS
// =================================================================

/**
 * The main upload handler. It now iterates through all selected files
 * and uploads them in parallel.
 */
async function handleUpload() {
    const files = imageInput.files;
    if (files.length === 0) {
        updateStatus('Please select one or more files first.', 'warning');
        return;
    }

    setUploadUIState(true, files.length);

    try {
        // Create an array of upload promises
        const uploadPromises = Array.from(files).map(file => uploadSingleFile(file));
        
        // Wait for all uploads to complete
        await Promise.all(uploadPromises);

        updateStatus('All uploads successful! Refreshing gallery...', 'success');
        
        // Refresh the gallery once all files are uploaded
        await loadImages();

    } catch (error) {
        console.error('An error occurred during one of the uploads:', error);
        updateStatus(`Error: ${error.message}`, 'danger');
    } finally {
        setUploadUIState(false);
        imageInput.value = ''; // Clear the file input
        setTimeout(() => updateStatus('', ''), 5000);
    }
}

/**
 * A helper function that handles the logic for uploading a single file.
 * Returns a promise that resolves when the upload is complete.
 * @param {File} file The file to upload.
 */
async function uploadSingleFile(file) {
    // 1. Get a secure SAS URL from our Azure Function
    const getUrlResponse = await fetch(`${FUNCTION_APP_URL}/getUploadUrl?blobName=${encodeURIComponent(file.name)}`);
    if (!getUrlResponse.ok) {
        throw new Error(`Could not get upload URL for ${file.name}.`);
    }
    const { uploadUrl } = await getUrlResponse.json();

    // 2. Upload the file directly to Azure Blob Storage using the SAS URL
    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'x-ms-blob-type': 'BlockBlob' }
    });

    if (!uploadResponse.ok) {
        throw new Error(`Upload failed for ${file.name}: ${uploadResponse.statusText}`);
    }
}


/** NEW: Main handler for deleting an image */
async function handleDelete(event) {
    // Stop the click from also triggering the modal popup
    event.stopPropagation(); 
    
    const blobName = event.currentTarget.dataset.blobName;
    if (!confirm(`Are you sure you want to delete "${blobName}"? This action cannot be undone.`)) {
        return;
    }
    try {
        const response = await fetch(`${FUNCTION_APP_URL}/deleteImage`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blobName: blobName })
        });
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Failed to delete: ${errorData}`);
        }
        updateStatus(`Successfully deleted ${blobName}`, 'success');
        await loadImages(); // Refresh the gallery
    } catch (error) {
        updateStatus(error.message, 'danger');
    }
}


/** 
 * UPDATED: This function now just opens the confirmation modal.
 * The actual deletion logic is moved to a separate function.
 */
function handleDelete(event) {
    event.stopPropagation();
    const blobName = event.currentTarget.dataset.blobName;
    
    // Set the confirmation message in the modal
    deleteModalBody.textContent = `Are you sure you want to permanently delete "${blobName}"?`;
    
    // Store the blobName on the confirm button to be used later
    confirmDeleteButton.dataset.blobName = blobName;
    
    // Show the modal
    confirmDeleteModal.show();
}

/** 
 * NEW: This function is called ONLY when the user clicks the "Delete" button inside the modal.
 */
async function executeDelete() {
    const blobName = confirmDeleteButton.dataset.blobName;
    
    // Show a loading state on the button
    confirmDeleteButton.disabled = true;
    confirmDeleteButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';
    
    try {
        const response = await fetch(`${FUNCTION_APP_URL}/deleteImage`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blobName: blobName })
        });
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Failed to delete: ${errorData}`);
        }
        updateStatus(`Successfully deleted ${blobName}`, 'success');
        await loadImages(); // Refresh the gallery
    } catch (error) {
        updateStatus(error.message, 'danger');
    } finally {
        // Hide the modal and reset the button
        confirmDeleteModal.hide();
        confirmDeleteButton.disabled = false;
        confirmDeleteButton.innerHTML = 'Delete';
    }
}
// NEW: Attach the executeDelete function to the modal's delete button click event
confirmDeleteButton.addEventListener('click', executeDelete);


/**
 * Fetches image data from our '/getImages' Azure Function and renders the gallery.
 * (This function includes the new blur/tag logic)
 */
async function loadImages() {
    galleryLoadingText.style.display = 'block';
    galleryGrid.innerHTML = ''; 

    try {
        const response = await fetch(`${FUNCTION_APP_URL}/getImages`);
        if (!response.ok) throw new Error(`Failed to fetch images. Status: ${response.status}`);
        
        const images = await response.json();
        galleryLoadingText.style.display = 'none';

        if (images.length === 0) {
            galleryGrid.innerHTML = '<p class="text-muted">No images have been uploaded yet.</p>';
            return;
        }

        images.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        images.forEach(image => {
            const col = document.createElement('div');
            col.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';
            const card = document.createElement('div');
            card.className = 'gallery-card card shadow-sm';
            const img = document.createElement('img');
            img.src = image.displayUrl;
            img.alt = image.rowKey;
            
            img.addEventListener('click', () => {
                modalImage.src = img.src;
                imageModal.show();
            });

            // --- NEW TAGGING LOGIC ---
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'tags-container';
            let isFlagged = false;

            // Function to create a tag element
            const createTag = (text, type) => {
                const tag = document.createElement('span');
                tag.className = `tag tag-${type}`;
                tag.textContent = text;
                tagsContainer.appendChild(tag);
                isFlagged = true;
            };

            if (image.isAdult) createTag('ADULT', 'adult');
            if (image.isViolent) createTag('VIOLENCE', 'violent');
            if (image.isOffensive) createTag('OFFENSIVE', 'offensive');
            if (image.isWeapon) createTag('WEAPON', 'weapon');
            if (image.isDrugs) createTag('DRUGS', 'drugs');
            if (image.isSelfHarm) createTag('SELF-HARM', 'selfharm');

            // Apply blur if any flag is true
            if (isFlagged) {
                img.classList.add('adult-image');
            }

            card.appendChild(tagsContainer);

            // Add the delete button
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.innerHTML = '<i class="bi bi-trash-fill"></i>'; // UPDATED: Use <i> tag for a Bootstrap trash icon
            deleteButton.dataset.blobName = image.rowKey;
            deleteButton.addEventListener('click', handleDelete);

            card.appendChild(deleteButton);
            card.appendChild(img);
            col.appendChild(card);
            galleryGrid.appendChild(col);
        });

    } catch (error) {
        console.error('Error loading gallery:', error);
        galleryLoadingText.style.display = 'none';
        galleryGrid.innerHTML = `<p class="text-danger">Could not load gallery. Is the backend running?</p>`;
    }
}


// =================================================================
// UI HELPER FUNCTIONS
// =================================================================

function updateStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = message ? `ms-3 alert alert-${type}` : 'ms-3';
}

function setUploadUIState(isUploading, fileCount = 0) {
    uploadButton.disabled = isUploading;
    uploadSpinner.style.display = isUploading ? 'inline-block' : 'none';
    if (isUploading) {
        uploadButtonText.textContent = `Uploading ${fileCount} file(s)...`;
    } else {
        uploadButtonText.textContent = 'Upload Image';
    }
}

// // =================================================================
// // CONFIGURATION
// // =================================================================
// // IMPORTANT: You MUST change this value to your Azure Function App's URL.
// //
// // For local development (running 'func start'), use: "http://localhost:7071/api"
// // For your deployed app, use: "https://your-app-name.azurewebsites.net/api"
// //
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


// // =================================================================
// // EVENT LISTENERS
// // =================================================================
// // Load images from Azure as soon as the page is ready.
// document.addEventListener('DOMContentLoaded', loadImages);

// // Handle the upload button click.
// uploadButton.addEventListener('click', handleUpload);


// // =================================================================
// // CORE FUNCTIONS
// // =================================================================

// /**
//  * Fetches image data from our '/getImages' Azure Function and renders the gallery.
//  */
// async function loadImages() {
//     galleryLoadingText.style.display = 'block';
//     galleryGrid.innerHTML = ''; // Clear existing images to prevent duplicates on refresh

//     try {
//         const response = await fetch(`${FUNCTION_APP_URL}/getImages`);
//         if (!response.ok) {
//             throw new Error(`Failed to fetch images. Status: ${response.status}`);
//         }
        
//         const images = await response.json();
//         galleryLoadingText.style.display = 'none';

//         if (images.length === 0) {
//             galleryGrid.innerHTML = '<p class="text-muted">No images have been uploaded yet.</p>';
//             return;
//         }

//         // Sort images to show the newest first (based on the upload timestamp)
//         images.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
//         images.forEach(image => {
//             // Create the Bootstrap grid column
//             const col = document.createElement('div');
//             col.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';

//             // Create the card element
//             const card = document.createElement('div');
//             card.className = 'gallery-card card shadow-sm';

//             // Create the image
//             const img = document.createElement('img');
//             // img.src = image.imageUrl;
//             img.src = image.displayUrl; // Use the temporary SAS URL for display
//             img.alt = image.rowKey; // The rowKey is the filename
            
//             card.appendChild(img);

//             // Add the "ADULT" tag only if the analysis flagged it
//             if (image.isAdult) {
//                 img.classList.add('adult-image'); // Apply blur effect
//                 const tag = document.createElement('span');
//                 tag.className = 'adult-tag';
//                 tag.textContent = 'ADULT';
//                 card.appendChild(tag);
//             }

//             col.appendChild(card);
//             galleryGrid.appendChild(col);
//         });

//     } catch (error) {
//         console.error('Error loading gallery:', error);
//         galleryLoadingText.style.display = 'none';
//         galleryGrid.innerHTML = `<p class="text-danger">Could not load gallery. Is the backend running?</p>`;
//     }
// }


// /**
//  * Handles the entire file upload process when the user clicks the upload button.
//  */
// async function handleUpload() {
//     const file = imageInput.files[0];
//     if (!file) {
//         updateStatus('Please select a file first.', 'warning');
//         return;
//     }

//     setUploadUIState(true); // Disable button, show spinner
//     updateStatus('1/3: Requesting upload permission...', 'info');

//     try {
//         // 1. Get a secure SAS URL from our '/getUploadUrl' Azure Function
//         const getUrlResponse = await fetch(`${FUNCTION_APP_URL}/getUploadUrl?blobName=${encodeURIComponent(file.name)}`);
//         if (!getUrlResponse.ok) throw new Error('Could not get the upload URL from the server.');
        
//         const { uploadUrl } = await getUrlResponse.json();

//         // 2. Upload the file directly to Azure Blob Storage using the SAS URL
//         updateStatus('2/3: Uploading image...', 'info');
//         const uploadResponse = await fetch(uploadUrl, {
//             method: 'PUT',
//             body: file,
//             headers: { 'x-ms-blob-type': 'BlockBlob' }
//         });

//         if (!uploadResponse.ok) {
//             throw new Error(`Upload failed with status: ${uploadResponse.statusText}`);
//         }

//         updateStatus('3/3: Upload successful! Refreshing gallery...', 'success');

//         // 3. Refresh the gallery to show the new image immediately
//         await loadImages();

//     } catch (error) {
//         console.error('Upload process failed:', error);
//         updateStatus(`Error: ${error.message}`, 'danger');
//     } finally {
//         setUploadUIState(false); // Re-enable button, hide spinner
//         imageInput.value = ''; // Clear the file input for the next upload
//         // Hide the status message after a few seconds
//         setTimeout(() => updateStatus('', ''), 5000);
//     }
// }


// // =================================================================
// // UI HELPER FUNCTIONS
// // =================================================================

// /**
//  * Updates the status message div with a message and a color style.
//  * @param {string} message The message to display.
//  * @param {'info'|'success'|'warning'|'danger'} type The type of alert for Bootstrap styling.
//  */
// function updateStatus(message, type) {
//     statusMessage.textContent = message;
//     // Resets classes and adds the new ones
//     statusMessage.className = message ? `ms-3 alert alert-${type}` : 'ms-3';
// }

// /**
//  * Manages the UI state of the upload button to prevent double-clicks.
//  * @param {boolean} isUploading True if an upload is in progress.
//  */
// function setUploadUIState(isUploading) {
//     uploadButton.disabled = isUploading;
//     uploadSpinner.style.display = isUploading ? 'inline-block' : 'none';
//     uploadButtonText.textContent = isUploading ? 'Uploading...' : 'Upload Image';
// }