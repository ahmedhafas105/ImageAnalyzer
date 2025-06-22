
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

// --- MODIFICATION START: Cleaned up commented-out code ---
// We declare the modal variables here, but will initialize them after the page loads.
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
    // --- MODIFICATION START: This block correctly initializes modals after the page loads ---
    // This fixes the "Cannot read properties of undefined (reading 'backdrop')" error.
    imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
    modalImage = document.getElementById('modalImage');
    confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
    deleteModalBody = document.getElementById('deleteModalBody');
    confirmDeleteButton = document.getElementById('confirmDeleteButton');
    
    // Attach the delete event listener to the button inside the confirmation modal.
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
        const uploadPromises = Array.from(files).map(file => uploadSingleFile(file));
        await Promise.all(uploadPromises);
        updateStatus('All uploads successful! Refreshing gallery...', 'success');
        await loadImages();
    } catch (error) {
        console.error('An error occurred during one of the uploads:', error);
        updateStatus(`Error: ${error.message}`, 'danger');
    } finally {
        setUploadUIState(false);
        imageInput.value = '';
        setTimeout(() => updateStatus('', ''), 5000);
    }
}

/**
 * A helper function that handles the logic for uploading a single file.
 */
async function uploadSingleFile(file) {
    const getUrlResponse = await fetch(`${FUNCTION_APP_URL}/getUploadUrl?blobName=${encodeURIComponent(file.name)}`);
    if (!getUrlResponse.ok) {
        throw new Error(`Could not get upload URL for ${file.name}.`);
    }
    const { uploadUrl } = await getUrlResponse.json();

    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'x-ms-blob-type': 'BlockBlob' }
    });

    if (!uploadResponse.ok) {
        throw new Error(`Upload failed for ${file.name}: ${uploadResponse.statusText}`);
    }
}


// --- MODIFICATION START: Removed the old, redundant handleDelete function ---
// This function now correctly opens the confirmation modal instead of using the browser's confirm().
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
 * This function is called ONLY when the user clicks the "Delete" button inside the modal.
 */
async function executeDelete() {
    const blobName = confirmDeleteButton.dataset.blobName;
    
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
        confirmDeleteModal.hide();
        confirmDeleteButton.disabled = false;
        confirmDeleteButton.innerHTML = 'Delete';
    }
}
// --- MODIFICATION END ---


/**
 * Fetches image data from our '/getImages' Azure Function and renders the gallery.
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

            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'tags-container';
            let isFlagged = false;

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

            if (isFlagged) {
                img.classList.add('adult-image');
            }
            card.appendChild(tagsContainer);

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            // --- MODIFICATION START: Updated to use the <i> tag for the icon ---
            deleteButton.innerHTML = '<i class="bi bi-trash-fill"></i>';
            // --- MODIFICATION END ---
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