let mediaInfoInstance = null;
import mediaInfoFactory from '../lib/mediainfo.min.js';

console.log("✅ Hello from the Civitai Helper content script!");

let videoToUpload = null;
let imageToUpload = null;
let metadataModal = null;

let videoContainerElement = null;
let imageContainerElement = null;



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

const openDetailsButton = document.createElement('button');
openDetailsButton.textContent = 'Open Details';
openDetailsButton.style.display = 'none'; // Hidden by default
openDetailsButton.style.marginLeft = '15px';
openDetailsButton.style.padding = '5px 10px';
openDetailsButton.style.border = '1px solid #555';
openDetailsButton.style.borderRadius = '5px';
openDetailsButton.style.backgroundColor = '#2980b9';
openDetailsButton.style.color = 'white';
openDetailsButton.style.cursor = 'pointer';
openDetailsButton.addEventListener('click', showModal);
banner.appendChild(openDetailsButton);

const retryBannerButton = document.createElement('button');
retryBannerButton.textContent = 'Retry Upload';
retryBannerButton.style.display = 'none';
Object.assign(retryBannerButton.style, {
    marginLeft: '15px',
    padding: '5px 10px',
    border: '1px solid #555',
    borderRadius: '5px',
    backgroundColor: '#e67e22',
    color: 'white',
    cursor: 'pointer'
});
retryBannerButton.onclick = runUploadOrchestrator;
banner.appendChild(retryBannerButton);

const testFillButton = document.createElement('button');
testFillButton.textContent = 'Test Prompt Fill';
testFillButton.style.display = 'none';
Object.assign(testFillButton.style, {
    marginLeft: '15px',
    padding: '5px 10px',
    border: '1px solid #555',
    borderRadius: '5px',
    backgroundColor: '#16a085',
    color: 'white',
    cursor: 'pointer'
});
testFillButton.onclick = initiateVideoMetadataFill;
banner.appendChild(testFillButton);

// New elements for status and error handling
const statusSpan = document.createElement('span');
statusSpan.style.marginLeft = '20px';
banner.appendChild(statusSpan);

const retryButton = document.createElement('button');
retryButton.textContent = 'Delete Post & Reload';
retryButton.style.marginLeft = '15px'; retryButton.style.padding = '5px 10px'; retryButton.style.border = '1px solid #555'; retryButton.style.borderRadius = '5px'; retryButton.style.backgroundColor = '#c0392b'; retryButton.style.color = 'white'; retryButton.style.cursor = 'pointer';
retryButton.style.display = 'none';
banner.appendChild(retryButton);


async function populateModalWithData(data) {
    if (!data) return;

    // Helper to set value if element exists
    const setInputValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    };

    // --- Populate standard video fields ---
    setInputValue('ch-video-prompt', data.positive_prompt);
    setInputValue('ch-video-neg-prompt', data.negative_prompt);
    setInputValue('ch-video-guidance', data.cfg);
    setInputValue('ch-video-steps', data.steps);
    setInputValue('ch-video-sampler', data.sampler_name);
    setInputValue('ch-video-seed', data.seed);
    setInputValue('ch-base-model', data.resources?.base_model);

    // --- Populate the dynamic LoRA lists ---
    const recognizedContainer = document.getElementById('ch-recognized-loras');
    const unrecognizedContainer = document.getElementById('ch-unrecognized-loras');
    recognizedContainer.innerHTML = ''; // Clear previous entries
    unrecognizedContainer.innerHTML = ''; // Clear previous entries

    // 1. Get the user's saved mappings from storage
    const storage = await chrome.storage.local.get('loraMappings');
    const loraMappings = storage.loraMappings || {};

    // 2. Process each LoRA found in the video metadata
    if (data.resources?.loras) {
        for (const filename of data.resources.loras) {
            if (loraMappings[filename]) {
                // It's recognized! Create a row in the recognized container.
                const knownData = loraMappings[filename];
                createLoraRow(recognizedContainer, {
                    filename: filename,
                    title: knownData.title,
                    version: knownData.version
                });
            } else {
                // It's unrecognized. Create a row in the other container.
                createLoraRow(unrecognizedContainer, { filename: filename });
            }
        }
    }

    // 3. Hook up the 'Add Manual Resource' button
    document.getElementById('ch-add-resource-btn').onclick = () => {
        // Adds a new, blank row
        createLoraRow(unrecognizedContainer, { filename: '' });

        // Get the row we just added (it's always the last one)
        const newRow = unrecognizedContainer.lastElementChild;
        if (newRow) {
            const filenameInput = newRow.querySelector('.filename');
            // Make this specific input field editable and restyle it
            filenameInput.removeAttribute('readonly');
            filenameInput.style.backgroundColor = 'white';
            filenameInput.style.color = 'black';
        }
    };
}
function clearModalFields() {
    const idsToClear = [
        'ch-video-prompt', 'ch-video-neg-prompt', 'ch-video-guidance',
        'ch-video-steps', 'ch-video-sampler', 'ch-video-seed', 'ch-video-resources'
    ];
    idsToClear.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}


// --- METADATA MODAL CREATION ---
function createMetadataModal() {
    // --- Helper functions for creating UI elements ---
    const createInputRow = (label, inputElement) => {
        const row = document.createElement('div');
        row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.marginBottom = '10px';
        const labelEl = document.createElement('label');
        labelEl.textContent = label; labelEl.style.width = '150px'; labelEl.style.flexShrink = '0';
        row.appendChild(labelEl);
        row.appendChild(inputElement);
        return row;
    };
    const createTextInput = (id) => {
        const input = document.createElement('input');
        input.type = 'text'; input.id = id; input.style.width = '100%'; input.style.padding = '5px';
        return input;
    };
    const createNumberInput = (id) => {
        const input = createTextInput(id); input.type = 'number';
        return input;
    };
    const createTextarea = (id, rows = 2) => {
        const textarea = document.createElement('textarea');
        textarea.id = id; textarea.rows = rows; textarea.style.width = '100%'; textarea.style.padding = '5px';
        return textarea;
    };

    // --- Main Modal Structure ---
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
        width: '900px', maxHeight: '90vh', overflowY: 'auto', color: 'white'
    });
    modalOverlay.appendChild(modalContainer);

    // --- Video Section (Prompt, Seed, etc.) ---
    const videoSection = document.createElement('div');
    videoSection.innerHTML = '<h3 style="margin-top:0;">Video Generation Data</h3>';
    videoSection.appendChild(createInputRow('Prompt:', createTextarea('ch-video-prompt', 4)));
    videoSection.appendChild(createInputRow('Negative Prompt:', createTextarea('ch-video-neg-prompt', 4)));
    videoSection.appendChild(createInputRow('Guidance Scale:', createNumberInput('ch-video-guidance')));
    videoSection.appendChild(createInputRow('Steps:', createNumberInput('ch-video-steps')));
    videoSection.appendChild(createInputRow('Sampler:', createTextInput('ch-video-sampler')));
    videoSection.appendChild(createInputRow('Seed:', createNumberInput('ch-video-seed')));
    modalContainer.appendChild(videoSection);

    // --- NEW: Resources Section ---
    const resourcesSection = document.createElement('div');
    resourcesSection.innerHTML = `<h3 style="margin-top: 20px; border-top: 1px solid #555; padding-top: 15px;">Resources</h3>`;

    // Sub-section for the Base Model
    const baseModelSection = createInputRow('Base Model:', createTextInput('ch-base-model'));
    resourcesSection.appendChild(baseModelSection);

    // Container for Recognized LoRAs
    resourcesSection.innerHTML += '<h4 style="margin-bottom: 5px;">Recognized LoRAs</h4>';
    const recognizedLorasContainer = document.createElement('div');
    recognizedLorasContainer.id = 'ch-recognized-loras';
    resourcesSection.appendChild(recognizedLorasContainer);

    // Container for Unrecognized LoRAs
    resourcesSection.innerHTML += '<h4 style="margin-top: 15px; margin-bottom: 5px;">Unrecognized LoRAs</h4>';
    const unrecognizedLorasContainer = document.createElement('div');
    unrecognizedLorasContainer.id = 'ch-unrecognized-loras';
    resourcesSection.appendChild(unrecognizedLorasContainer);

    // Controls for adding new resources
    const addResourceButton = document.createElement('button');
    addResourceButton.id = 'ch-add-resource-btn';
    addResourceButton.textContent = 'Add Manual Resource';
    addResourceButton.style.marginTop = '10px';
    resourcesSection.appendChild(addResourceButton);
    modalContainer.appendChild(resourcesSection);
    addResourceButton.style.padding = '5px 10px';
    addResourceButton.style.border = '1px solid #777';
    addResourceButton.style.borderRadius = '4px';
    addResourceButton.style.backgroundColor = '#5f6a78';
    addResourceButton.style.color = 'white';
    addResourceButton.style.cursor = 'pointer';

    const imageSection = document.createElement('div');
    imageSection.id = 'ch-image-section';
    imageSection.style.display = 'block';
    imageSection.innerHTML = '<h3 style="margin-top: 20px;">Image Generation Data</h3>';
    imageSection.appendChild(createInputRow('Resources (;):', createTextInput('ch-image-resources')));
    imageSection.appendChild(createInputRow('Tools (;):', createTextInput('ch-image-tools')));
    imageSection.appendChild(createInputRow('Techniques (;):', createTextInput('ch-image-techniques')));
    modalContainer.appendChild(imageSection);


    // --- Actions & Settings Link ---
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.alignItems = 'center';
    footer.style.marginTop = '20px';
    footer.style.paddingTop = '15px';
    footer.style.borderTop = '1px solid #555';

    // This div will group the status and the button on the right side
    const rightFooter = document.createElement('div');
    rightFooter.style.display = 'flex';
    rightFooter.style.alignItems = 'center';

    const modalStatusSpan = document.createElement('span');
    modalStatusSpan.id = 'ch-modal-status';
    modalStatusSpan.style.marginRight = '20px';
    modalStatusSpan.style.color = '#ecf0f1';
    rightFooter.appendChild(modalStatusSpan);


    const postButton = document.createElement('button');
    postButton.id = 'ch-modal-post-btn';
    postButton.textContent = 'Save & Post Later';
    Object.assign(postButton.style, {
        padding: '10px 20px', fontSize: '16px', backgroundColor: '#27ae60',
        color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer'
    });
    const updatePostButtonStyle = () => {
        if (postButton.disabled) {
            postButton.style.backgroundColor = '#7f8c8d'; // Muted grey color
            postButton.style.cursor = 'not-allowed';
        } else {
            postButton.style.backgroundColor = '#27ae60'; // Original green color
            postButton.style.cursor = 'pointer';
        }
    };
    const buttonObserver = new MutationObserver(updatePostButtonStyle);
    buttonObserver.observe(postButton, { attributes: true, attributeFilter: ['disabled'] });

    // Call it once immediately to set the initial style
    updatePostButtonStyle();

    const settingsLink = document.createElement('a');
    settingsLink.textContent = 'Edit LoRA Mappings';
    settingsLink.href = '#'; // Make it a dummy link
    settingsLink.style.color = '#3498db';
    settingsLink.style.cursor = 'pointer';

    settingsLink.addEventListener('click', (event) => {
        event.preventDefault(); // Stop the link from navigating
        chrome.runtime.sendMessage({ action: "showOptions" });
    });

    footer.appendChild(settingsLink);
    footer.appendChild(rightFooter);
    footer.appendChild(postButton);
    modalContainer.appendChild(footer);

    const closeButton = document.createElement('button');
    closeButton.textContent = 'X';
    Object.assign(closeButton.style, {
        position: 'absolute', top: '10px', right: '10px', background: 'none',
        border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer'
    });
    closeButton.addEventListener('click', hideModal);
    modalContainer.style.position = 'relative';
    modalContainer.appendChild(closeButton);

    document.body.appendChild(modalOverlay);
    metadataModal = modalOverlay;

    // --- Event Listeners ---
    postButton.addEventListener('click', handlePostButtonClick);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) hideModal();
    });
}

/**
 * Creates and appends a single LoRA resource row to a given container.
 * @param {HTMLElement} container - The container to append the row to.
 * @param {object} loraData - The data for the LoRA.
 * @param {string} loraData.filename - The LoRA's filename.
 * @param {string} [loraData.title=''] - The Civitai title (if known).
 * @param {string} [loraData.version=''] - The Civitai version (if known).
 */
function createLoraRow(container, { filename, title = '', version = '' }) {
    const item = document.createElement('div');
    item.className = 'lora-item';
    item.style.display = 'grid';
    item.style.gridTemplateColumns = '1fr 1fr 1fr auto';
    item.style.gap = '10px';
    item.style.alignItems = 'center';
    item.style.marginBottom = '5px';

    item.innerHTML = `
        <input type="text" class="filename" value="${filename}" readonly style="background-color:#4a627a; color: #ccc;">
        <input type="text" class="title" value="${title}" placeholder="Civitai Title/Search Term">
        <input type="text" class="version" value="${version}" placeholder="Version ID">
        <button class="delete-btn" style="background-color:#c0392b; color:white; border:none; cursor:pointer;">X</button>
    `;

    item.querySelector('.delete-btn').addEventListener('click', () => item.remove());
    container.appendChild(item);
}


function showModal() {
    if (!metadataModal) createMetadataModal();
    metadataModal.style.display = 'flex';
    //const imageSection = document.getElementById('ch-image-section');
    //if (imageSection) {
    //    imageSection.style.display = imageToUpload ? 'block' : 'none';
    //}
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
 * Finds and clicks the "EDIT" button for the video prompt and verifies the modal opens.
 * This serves as a testbed for our form-filling logic.
 */
async function initiateVideoMetadataFill() {
    console.log("🚀 Starting prompt fill test...");

    if (!videoContainerElement) {
        statusSpan.textContent = "Error: Video container element not found. Please upload a video first.";
        console.error("Video container element not found. Please upload a video first.");
        return;
    }

    try {
        // --- Step 1: Find the "Prompt" header element within our specific container ---
        // This is robust because we are NOT searching the whole document.
        const h3Elements = videoContainerElement.querySelectorAll('h3');
        const promptHeader = Array.from(h3Elements).find(h => h.textContent.trim() === 'Prompt');

        if (!promptHeader) {
            statusSpan.textContent = "Error: 'Prompt' heading not found in video container.";
            throw new Error("Could not find the 'Prompt' heading element inside the video container.");
        }

        // --- Step 2: Find the "EDIT" button, which is a sibling of the header ---
        // We navigate to the header's parent, then find the button within that small scope.
        const parentDiv = promptHeader.parentElement;
        const editButton = parentDiv.querySelector('button');

        if (!editButton || !editButton.textContent.includes('EDIT')) {
            statusSpan.textContent = "Error: 'EDIT' button not found next to the prompt header.";
            throw new Error("Could not find the 'EDIT' button next to the prompt header.");
        }
        console.log("✅ Found 'EDIT' button:", editButton);

        // --- Step 3: Click the button and wait for the modal to appear ---
        console.log("Clicking 'EDIT' button...");
        editButton.click();

        // The modal is a global element, so we can use a simpler selector here.
        const modalContentSelector = 'section.mantine-Modal-content';
        const modal = await waitForElement(modalContentSelector, 5000); // 5s timeout
        console.log("✅ Successfully detected the prompt modal:", modal);

    } catch (error) {
        console.error("❌ Prompt fill test failed:", error);
        alert(`Prompt fill test failed: ${error.message}`);
    }
}

/**
 * Searches the DOM for the unique "Edit/Preview" tab bar and returns its main parent container.
 * This is the reliable anchor for finding newly uploaded content.
 * @returns {HTMLElement|null} The container element if found, otherwise null.
 */
function findUniqueEditTabsContainer() {
    // 1. Find all potential tab lists on the page.
    const allTabLists = document.querySelectorAll('div.mantine-Tabs-list');

    for (const list of allTabLists) {
        // 2. For each list, check if it has the specific buttons we need.
        const buttons = list.querySelectorAll('button.mantine-Tabs-tab');
        const buttonLabels = Array.from(buttons).map(btn => btn.textContent.trim());

        // 3. Our unique anchor has exactly an "Edit" and a "Preview" button.
        if (buttonLabels.includes('Edit') && buttonLabels.includes('Preview')) {
            // 4. If we found it, navigate up the DOM to the target container you identified.
            // .mantine-Tabs-list -> .mantine-Tabs-root -> the container we want
            const tabsRoot = list.closest('.mantine-Tabs-root');
            if (tabsRoot) {
                // This selector is for the parent div that contains the form, dropzone, and tabs section.
                const mainContainer = tabsRoot.closest('.flex.min-w-0.flex-1.flex-col.gap-3');
                if (mainContainer) {
                    // We found our uniquely identifiable container!
                    return mainContainer;
                }
            }
        }
    }

    // If we loop through everything and find nothing, return null.
    return null;
}

/**
 * Waits for an element to appear, but only after verifying it's inside the correct,
 * uniquely identified container marked by the "Edit/Preview" tabs.
 * This replaces the simple waitForElement for upload success verification.
 * @param {string} selector The selector for the element to find (e.g., 'video').
 * @param {number} timeout The timeout in milliseconds.
 * @returns {Promise<HTMLElement>} A promise that resolves with the found element.
 */
function waitForVerifiedElement(selector, timeout) {
    return new Promise((resolve, reject) => {
        const check = () => {
            const container = findUniqueEditTabsContainer();
            if (container) {
                const element = container.querySelector(selector);
                if (element) {
                    return { container, element };
                }
            }
            return null; // Not found yet
        };

        // If the element already exists in the right place, resolve immediately.
        const initialFind = check();
        if (initialFind) {
            return resolve(initialFind);
        }

        const timeoutId = setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout: Verified element "${selector}" did not appear within ${timeout}ms.`));
        }, timeout);

        const observer = new MutationObserver(() => {
            const foundElement = check();
            if (foundElement) {
                clearTimeout(timeoutId);
                observer.disconnect();
                resolve(foundElement);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
}

function readVideoMetadata(file) {
    return new Promise((resolve, reject) => {
        const sandboxIframe = document.createElement('iframe');
        sandboxIframe.src = chrome.runtime.getURL('scripts/sandbox.html');
        sandboxIframe.style.display = 'none';
        document.body.appendChild(sandboxIframe);

        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Metadata reading timed out."));
        }, 15000);

        const messageListener = (event) => {
            if (event.source !== sandboxIframe.contentWindow) return;

            if (event.data.type === 'metadataResult') {
                const extractedData = event.data.data;
                cleanup();

                if (!extractedData || Object.keys(extractedData).length === 0) {
                    console.log("Sandbox returned no extracted workflow data.");
                    return resolve(null);
                }

                console.log("✅ SUCCESS via sandbox:", extractedData);
                resolve(extractedData);
            } else if (event.data.type === 'metadataError') {
                console.log("Sandbox reported an error:", event.data.error);
                cleanup();
                reject(new Error(event.data.error));
            }
        };

        const cleanup = () => {
            console.log("Cleaning up sandbox iframe and listeners...");
            clearTimeout(timeout);
            window.removeEventListener('message', messageListener);
            document.body.removeChild(sandboxIframe);
        };

        console.log("Sending file to sandbox for processing...");
        window.addEventListener('message', messageListener);

        sandboxIframe.onload = () => {
            console.log("Sandbox iframe loaded, sending file...");
            const wasmUrl = chrome.runtime.getURL('lib/MediaInfoModule.wasm');
            sandboxIframe.contentWindow.postMessage({ file: file, wasmUrl: wasmUrl }, '*');
        };
    });
}


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

videoInput.addEventListener('change', async () => {
    videoToUpload = videoInput.files.length > 0 ? videoInput.files[0] : null;
    checkUploadability();

    if (!metadataModal) createMetadataModal();

    clearModalFields();

    if (videoToUpload) {
        try {
            // Attempt to read metadata and pre-fill the form
            const metadata = await readVideoMetadata(videoToUpload);
            if (metadata) {
                populateModalWithData(metadata);
                console.log("✅ Modal fields pre-filled from video metadata.");
            }
        } catch (error) {
            console.error("Failed to read or process video metadata:", error);
        }
    }
});

imageInput.addEventListener('change', () => {
    imageToUpload = imageInput.files.length > 0 ? imageInput.files[0] : null;
    checkUploadability();

    if (!metadataModal) createMetadataModal();
    //const imageSection = document.getElementById('ch-image-section');
    //if (imageSection) {
    //    imageSection.style.display = imageToUpload ? 'block' : 'none';
    //}    
});

uploadButton.addEventListener('click', runUploadOrchestrator);


// --- The Orchestrator ---
// Manages the overall upload process for video and optional image
// by coordinating the lifecycle manager for each file.
// Handles UI state transitions and error reporting.
async function runUploadOrchestrator() {
    if (!videoToUpload) return;

    uploadButton.style.display = 'none';
    openDetailsButton.style.display = 'inline-block';
    retryBannerButton.style.display = 'none';
    document.getElementById('ch-modal-post-btn').disabled = true;
    showModal();

    setBannerToWorkingState();
    uploadButton.disabled = true; // Prevent double clicks

    try {
        const dryProgressSelector = 'div.w-full:has(.mantine-Dropzone-root) + div.mantine-Progress-root';
        // --- VIDEO LIFECYCLE ---
        const videoResult = await manageUploadLifecycle({
            file: videoToUpload,
            name: 'Video',
            progressSelector: dryProgressSelector,
            successSelector: 'video[class*="EdgeMedia_responsive"]'
        });
        videoContainerElement = videoResult.container;
        console.log("✅ Video container element captured directly:", videoContainerElement);

        // --- IMAGE LIFECYCLE (only if an image is provided) ---
        if (imageToUpload) {
            const imageResult = await manageUploadLifecycle({
                file: imageToUpload,
                name: 'Image',
                progressSelector: dryProgressSelector,
                successSelector: 'img[class*="EdgeImage_image"]'
            });
            imageContainerElement = imageResult.container;
            console.log("✅ Image container element captured directly:", imageContainerElement);
        }

        statusSpan.style.color = 'white'; // Reset color on success
        statusSpan.textContent = '✅ All uploads complete! You can now fill out the form.';
        document.getElementById('ch-modal-post-btn').disabled = false;
        testFillButton.style.display = 'inline-block';

    } catch (error) {
        console.error('Orchestrator failed:', error);
        openDetailsButton.style.display = 'none';
        retryBannerButton.style.display = 'inline-block';
        setBannerToErrorState(error.message);
    } finally {
        // Re-enable the button once the process is truly finished or failed
        uploadButton.disabled = false;
    }
}

// --- The Core State Machine for a single upload ---

async function manageUploadLifecycle(config) {
    const MAX_RETRIES = 3;
    const modalStatusSpan = document.getElementById('ch-modal-status');

    const updateStatus = (message) => {
        statusSpan.textContent = message;
        if (modalStatusSpan) {
            modalStatusSpan.textContent = message;
        }
    };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // 1. ATTEMPT UPLOAD
            updateStatus(`⏳ Uploading ${config.name}... (Attempt ${attempt}/${MAX_RETRIES})`);
            triggerUpload([config.file]);

            // 2. MONITOR PROGRESS (Wait for progress bar to appear, then disappear)
            await waitForElement(config.progressSelector, 15000); // 15s timeout to appear
            updateStatus(`⏳ Processing ${config.name}...`);
            await waitForElementToDisappear(config.progressSelector, 120000); // 2min timeout to disappear

            // 3. VERIFY OUTCOME (Wait for the final element to appear)
            updateStatus(`⏳ Verifying ${config.name}...`);
            const verificationResult = await waitForVerifiedElement(config.successSelector, 60000);

            // If all awaits complete without throwing an error, the upload was a success!
            console.log(`✅ ${config.name} upload successful on attempt ${attempt}.`);
            return verificationResult;

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
