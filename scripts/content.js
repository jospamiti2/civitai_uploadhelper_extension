let mediaInfoInstance = null;
import mediaInfoFactory from '../lib/mediainfo.min.js';

console.log("✅ Hello from the Civitai Helper content script!");

let videoToUpload = null;
let imageToUpload = null;
let metadataModal = null;

let videoContainerElement = null;
let imageContainerElement = null;

const SAMPLER_MAP = {
    // ComfyUI Name -> Civitai Name

    // --- Euler ---
    'euler': 'Euler',
    'euler_ancestral': 'Euler a',
    'euler_cfg_pp': 'Euler',
    'euler_ancestral_cfg_pp': 'Euler a',

    // --- Heun ---
    'heun': 'Heun',
    // 'heunpp2' has no direct Civitai equivalent

    // --- DPM (Diffusion Probabilistic Models) ---
    'dpm_2': 'DPM2',
    'dpm_2_ancestral': 'DPM2 a',
    'lms': 'LMS',
    'dpm_fast': 'DPM fast',
    'dpm_adaptive': 'DPM adaptive',

    // --- DPM++ ---
    'dpmpp_2s_ancestral': 'DPM++ 2S a',
    'dpmpp_sde': 'DPM++ SDE',
    'dpmpp_2m': 'DPM++ 2M',
    'dpmpp_2m_sde': 'DPM++ 2M SDE',
    'dpmpp_3m_sde': 'DPM++ 3M SDE',
    // GPU and other variants mapped to their base samplers
    'dpmpp_sde_gpu': 'DPM++ SDE',
    'dpmpp_2m_sde_gpu': 'DPM++ 2M SDE',
    'dpmpp_3m_sde_gpu': 'DPM++ 3M SDE',
    'dpmpp_2s_ancestral_cfg_pp': 'DPM++ 2S a',
    'dpmpp_2m_cfg_pp': 'DPM++ 2M',

    // --- Karras Variants (often available on Civitai) ---
    'lms_karras': 'LMS Karras',
    'dpm_2_karras': 'DPM2 Karras',
    'dpm_2_ancestral_karras': 'DPM2 a Karras',
    'dpmpp_2s_ancestral_karras': 'DPM++ 2S a Karras',
    'dpmpp_2m_karras': 'DPM++ 2M Karras',
    'dpmpp_sde_karras': 'DPM++ SDE Karras',
    'dpmpp_2m_sde_karras': 'DPM++ 2M SDE Karras',
    'dpmpp_3m_sde_karras': 'DPM++ 3M SDE Karras',

    // --- Other Common Samplers ---
    'ddim': 'DDIM',
    'uni_pc': 'UniPC',
    'uni_pc_bh2': 'UniPC', // map variant to base
    'lcm': 'LCM',

    // NOTE: Many custom/experimental samplers from the list have been intentionally omitted
    // as they have no equivalent on Civitai (e.g., 'ipndm', 'deis', 'res_multistep', etc.)
    // The script will safely skip these if they are encountered.
};

const ALL_CIVITAI_TOOLS = [
    // Image Tools
    "Civitai", "Rubbrband", "Purplesmart", "ComfyUI", "A1111", "Adobe Firefly", "AniFusion", "Artflow", "Canva", "Craiyon", "Cuebric", "DALL-E 3", "Davant", "DaVinci", "Deep Dream Generator", "Diffus", "Draw Things", "Dream", "DreamStudio", "FaceFusion", "Flush", "Flux", "Fooocus", "Forge", "Gemini", "Getty Images Generative AI", "Google ImageFX", "GPT Image 1", "Hugging Face", "Ideogram", "Invoke", "Kittl AI", "Kolors", "KREA", "Krita", "Lasco.ai ", "Maze", "Meta AI", "Midjourney", "ModelsLab", "Nijijourney", "OpenArt", "Photopea", "PicSo", "PixaBay", "Recraft", "Rendermind", "Salt", "Scenario", "SD.Next", "Shutterstock AI Image Generation", "SwarmUI", "Touch Designer", "Wowzer", "Yodayo",
    // Video Tools
    "Kling", "Higgsfield", "MiniMax / Hailuo", "Hedra", "neural frames", "Tripo 3D", "LTX Studio", "Haiper", "Mochi", "CogVideoX", "SAGA", "Domo AI", "Morph Studio", "Banodoco", "AnimateDiff", "DeepMake", "Deforum Studio", "EBSynth", "Fable", "FramePack", "Genmo", "Gooey AI", "HunYuan", "iKHOR Labs", "Invideo", "Kaiber", "LensGo", "Lightricks LTXV", "Luma Dream Machine", "Luma Genie", "Magic Animate", "Nim", "Parseq", "Pika", "Pixverse", "Prism", "Runway", "SadTalker", "Showrunner AI", "Silmu", "Sora", "Stable Artisan", "Veo", "VidProc", "Vidu", "Vimeo", "Wan Video", "Warp Video",
    // Other Categories
    "Lambda Labs", "Nebius", "RunPod", "ThinkDiffusion", "Salad", "fal", "Brev", "RunDiffusion", "MAGNIFIC", "Topaz Photo AI", "Topaz Video AI", "Adobe AfterEffects", "Adobe Photoshop", "Adobe Premiere", "CapCut", "ChatGPT", "DaVinci Resolve", "Final Cut Pro", "Flimora ", "GIMP", "Hitfilm", "Magix Video", "Picsart", "Veed.io", "VSDC", "Wondershare ", "Blender", "Unity", "Unreal Engine", "Grok", "Live Portrait", "MimicMotion"
];



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
banner.style.boxShadow = '0 -2px 5px rgba(0,0,0,0.3)';
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

// const testFillButton = document.createElement('button');
// testFillButton.textContent = 'Test Prompt Fill';
// testFillButton.style.display = 'none';
// Object.assign(testFillButton.style, {
//     marginLeft: '15px',
//     padding: '5px 10px',
//     border: '1px solid #555',
//     borderRadius: '5px',
//     backgroundColor: '#16a085',
//     color: 'white',
//     cursor: 'pointer'
// });
// testFillButton.onclick = initiateVideoMetadataFill;
// banner.appendChild(testFillButton);

// const testResourceButton = document.createElement('button');
// testResourceButton.textContent = 'Test Resource Add';
// testResourceButton.style.display = 'none'; // Show on upload success
// Object.assign(testResourceButton.style, {
//     marginLeft: '15px',
//     padding: '5px 10px',
//     border: '1px solid #555',
//     borderRadius: '5px',
//     backgroundColor: '#8e44ad', 
//     color: 'white',
//     cursor: 'pointer'
// });
// testResourceButton.onclick = testAddResources; 
// banner.appendChild(testResourceButton);

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

    // --- Pre-fill and Display Video Tools ---
    const selectedToolsContainer = document.getElementById('ch-selected-video-tools');
    const allToolsContainer = document.getElementById('ch-all-video-tools');
    
    // Ensure containers exist before proceeding
    if (!selectedToolsContainer || !allToolsContainer) {
        console.error("Tool containers not found in the modal.");
        return;
    }
    
    selectedToolsContainer.innerHTML = ''; // Clear any previous summary

    // Step 1: Determine the set of pre-selected tools
    const preselectedTools = new Set();
    if (data) {
        preselectedTools.add("ComfyUI");
    }
    if (data && data.resources?.base_model && data.resources.base_model.toLowerCase().includes('wan')) {
        preselectedTools.add("Wan Video");
    }
    console.log("Pre-selected tools:", preselectedTools);

    // Step 2: Update the main list of all checkboxes
    const allCheckboxes = allToolsContainer.querySelectorAll('input[type="checkbox"]');
    allCheckboxes.forEach(cb => {
        // Check the box if its name is in our pre-selected set
        cb.checked = preselectedTools.has(cb.dataset.toolName);
    });

    // Step 3: Create and display the summary view of only the selected tools
    preselectedTools.forEach(toolName => {
        const checkboxElement = createToolCheckbox(toolName, 'video-summary'); // Use a different prefix for summary
        checkboxElement.querySelector('input').checked = true;
        // When a summary checkbox is clicked, it un-checks the master list and removes itself
        checkboxElement.addEventListener('change', (e) => {
            const masterCheckbox = allToolsContainer.querySelector(`input[data-tool-name="${toolName}"]`);
            if (masterCheckbox) {
                masterCheckbox.checked = e.target.checked;
            }
            e.currentTarget.remove(); // Remove from the summary view
        });
        selectedToolsContainer.appendChild(checkboxElement);
    });

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
        backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'none', justifyContent: 'center',
        alignItems: 'center', zIndex: '10000'
    });

    const modalContainer = document.createElement('div');
    Object.assign(modalContainer.style, {
        backgroundColor: '#34495e88', padding: '20px', borderRadius: '8px',
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
    addResourceButton.textContent = 'Add more loras';
    addResourceButton.style.marginTop = '10px';
    resourcesSection.appendChild(addResourceButton);
    modalContainer.appendChild(resourcesSection);
    addResourceButton.style.padding = '5px 10px';
    addResourceButton.style.border = '1px solid #777';
    addResourceButton.style.borderRadius = '4px';
    addResourceButton.style.backgroundColor = '#5f6a78';
    addResourceButton.style.color = 'white';
    addResourceButton.style.cursor = 'pointer';


    // --- Tools Section ---
    const toolsSection = document.createElement('div');
    toolsSection.id = 'ch-video-tools-section'; 
    toolsSection.innerHTML = '<h3 style="margin-top: 20px; border-top: 1px solid #555; padding-top: 15px;">Video Tools</h3>';

    // Container for the pre-selected tools summary
    const selectedToolsContainer = document.createElement('div');
    selectedToolsContainer.id = 'ch-selected-video-tools';
    Object.assign(selectedToolsContainer.style, {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        marginBottom: '10px'
    });
    toolsSection.appendChild(selectedToolsContainer);

    // "Show All Tools" button
    const showAllToolsBtn = document.createElement('button');
    showAllToolsBtn.textContent = 'Show All Tools ▼';
    Object.assign(showAllToolsBtn.style, {
        padding: '5px 10px',
        cursor: 'pointer',
        border: '1px solid #777',
        borderRadius: '4px',
        backgroundColor: '#5f6a78',
        color: 'white'
    });
    toolsSection.appendChild(showAllToolsBtn);

    // Container for the comprehensive list of all tools (initially hidden)
    const allToolsContainer = document.createElement('div');
    allToolsContainer.id = 'ch-all-video-tools'; 
    Object.assign(allToolsContainer.style, {
        display: 'none', 
        marginTop: '15px',
        flexWrap: 'wrap',
        gap: '10px 15px',
        maxHeight: '200px',
        overflowY: 'auto',
        border: '1px solid #555',
        padding: '10px',
        borderRadius: '5px'
    });
    
    // Populate the comprehensive list with checkboxes
    ALL_CIVITAI_TOOLS.forEach(toolName => {
        allToolsContainer.appendChild(createToolCheckbox(toolName, 'video'));
    });
    toolsSection.appendChild(allToolsContainer);

    // Event listener to toggle the full list
    showAllToolsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = allToolsContainer.style.display === 'none';
        allToolsContainer.style.display = isHidden ? 'flex' : 'none';
        showAllToolsBtn.textContent = isHidden ? 'Hide All Tools ▲' : 'Show All Tools ▼';
    });

    modalContainer.appendChild(toolsSection);

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
    postButton.textContent = 'Start Automation';
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
    const handleKeyDown = (event) => {
        if (metadataModal.style.display === 'flex' && event.key === 'Escape') {
            hideModal();
        }
    };
    document.addEventListener('keydown', handleKeyDown);

    postButton.addEventListener('click', handleStartButtonClick);
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


async function handleStartButtonClick() {
    const postButton = document.getElementById('ch-modal-post-btn');
    const modalStatus = document.getElementById('ch-modal-status');
    postButton.disabled = true;

    try {
        hideModal();
        // --- Part 1: Fill the metadata (prompts, sampler, etc.) ---
        updateStatus("⏳ Filling metadata...");
        await initiateVideoMetadataFill();
        console.log("✅ Metadata filled.");

        // --- Part 2: Get the LoRA list and add them ---
        const loras = getLoraDataFromModal();
        if (loras.length > 0) {
            updateStatus(`Adding ${loras.length} resources...`);
            await addResourcesFromList(loras);
            updateStatus("✅ All resources added.");
        } else {
            console.log("No LoRAs to add.");
        }

        // --- Part 3: Add Tools ---
        const videoTools = getVideoToolDataFromModal();
        if (videoTools.length > 0) {
            updateStatus(`⏳ Adding ${videoTools.length} video tools...`);
            let toolsSuccess = false;
            const MAX_TOOL_ATTEMPTS = 3;
            for (let attempt = 1; attempt <= MAX_TOOL_ATTEMPTS; attempt++) {
                try {
                    await addToolsFromList(videoTools); // Perform one full attempt
                    // Verify ALL tools were added
                    await Promise.all(videoTools.map(tool => waitForToolAdded(tool, 5000)));
                    toolsSuccess = true;
                    console.log("✅ All video tools successfully added and verified.");
                    break; // Success!
                } catch (error) {
                    console.error(`❌ Attempt ${attempt} to add tools failed:`, error.message);
                    if (attempt < MAX_TOOL_ATTEMPTS) console.log("TRYING TOOLS AGAIN!");
                }
            }
            if (!toolsSuccess) {
                updateStatus(`❌ Failed to add all tools after ${MAX_TOOL_ATTEMPTS} attempts. Continuing.`, true);
                await new Promise(r => setTimeout(r, 2000));
            }
        } else {
            console.log("No video tools to add.");
        }     

        updateStatus("✅ All tasks complete!");
        updateStatus("Angry Helper has finished all automated tasks!");
        // We can hide our own modal now, or leave it.
        // hideModal();

    } catch (error) {
        updateStatus(`❌ Error: ${error.message}`, true);
        alert(`An error occurred: ${error.message}`);
    } finally {
        postButton.disabled = false;
    }
}


























// --- LOGIC ---


/**
 * Waits and polls the page to verify that a resource has been successfully added.
 * @param {string} resourceName The name of the resource to look for.
 * @param {number} timeout The total time to wait in milliseconds.
 * @returns {Promise<boolean>} A promise that resolves to true if found, or rejects if it times out.
 */
function waitForResourceAdded(resourceName, timeout) {
    return new Promise((resolve, reject) => {
        const checkInterval = 250;
        const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            reject(new Error(`Verification Timeout: Resource "${resourceName}" did not appear on the page within ${timeout}ms.`));
        }, timeout);

        const intervalId = setInterval(() => {
            if (!videoContainerElement) return;
            const resourceHeader = Array.from(videoContainerElement.querySelectorAll('h3')).find(h => h.textContent.trim() === 'Resources');
            if (!resourceHeader) return;

            const container = resourceHeader.parentElement.parentElement.parentElement;
            if (!container) return;

            const resourceLinks = container.querySelectorAll('a');
            const found = Array.from(resourceLinks).some(link => link.innerText.trim().startsWith(resourceName));

            if (found) {
                clearInterval(intervalId);
                clearTimeout(timeoutId);
                resolve(true);
            }
        }, checkInterval);
    });
}

/**
 * Waits and polls the page to verify that a tool has been successfully added.
 * @param {string} toolName The name of the tool to look for.
 * @param {number} timeout The total time to wait in milliseconds.
 * @returns {Promise<boolean>} A promise that resolves to true if found, or rejects if it times out.
 */
function waitForToolAdded(toolName, timeout) {
    return new Promise((resolve, reject) => {
        const checkInterval = 250;
        const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            reject(new Error(`Verification Timeout: Tool "${toolName}" did not appear on the page within ${timeout}ms.`));
        }, timeout);

        const intervalId = setInterval(() => {
            if (!videoContainerElement) return;
            const toolHeader = Array.from(videoContainerElement.querySelectorAll('h3')).find(h => h.textContent.trim() === 'Tools');
            if (!toolHeader) return;

            const toolsSectionContainer = toolHeader.parentElement.parentElement.parentElement;
            if (!toolsSectionContainer) return;

            const addedToolSpans = toolsSectionContainer.querySelectorAll('ul li span');
            const isPresent = Array.from(addedToolSpans).some(span => span.textContent.trim() === toolName);

            if (isPresent) {
                clearInterval(intervalId);
                clearTimeout(timeoutId);
                resolve(true);
            }
        }, checkInterval);
    });
}

/**
 * Simulates a realistic mouse click on an element by dispatching
 * mousedown, mouseup, and click events.
 * @param {HTMLElement} element The element to click.
 */
function simulateMouseClick(element) {
    if (!element) {
        console.warn("simulateMouseClick called with a null element.");
        return;
    }
    const mouseEventInit = {
        bubbles: true,
        cancelable: true,
        view: window
    };
    element.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
    element.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
    element.dispatchEvent(new MouseEvent('click', mouseEventInit));
}

/**
 * Reads the final list of selected video tools from the checkbox UI.
 * @returns {string[]} An array of selected tool names.
 */
function getVideoToolDataFromModal() {
    const tools = [];
    // The master list of all checkboxes is the single source of truth.
    const container = document.getElementById('ch-all-video-tools');
    
    if (container) {
        // Find all checkboxes that are currently checked.
        const checkedBoxes = container.querySelectorAll('input[type="checkbox"]:checked');
        
        // Extract the tool name from the 'data-tool-name' attribute of each checked box.
        checkedBoxes.forEach(cb => {
            tools.push(cb.dataset.toolName);
        });
    } else {
        console.error("Could not find the video tools container ('ch-all-video-tools') to read data from.");
    }
    
    console.log("Gathered selected video tools for processing:", tools);
    return tools;
}

/**
 * Creates a styled checkbox element for a tool.
 * @param {string} toolName The name of the tool.
 * @param {string} prefix A prefix for the ID to ensure uniqueness (e.g., 'video' or 'image').
 * @returns {HTMLElement} The container div for the checkbox and its label.
 */
function createToolCheckbox(toolName, prefix) {
    const container = document.createElement('div');
    // Sanitize the tool name to create a valid ID
    const safeIdName = toolName.replace(/[^a-zA-Z0-9]/g, '');
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `ch-tool-${prefix}-${safeIdName}`;
    checkbox.value = toolName;
    checkbox.dataset.toolName = toolName; // Store original name for easy access

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = toolName;
    Object.assign(label.style, {
        marginLeft: '5px',
        cursor: 'pointer'
    });

    container.appendChild(checkbox);
    container.appendChild(label);
    return container;
}

/**
 * Main orchestrator for adding a list of tools, with the "N-click" bug workaround.
 * @param {string[]} toolList A list of tool names to add.
 */
async function addToolsFromList(toolList) {
    if (!videoContainerElement) throw new Error("Video container element not found.");
    if (toolList.length === 0) return;
    
    // 1. Find the "TOOL" button specifically in the "Tools" section. No variables.
    console.log("Finding 'TOOL' button...");
    const toolHeader = Array.from(videoContainerElement.querySelectorAll('h3')).find(h => h.textContent.trim() === 'Tools');
    if (!toolHeader) throw new Error("Could not find the 'Tools' heading.");

    const addButtonContainer = toolHeader.parentElement.nextElementSibling;
    if (!addButtonContainer) throw new Error("Could not find the container for the 'TOOL' button.");
    const addToolButton = Array.from(addButtonContainer.querySelectorAll('button')).find(b => b.innerText.trim() === 'TOOL');
    if (!addToolButton) throw new Error("Could not find the 'TOOL' button.");
    
    addToolButton.click();
    console.log("✅ Clicked 'TOOL' button.");

    // 2. Wait for the popover to appear. It's in a portal.
    const popoverSelector = 'div[id^="headlessui-popover-panel-"]';
    const popover = await waitForInteractiveElement(popoverSelector, 5000);
    console.log("✅ Tools popover is visible.");

    // 3. Loop through the tools and click each one
    let selectedCount = 0;

    // 3. Loop through the tools and click the checkbox for each one.
    for (const toolName of toolList) {
        console.log(`Searching for tool: "${toolName}"`);
        // We will poll inside the loop to wait for the specific option to be ready.
        let targetOption = null;
        let attempts = 20; // Try for 2 seconds
        while (attempts > 0) {
            const allOptions = popover.querySelectorAll('div[role="option"]');
            targetOption = Array.from(allOptions).find(opt => opt.querySelector('span')?.textContent.trim() === toolName);
            if (targetOption) break; // Found it!
            await new Promise(r => setTimeout(r, 100));
            attempts--;
        }

        if (targetOption) {
            // Find the specific checkbox inside the row we found.
            const checkboxInput = targetOption.querySelector('input[type="checkbox"]');
            
            if (checkboxInput) {
                console.log(`Found "${toolName}". Clicking internal checkbox.`);
                simulateMouseClick(checkboxInput); 
                selectedCount++; 
                await new Promise(r => setTimeout(r, 200));
            } else {
                 console.warn(`Internal error: Checkbox input not found for ${toolName}.`);
            }
        } else {
            console.warn(`Could not find tool "${toolName}" in the list. Skipping.`);
        }
    }

    if (selectedCount === 0) {
        console.log("No tools were selected, closing popover.");
        addToolButton.click(); // Toggle to close
        await waitForElementToDisappear(popoverSelector, 3000);
        return;
    }

    // 4. Find the "Add" button and click it N times
    const saveButton = Array.from(popover.querySelectorAll('button')).find(b => b.textContent.trim() === 'Add');
    if (!saveButton) throw new Error("Could not find the 'Add' button in the tools popover.");

    console.log(`😡 Found the 'Add' button. Clicking it ${selectedCount} times to beat the bug...`);
    for (let i = 0; i < selectedCount; i++) {
        saveButton.click();
        await new Promise(r => setTimeout(r, 100)); // A tiny pause between rage-clicks
    }

    // 5. Wait for the popover to disappear
    await waitForElementToDisappear(popoverSelector, 3000);
    console.log("✅ Tools popover has been submitted and closed.");

    // 6. Verification
    console.log("Verifying that tools were added...");
    await new Promise(r => setTimeout(r, 500)); 

    // This is the container for the whole "Tools" section
    const toolsSectionContainer = toolHeader.parentElement.parentElement.parentElement;

    for (const toolName of toolList) {
        // Find all the spans inside list items within the Tools section
        const addedToolSpans = toolsSectionContainer.querySelectorAll('ul > li span');
        const isPresent = Array.from(addedToolSpans).some(span => span.textContent.trim() === toolName);

        if (!isPresent) {
            throw new Error(`VERIFICATION FAILED: Tool "${toolName}" was not found after adding!`);
        } else {
            console.log(`✅ VERIFIED: "${toolName}" is present.`);
        }
    }
}

/**
 * Updates the status message in both the bottom banner and the modal simultaneously.
 * @param {string} message The message to display.
 * @param {boolean} isError If true, displays the message in an error color.
 */
function updateStatus(message, isError = false) {
    const bannerStatus = statusSpan; // The global one in the banner
    const modalStatus = document.getElementById('ch-modal-status');

    if (bannerStatus) {
        bannerStatus.textContent = message;
        bannerStatus.style.color = isError ? '#ffcccc' : 'white';
    }
    if (modalStatus) {
        modalStatus.textContent = message;
        modalStatus.style.color = isError ? '#ffcccc' : '#ecf0f1';
    }
    console.log(`STATUS: ${message}`);
}

// --- NEW ---
/**
 * Reads all LoRA data (recognized and unrecognized) from our extension's modal.
 * @returns {Array<{title: string, version: string}>}
 */
function getLoraDataFromModal() {
    const loras = [];
    const rows = document.querySelectorAll('#ch-recognized-loras .lora-item, #ch-unrecognized-loras .lora-item');
    
    rows.forEach(row => {
        const titleInput = row.querySelector('.title');
        const versionInput = row.querySelector('.version');
        
        // Only add loras that have a title to search for
        if (titleInput && versionInput && titleInput.value.trim() !== '') {
            loras.push({
                title: titleInput.value.trim(),
                version: versionInput.value.trim()
            });
        }
    });
    console.log("Found LoRAs to add from modal:", loras);
    return loras;
}

/**
 * Checks if a resource with a specific name has been successfully added to the page.
 * @param {string} resourceName The name of the resource to look for.
 * @returns {boolean} True if the resource is found, false otherwise.
 */
function verifyResourceAdded(resourceName) {
    if (!videoContainerElement) {
        console.warn("Cannot verify resource, videoContainerElement is not set.");
        return false;
    }
    // Find the 'Resources' heading to start our search
    const resourceHeader = Array.from(videoContainerElement.querySelectorAll('h3')).find(h => h.textContent.trim() === 'Resources');
    if (!resourceHeader) return false;

    // Find all the links for added resources
    const resourceLinks = resourceHeader.parentElement.parentElement.parentElement.querySelectorAll('a');
    
    // Check if any of them contain our resource name
    const found = Array.from(resourceLinks).some(link => link.innerText.trim().startsWith(resourceName));
    
    return found;
}


/**
 * Waits for a modal containing specific text to become hidden.
 * @param {string} identifyingText The text that must be inside the modal.
 * @param {number} timeout Timeout in milliseconds.
 * @returns {Promise<void>}
 */
function waitForModalToDisappearByText(identifyingText, timeout) {
    return new Promise((resolve, reject) => {
        const checkInterval = 100;
        const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            reject(new Error(`Timeout: Modal with text "${identifyingText}" did not disappear within ${timeout}ms.`));
        }, timeout);

        const intervalId = setInterval(() => {
            const modals = document.querySelectorAll('section.mantine-Modal-content');
            const targetModal = Array.from(modals).find(m => m.innerText.includes(identifyingText));

            // If the modal doesn't exist OR it's hidden (display: none or opacity: 0), we're done.
            if (!targetModal || window.getComputedStyle(targetModal).display === 'none' || window.getComputedStyle(targetModal).opacity === '0') {
                clearInterval(intervalId);
                clearTimeout(timeoutId);
                resolve();
            }
        }, checkInterval);
    });
}


/**
 * Waits for a visible modal that contains a specific piece of text.
 * @param {string} identifyingText The text to find inside the modal.
 * @param {number} timeout The timeout in milliseconds.
 * @returns {Promise<HTMLElement>} A promise resolving with the correct modal element.
 */
function waitForModalWithText(identifyingText, timeout) {
    return new Promise((resolve, reject) => {
        const checkInterval = 100; // Check every 100ms
        const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            reject(new Error(`Timeout: Modal with text "${identifyingText}" did not appear within ${timeout}ms.`));
        }, timeout);

        const intervalId = setInterval(() => {
            // Get all visible modals on the page
            const visibleModals = Array.from(document.querySelectorAll('section.mantine-Modal-content'))
                .filter(m => window.getComputedStyle(m).opacity === '1');

            // Find the one that contains our specific text
            for (const modal of visibleModals) {
                if (modal.innerText.includes(identifyingText)) {
                    clearInterval(intervalId);
                    clearTimeout(timeoutId);
                    resolve(modal);
                    return;
                }
            }
        }, checkInterval);
    });
}

/**
 * The new master orchestrator for adding a list of resources.
 * Contains the "Angry Helper" retry logic.
 * @param {Array<{title: string, version: string}>} loraList
 */
async function addResourcesFromList(loraList) {
    console.log(`😡 Angry Helper starting to add ${loraList.length} resources...`);

    for (const lora of loraList) {
        let success = false;
        const MAX_ATTEMPTS = 3;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            // Check if it's already on the page before we start
            const resourceLinks = videoContainerElement.querySelectorAll('a');
            const alreadyExists = Array.from(resourceLinks).some(link => link.innerText.includes(lora.title));
            if (alreadyExists) {
                console.log(`Resource "${lora.title}" is already present. Skipping.`);
                success = true;
                break;
            }

            console.log(`Attempt ${attempt}/${MAX_ATTEMPTS} to add resource "${lora.title}"`);
            try {
                await addSingleResource(lora.title, lora.version);
                await waitForResourceAdded(lora.title, 5000);

                success = true;
                console.log(`✅ VERIFIED: "${lora.title}" was successfully added.`);
                break;
            } catch (error) {
                console.error(`❌ Attempt ${attempt} to add "${lora.title}" failed:`, error.message);
                const leftoverModal = document.querySelector('section.mantine-Modal-content');
                if (leftoverModal) {
                    const closeButton = leftoverModal.querySelector('button[class*="CloseButton"]');
                    if (closeButton) {
                        console.log("Closing leftover modal...");
                        closeButton.click();
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
                if (attempt === MAX_ATTEMPTS) {
                    updateStatus(`❌ Failed to add "${lora.title}". Continuing anyway.`, true);
                    await new Promise(r => setTimeout(r, 2000)); 
                }                
            }
            if (attempt < MAX_ATTEMPTS) console.log("TRYING AGAIN!");
        }
    }
}

/**
 * Automates the entire UI flow for adding a single resource by name.
 * @param {string} resourceName The name to search for (e.g., "Detail Tweaker XL").
 * @param {string} resourceVersion The version to select (currently unused, for future).
 */
async function addSingleResource(resourceName, resourceVersion) {
    if (!videoContainerElement) throw new Error("Video container element not found.");

    // 1. Find and click the "ADD RESOURCE" button
    console.log(`Finding 'ADD RESOURCE' button...`);
    const allH3s = Array.from(videoContainerElement.querySelectorAll('h3'));
    const resourceHeader = allH3s.find(h => h.textContent.trim() === 'Resources');
    if (!resourceHeader) throw new Error("Could not find the 'Resources' heading.");
    // Navigate up two parent elements to find the correct container
    const resourceContainer = resourceHeader.parentElement.parentElement;
    if (!resourceContainer) throw new Error("Could not find the parent container for resources.");

    // Now, find the 'RESOURCE' button within that correct container
    const allButtons = Array.from(resourceContainer.querySelectorAll('button'));
    const addResourceButton = allButtons.find(b => b.innerText.trim() === 'RESOURCE');
        addResourceButton.click();

    // 2. Wait for the resource selection modal to appear and be ready
    console.log("Waiting for resource modal...");
    const resourceModal = await waitForModalWithText("Select resource(s)", 5000);
    console.log("✅ Resource modal is open and interactive.");

    // 3. Find the search input and type the resource name
    const searchInput = resourceModal.querySelector('input[placeholder="Search..."]');
    if (!searchInput) throw new Error("Could not find the resource search input.");
    await typeCharacterByCharacter(searchInput, resourceName);
    console.log(`Typed "${resourceName}" into search.`);

    // 4. Wait for search results to appear. We'll look for the grid container.
    // A small delay helps ensure the search is triggered before we look for results.
    await new Promise(r => setTimeout(r, 1000)); // Wait 1s for search results
    const resultsGrid = await waitForInteractiveElement('div[class*="SearchLayout_grid"]', 10000);
    console.log("✅ Search results grid is visible.");

    // 5. Find the correct card and its "Select" button
    const cards = resultsGrid.querySelectorAll('div[class*="Cards_root"]');
    let targetCard = null;

    for (const card of cards) {
        // Find the specific paragraph element that is the title.
        const titleElement = card.querySelector('p[data-line-clamp="true"]');
        
        // Check if we found the title and if its text matches.
        if (titleElement && titleElement.textContent.trim().startsWith(resourceName)) {
            targetCard = card;
            break; 
        }
    }
    if (!targetCard) throw new Error(`Could not find a card with the exact title "${resourceName}".`);
    console.log(`Found card for "${resourceName}".`);


    if (resourceVersion && resourceVersion.trim() !== '') {
        const versionInput = targetCard.querySelector('input.mantine-Select-input');
        if (!versionInput) throw new Error("Could not find version selector on the card.");

        // Check if the correct version is already selected
        if (versionInput.value.trim() === resourceVersion.trim()) {
            console.log(`Version "${resourceVersion}" is already selected. Skipping.`);
        } else {
            console.log(`Selecting version "${resourceVersion}"...`);
            versionInput.click();

            // Wait for the version dropdown to appear
            const versionDropdown = await waitForInteractiveElement('div.mantine-Select-dropdown', 5000);
            
            // Find the specific version option inside the dropdown
            const allVersionOptions = versionDropdown.querySelectorAll('div[data-combobox-option]');
            const targetVersionOption = Array.from(allVersionOptions).find(opt => opt.querySelector('span')?.textContent.trim() === resourceVersion.trim());

            if (targetVersionOption) {
                console.log(`Found version option. Clicking it.`);
                targetVersionOption.click();
                // Wait for the dropdown to disappear to confirm selection
                await waitForElementToDisappear('div.mantine-Select-dropdown', 3000);
            } else {
                console.warn(`Could not find version "${resourceVersion}" in the dropdown. The default will be used.`);
                // Click outside the dropdown to close it gracefully
                document.body.click();
                await waitForElementToDisappear('div.mantine-Select-dropdown', 3000);
            }
        }
    }    
    
    const selectButton = Array.from(targetCard.querySelectorAll('button')).find(b => b.textContent === 'Select');
    if (!selectButton) throw new Error("Could not find 'Select' button on the resource card.");

    // 6. Click "Select" and then close the modal
    console.log("Clicking 'Select' button...");
    selectButton.click();
    
    // The modal closes itself on selection. We just need to wait for it.
    await waitForModalToDisappearByText("Select resource(s)", 5000);
    console.log("✅ Resource modal has closed.");
}


/**
 * Simulates typing a string into an element character by character,
 * dispatching keyboard events for maximum compatibility with frameworks like React.
 * @param {HTMLElement} element The input element to type into.
 * @param {string} text The string to type.
 */
async function typeCharacterByCharacter(element, text) {
    element.focus();
    element.value = ''; // Clear the input first

    for (const char of text) {
        // Dispatch a 'keydown' event
        element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        // Update the value
        element.value += char;
        // Dispatch 'keyup' and 'input' events to trigger all listeners
        element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true }));
        // A tiny delay between characters makes it even more reliable
        await new Promise(r => setTimeout(r, 50));
    }
}


/**
 * Waits for an element to appear and become interactive by checking its opacity.
 * This is a minimal, robust function to handle animated elements.
 * @param {string} selector The CSS selector for the element.
 * @param {number} timeout The timeout in milliseconds.
 * @returns {Promise<HTMLElement>} A promise that resolves with the interactive element.
 */
function waitForInteractiveElement(selector, timeout) {
    return new Promise((resolve, reject) => {
        const checkInterval = 100; // Check every 100ms
        const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            reject(new Error(`Timeout: Interactive element "${selector}" did not appear within ${timeout}ms.`));
        }, timeout);

        const intervalId = setInterval(() => {
            const element = document.querySelector(selector);
            // Wait for the element to exist AND for its animation to complete (opacity is 1).
            if (element && window.getComputedStyle(element).opacity === '1') {
                clearInterval(intervalId);
                clearTimeout(timeoutId);
                resolve(element);
            }
        }, checkInterval);
    });
}

/**
 * Handles selecting a sampler by simulating keyboard navigation,
 * which is more robust than trying to find and click the filtered option.
 */
async function selectSampler(modal, samplerName) {
    if (!samplerName || samplerName.trim() === '') {
        console.log("No sampler name provided, skipping sampler selection.");
        return;
    }

    const samplerInput = modal.querySelector('#input_sampler');
    if (!samplerInput) throw new Error("Could not find sampler input field.");

    // Find the input's wrapper and look for the clear button ('X') inside it.
    // This button only exists if there's a value.
    const inputWrapper = samplerInput.closest('.mantine-Input-wrapper');
    const clearButton = inputWrapper ? inputWrapper.querySelector('button[class*="CloseButton"]') : null;

    if (clearButton) {
        console.log("Found existing value. Clicking clear button to reset state...");
        clearButton.click();
        // Give React a moment to process the state change from the clear action.
        await new Promise(r => setTimeout(r, 100));
    }

    // STEP 1: Click to open and focus.
    console.log("Clicking sampler input to open the dropdown...");
    samplerInput.click();

    // STEP 2: Wait for the dropdown to be ready.
    const dropdownSelector = 'div[aria-labelledby="input_sampler-label"]';
    await waitForInteractiveElement(dropdownSelector, 5000);
    console.log("✅ Sampler dropdown is interactive.");

    // STEP 3: Type the search term to trigger the filter.
    await typeCharacterByCharacter(samplerInput, samplerName);
    console.log(`Finished typing "${samplerName}".`);

    // A brief pause to ensure the filter has been fully applied.
    await new Promise(r => setTimeout(r, 200));

    // STEP 4: Simulate pressing the "Arrow Down" key to highlight the first (and only) result.
    console.log("Simulating 'ArrowDown' key press...");
    samplerInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    samplerInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
    await new Promise(r => setTimeout(r, 100));

    // STEP 5: Simulate pressing the "Enter" key to select the highlighted option.
    console.log("Simulating 'Enter' key press...");
    samplerInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    samplerInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
}

/**
 * Reliably sets the value of an input or textarea and dispatches an 'input' event
 * to notify the website's framework of the change.
 * @param {HTMLElement} element The input or textarea element.
 * @param {string|number} value The value to set.
 */
function setInputValue(element, value) {
    if (!element) {
        console.warn("setInputValue called with a null element.");
        return;
    }
    // 1. Set the value directly. This is the standard, safe way.
    element.value = value;

    // 2. Dispatch an 'input' event. This is the crucial part that
    //    tells React, "Hey, the user just typed something!"
    element.dispatchEvent(new Event('input', { bubbles: true }));
}

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
        const modal = await waitForInteractiveElement(modalContentSelector, 5000);
        console.log("✅ Successfully detected the prompt modal:", modal);

        try {
            // 1. Get the data from our extension's UI
            const data = {
                prompt: document.getElementById('ch-video-prompt').value,
                negativePrompt: document.getElementById('ch-video-neg-prompt').value,
                cfg: document.getElementById('ch-video-guidance').value,
                steps: document.getElementById('ch-video-steps').value,
                sampler: document.getElementById('ch-video-sampler').value,
                seed: document.getElementById('ch-video-seed').value
            };
            console.log("📝 Data to fill:", data);

            // 2. Fill the "simple" fields
            setInputValue(modal.querySelector('#input_prompt'), data.prompt);
            setInputValue(modal.querySelector('#input_negativePrompt'), data.negativePrompt);
            setInputValue(modal.querySelector('#input_cfgScale'), data.cfg);
            setInputValue(modal.querySelector('#input_steps'), data.steps);
            setInputValue(modal.querySelector('#input_seed'), data.seed);
            console.log("✅ Simple fields filled.");

            // 3. Fill the "difficult" sampler field
            const comfySampler = data.sampler.trim().toLowerCase();
            const civitaiSampler = SAMPLER_MAP[comfySampler]; // Look it up in our dictionary

            if (civitaiSampler) {
                console.log(`✅ Sampler mapped: "${comfySampler}" -> "${civitaiSampler}"`);
            } else {
                console.warn(`Unmapped sampler: "${comfySampler}". Skipping sampler selection.`);
            }

            const MAX_SAMPLER_ATTEMPTS = 2; // We will try a maximum of two times.
            let samplerSetCorrectly = false;

            for (let i = 1; i <= MAX_SAMPLER_ATTEMPTS; i++) {
                console.log(`Attempt ${i}/${MAX_SAMPLER_ATTEMPTS} to set sampler to "${civitaiSampler}"`);

                // Perform one attempt to set the sampler.
                await selectSampler(modal, civitaiSampler);

                // Give the component a moment to update its value in the DOM after 'Enter'.
                await new Promise(r => setTimeout(r, 200));

                // VERIFY THE RESULT
                const samplerInput = modal.querySelector('#input_sampler');
                const currentValue = samplerInput ? samplerInput.value : '';
                console.log(`Verification: Input value is now "${currentValue}"`);

                if (currentValue === civitaiSampler) {
                    samplerSetCorrectly = true;
                    console.log("✅ Sampler set correctly.");
                    break; // Success! Exit the loop.
                } else {
                    console.warn(`Sampler was not set correctly on attempt ${i}. Expected "${civitaiSampler}", got "${currentValue}".`);
                    if (i < MAX_SAMPLER_ATTEMPTS) {
                        console.log("Retrying...");
                    }
                }
            }

            if (!samplerSetCorrectly) {
                console.error(`Failed to set sampler correctly after ${MAX_SAMPLER_ATTEMPTS} attempts. Continuing anyway.`);
                // We don't throw an error, we just accept the failure and move on.
            }

            // 4. Handle the "onBlur" quirk and Save
            const saveButton = Array.from(modal.querySelectorAll('button')).find(b => b.textContent === 'Save');
            if (!saveButton) throw new Error("Could not find the 'Save' button in the modal.");

            // Click the modal title to ensure the last input field loses focus (triggers onBlur)
            const modalTitle = modal.querySelector('.mantine-Modal-title');
            if (modalTitle) modalTitle.click();
            await new Promise(r => setTimeout(r, 100)); // Short delay for safety

            console.log("Clicking 'Save' button...");
            saveButton.click();

            // 5. Verify the modal closes
            await waitForElementToDisappear(modalContentSelector, 5000);
            console.log("🎉 Metadata modal filled and closed successfully!");
            statusSpan.textContent = "Success! Video metadata has been filled.";

        } catch (error) {
            console.error("❌ Failed during metadata fill process:", error);
            statusSpan.textContent = `Failed to fill metadata: ${error.message}`;
            // Optionally, try to close the modal on failure
            //const closeButton = modal.querySelector('button.mantine-Modal-close');
            //if (closeButton) closeButton.click();
        }


    } catch (error) {
        console.error("❌ Prompt fill test failed:", error);
        statusSpan.textContent = `Prompt fill test failed: ${error.message}`;
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
        updateStatus('✅ All uploads complete! You can now fill out the form.');
        document.getElementById('ch-modal-post-btn').disabled = false;
        //testFillButton.style.display = 'inline-block';
        //testResourceButton.style.display = 'inline-block';

    } catch (error) {
        console.error('Orchestrator failed:', error);
        openDetailsButton.style.display = 'none';
        retryBannerButton.style.display = 'inline-block';
        setBannerToErrorState(error.message);
        updateStatus(`❌ ${error.message}`, true);
    } finally {
        // Re-enable the button once the process is truly finished or failed
        uploadButton.disabled = false;
    }
}

// --- The Core State Machine for a single upload ---

async function manageUploadLifecycle(config) {
    const MAX_RETRIES = 3;
    const modalStatusSpan = document.getElementById('ch-modal-status');

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
        if (document.querySelector(selector)) return resolve();

        const timeoutId = setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout: Element "${selector}" did not appear within ${timeout}ms.`));
        }, timeout);

        const observer = new MutationObserver((mutations, obs) => {
            const foundElement = document.querySelector(selector);
            if (foundElement) {
                clearTimeout(timeoutId);
                obs.disconnect();
                resolve(foundElement);
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
