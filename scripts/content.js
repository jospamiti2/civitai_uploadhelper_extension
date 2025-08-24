console.log("✅ Hello from the Civitai Helper content script!");

let videoToUpload = null;
let imageToUpload = null;
let metadataModal = null;



// --- UI CREATION ---
const banner = document.createElement('div');
banner.style.position = 'fixed';
banner.style.bottom = '0';
banner.style.left = '0';
banner.style.width = '100%';
banner.style.padding = '10px';
banner.style.backgroundColor = '#2c3e50';
banner.style.color = 'white';
banner.style.display = 'none';
banner.style.alignItems = 'center';
banner.style.zIndex = '9999';
banner.style.fontFamily = 'sans-serif';
banner.style.fontSize = '16px';
document.body.append(banner);

// --- Banner Content ---
const titleSpan = document.createElement('span');
titleSpan.style.fontWeight = 'bold';
titleSpan.textContent = 'Civitai Helper:';
banner.appendChild(titleSpan);

const videoLabel = document.createElement('span');
videoLabel.style.marginLeft = '15px';
videoLabel.textContent = 'Video:';
banner.appendChild(videoLabel);

const videoInput = document.createElement('input');
videoInput.type = 'file';
videoInput.accept = "video/mp4,video/webm";
banner.appendChild(videoInput);

const imageLabel = document.createElement('span');
imageLabel.textContent = 'Image (Optional):';
imageLabel.style.marginLeft = '15px';
banner.appendChild(imageLabel);

const imageInput = document.createElement('input');
imageInput.type = 'file';
imageInput.accept = "image/png,image/jpeg,image/webp";
banner.appendChild(imageInput);

const uploadButton = document.createElement('button');
uploadButton.textContent = 'Upload';
uploadButton.disabled = true;
uploadButton.style.marginLeft = '15px'; uploadButton.style.padding = '5px 10px'; uploadButton.style.border = '1px solid #555'; uploadButton.style.borderRadius = '5px'; uploadButton.style.backgroundColor = '#3498db'; uploadButton.style.color = 'white'; uploadButton.style.cursor = 'pointer';
banner.appendChild(uploadButton);

// New elements for status and error handling
const statusSpan = document.createElement('span');
statusSpan.style.marginLeft = '20px';
banner.appendChild(statusSpan);

const retryButton = document.createElement('button');
retryButton.textContent = 'Delete Post & Reload';
retryButton.style.marginLeft = '15px'; retryButton.style.padding = '5px 10px'; retryButton.style.border = '1px solid #555'; retryButton.style.borderRadius = '5px'; retryButton.style.backgroundColor = '#c0392b'; retryButton.style.color = 'white'; retryButton.style.cursor = 'pointer';
retryButton.style.display = 'none'; 
banner.appendChild(retryButton);


// --- METADATA MODAL CREATION ---
function createMetadataModal() {
    // Helper function to create labeled input rows
    const createInputRow = (label, inputElement) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.marginBottom = '10px';
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.width = '150px';
        labelEl.style.flexShrink = '0';
        row.appendChild(labelEl);
        row.appendChild(inputElement);
        return row;
    };

    const createTextInput = (id) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = id;
        input.style.width = '100%';
        input.style.padding = '5px';
        return input;
    };
    
    const createNumberInput = (id) => {
        const input = createTextInput(id);
        input.type = 'number';
        return input;
    }

    const createTextarea = (id, rows = 2) => {
        const textarea = document.createElement('textarea');
        textarea.id = id;
        textarea.rows = rows;
        textarea.style.width = '100%';
        textarea.style.padding = '5px';
        return textarea;
    };

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'ch-modal-overlay';
    Object.assign(modalOverlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'none', justifyContent: 'center',
        alignItems: 'center', zIndex: '10000'
    });

    const modalContainer = document.createElement('div');
    Object.assign(modalContainer.style, {
        backgroundColor: '#34495e', padding: '20px', borderRadius: '8px',
        width: '800px', maxHeight: '90vh', overflowY: 'auto'
    });
    modalOverlay.appendChild(modalContainer);
    
    // --- Modal Content ---
    modalContainer.innerHTML = `
        <h2 style="margin-top:0; border-bottom: 1px solid #555; padding-bottom: 10px;">Video Post Metadata</h2>
    `;

    // --- Video Section ---
    const videoSection = document.createElement('div');
    videoSection.innerHTML = '<h3>Video Generation Data</h3>';
    videoSection.appendChild(createInputRow('Prompt:', createTextarea('ch-video-prompt', 4)));
    videoSection.appendChild(createInputRow('Negative Prompt:', createTextarea('ch-video-neg-prompt', 4)));
    videoSection.appendChild(createInputRow('Guidance Scale:', createNumberInput('ch-video-guidance')));
    videoSection.appendChild(createInputRow('Steps:', createNumberInput('ch-video-steps')));
    videoSection.appendChild(createInputRow('Sampler:', createTextInput('ch-video-sampler')));
    videoSection.appendChild(createInputRow('Seed:', createNumberInput('ch-video-seed')));
    videoSection.appendChild(createInputRow('Resources (;):', createTextInput('ch-video-resources')));
    videoSection.appendChild(createInputRow('Tools (;):', createTextInput('ch-video-tools')));
    videoSection.appendChild(createInputRow('Techniques (;):', createTextInput('ch-video-techniques')));
    modalContainer.appendChild(videoSection);

    // --- Image Section ---
    const imageSection = document.createElement('div');
    imageSection.id = 'ch-image-section';
    imageSection.innerHTML = '<h3 style="margin-top: 20px;">Image Generation Data</h3>';
    imageSection.appendChild(createInputRow('Resources (;):', createTextInput('ch-image-resources')));
    imageSection.appendChild(createInputRow('Tools (;):', createTextInput('ch-image-tools')));
    imageSection.appendChild(createInputRow('Techniques (;):', createTextInput('ch-image-techniques')));
    modalContainer.appendChild(imageSection);
    
    // --- Common Section ---
    const commonSection = document.createElement('div');
    commonSection.innerHTML = '<h3 style="margin-top: 20px;">Common Settings</h3>';
    commonSection.appendChild(createInputRow('Offset to publish (minutes):', createNumberInput('ch-common-offset')));
    modalContainer.appendChild(commonSection);

    // --- Actions ---
    const postButton = document.createElement('button');
    postButton.textContent = 'Save & Post Later';
    Object.assign(postButton.style, {
        marginTop: '20px', padding: '10px 20px', fontSize: '16px',
        backgroundColor: '#27ae60', color: 'white', border: 'none',
        borderRadius: '5px', cursor: 'pointer'
    });
    modalContainer.appendChild(postButton);

    document.body.appendChild(modalOverlay);
    metadataModal = modalOverlay; // Assign to global variable

    // --- Event Listeners ---
    postButton.addEventListener('click', handlePostButtonClick);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) hideModal();
    });
}

function showModal() {
    if (!metadataModal) createMetadataModal();
    const imageSection = metadataModal.querySelector('#ch-image-section');
    imageSection.style.display = imageToUpload ? 'block' : 'none';
    metadataModal.style.display = 'flex';
}

window.showModal = showModal;

function hideModal() {
    if (metadataModal) metadataModal.style.display = 'none';
}

window.hideModal = hideModal;


function handlePostButtonClick() {
    const capturedData = {
        videoPrompt: document.getElementById('ch-video-prompt').value,
        videoNegativePrompt: document.getElementById('ch-video-neg-prompt').value,
        videoGuidance: document.getElementById('ch-video-guidance').value,
        videoSteps: document.getElementById('ch-video-steps').value,
        videoSampler: document.getElementById('ch-video-sampler').value,
        videoSeed: document.getElementById('ch-video-seed').value,
        videoResources: document.getElementById('ch-video-resources').value,
        videoTools: document.getElementById('ch-video-tools').value,
        videoTechniques: document.getElementById('ch-video-techniques').value,
        
        imageResources: document.getElementById('ch-image-resources').value,
        imageTools: document.getElementById('ch-image-tools').value,
        imageTechniques: document.getElementById('ch-image-techniques').value,
        
        commonOffset: document.getElementById('ch-common-offset').value
    };
    
    console.log("✅ Metadata captured:", capturedData);
    alert("Metadata saved. The script will use this data to fill the form once the 'Post' action is implemented.");
    hideModal();
    // TODO: In a future step, this will trigger the form-filling logic.
}



// --- LOGIC ---

/**
 * Checks if the current page is the video upload page and toggles the banner's visibility.
 */
function checkPageAndToggleBanner() {
    const isUploadPage = 
    (window.location.href.startsWith('https://civitai.com/posts/create') || 
    (window.location.href.startsWith('https://civitai.com/posts/') && (window.location.href.indexOf('/edit?video=true') > 0)));
    if (banner) { 
        banner.style.display = isUploadPage ? 'flex' : 'none';
    }
}

// --- UI State Management ---
const initialUIElements = [videoLabel, videoInput, imageLabel, imageInput, uploadButton];

function setBannerToInitialState() {
    statusSpan.textContent = '';
    retryButton.style.display = 'none';
    initialUIElements.forEach(el => el.style.display = 'inline-block');
    checkUploadability(); 
}

function setBannerToWorkingState() {
    statusSpan.textContent = '';
    retryButton.style.display = 'none';
    initialUIElements.forEach(el => el.style.display = 'none');
    checkUploadability(); 
}


function setBannerToErrorState(errorMessage) {
    statusSpan.textContent = `❌ ${errorMessage}`;
    statusSpan.style.color = '#ffcccc'; // Make error text reddish
    retryButton.style.display = 'inline-block';
    initialUIElements.forEach(el => el.style.display = 'none');
}

/**
 * Placeholder for deleting the created post.
 */
async function deletePost() {
    console.log("TODO: Implement post deletion logic here.");
    // When implemented, this should find the post and click its delete button.
    alert("Post deletion not implemented. Reloading page.");
    window.location.reload();
}

retryButton.addEventListener('click', deletePost);


// --- PAGE VISIBILITY OBSERVER ---
checkPageAndToggleBanner();
const pageObserver = new MutationObserver(() => {
  checkPageAndToggleBanner();
});
pageObserver.observe(document.body, { childList: true, subtree: true });


function checkUploadability() {
    uploadButton.disabled = !videoToUpload;
}

videoInput.addEventListener('change', () => {
    videoToUpload = videoInput.files.length > 0 ? videoInput.files[0] : null;
    checkUploadability();
});

imageInput.addEventListener('change', () => {
    imageToUpload = imageInput.files.length > 0 ? imageInput.files[0] : null;
    checkUploadability();
});

uploadButton.addEventListener('click', runUploadOrchestrator);


// --- The Orchestrator ---
// Manages the overall upload process for video and optional image
// by coordinating the lifecycle manager for each file.
// Handles UI state transitions and error reporting.
async function runUploadOrchestrator() {
    if (!videoToUpload) return;

    showModal();

    setBannerToWorkingState();
    uploadButton.disabled = true; // Prevent double clicks

    try {
        const dryProgressSelector = 'div.w-full:has(.mantine-Dropzone-root) + div.mantine-Progress-root';
        // --- VIDEO LIFECYCLE ---
        await manageUploadLifecycle({
            file: videoToUpload,
            name: 'Video',
            progressSelector: dryProgressSelector,
            successSelector: 'video[class*="EdgeMedia_responsive"]'
        });

        // --- IMAGE LIFECYCLE (only if an image is provided) ---
        if (imageToUpload) {
            await manageUploadLifecycle({
                file: imageToUpload,
                name: 'Image',
                progressSelector: dryProgressSelector,
                successSelector: 'img[class*="EdgeImage_image"]'
            });
        }

        statusSpan.style.color = 'white'; // Reset color on success
        statusSpan.textContent = '✅ All uploads complete! You can now fill out the form.';

    } catch (error) {
        console.error('Orchestrator failed:', error);
        setBannerToErrorState(error.message);
    } finally {
        // Re-enable the button once the process is truly finished or failed
        uploadButton.disabled = false;
    }
}

// --- The Core State Machine for a single upload ---

async function manageUploadLifecycle(config) {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // 1. ATTEMPT UPLOAD
            statusSpan.textContent = `⏳ Uploading ${config.name}... (Attempt ${attempt}/${MAX_RETRIES})`;
            triggerUpload([config.file]);

            // 2. MONITOR PROGRESS (Wait for progress bar to appear, then disappear)
            await waitForElement(config.progressSelector, 15000); // 15s timeout to appear
            statusSpan.textContent = `⏳ Processing ${config.name}...`;
            await waitForElementToDisappear(config.progressSelector, 120000); // 2min timeout to disappear

            // 3. VERIFY OUTCOME (Wait for the final element to appear)
            statusSpan.textContent = `⏳ Verifying ${config.name}...`;
            await waitForElement(config.successSelector, 60000); // 60s grace period

            // If all awaits complete without throwing an error, the upload was a success!
            console.log(`✅ ${config.name} upload successful on attempt ${attempt}.`);
            return; // Exit the loop and the function successfully

        } catch (error) {
            console.warn(`Attempt ${attempt} for ${config.name} failed:`, error.message);
            setBannerToInitialState();
            if (attempt === MAX_RETRIES) {
                // If this was the last attempt, throw a fatal error
                throw new Error(`Failed to upload ${config.name} after ${MAX_RETRIES} attempts.`);
            }
            // Otherwise, the loop will continue to the next attempt
        }
    }
}

// --- Low-Level Helper Functions (using Promises) ---

function triggerUpload(files) {
    // This function is the same as the last working version
    const dropzone = document.querySelector('.mantine-Dropzone-root');
    if (!dropzone) throw new Error("Could not find dropzone.");
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    dropzone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer }));
    dropzone.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer }));
    dropzone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }));
    const inputElement = dropzone.querySelector('input[type="file"]');
    if (inputElement) {
        inputElement.files = dataTransfer.files;
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

function waitForElement(selector, timeout) {
    return new Promise((resolve, reject) => {
        // If the element already exists, resolve immediately
        if (document.querySelector(selector)) return resolve();

        const timeoutId = setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout: Element "${selector}" did not appear within ${timeout}ms.`));
        }, timeout);

        const observer = new MutationObserver((mutations, obs) => {
            if (document.querySelector(selector)) {
                clearTimeout(timeoutId);
                obs.disconnect();
                resolve();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
}

function waitForElementToDisappear(selector, timeout) {
    return new Promise((resolve, reject) => {
        console.log(`✅ Waiting for element "${selector}" to disappear...`);
        if (!document.querySelector(selector)) return resolve();

        const timeoutId = setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout: Element "${selector}" did not disappear within ${timeout}ms.`));
        }, timeout);

        const observer = new MutationObserver((mutations, obs) => {
            if (!document.querySelector(selector)) {
                clearTimeout(timeoutId);
                obs.disconnect();
                resolve();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
}
