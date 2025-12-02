import mediaInfoFactory from '../lib/mediainfo.min.js';

console.log("✅ Hello from the Civitai Helper content script!");

let mediaInfoInstance = null;
let videoToUpload = null;
let imageToUpload = null;
let metadataModal = null;

let videoContainerElement = null;
let imageContainerElement = null;
let isAutoPostMode = false;
let isSchedulePostMode = false;

let isBannerScootchedOver = false;

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

const VIDEO_TECHNIQUES = ["img2vid", "vid2vid", "txt2vid"];

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
banner.style.flexDirection = 'column';
banner.style.alignItems = 'flex-start';
document.body.append(banner);

// --- Banner Content ---

const firstLine = document.createElement('div');
Object.assign(firstLine.style, {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px'
});
banner.appendChild(firstLine);

const secondLine = document.createElement('div');
Object.assign(secondLine.style, {
    display: 'flex',
    alignItems: 'center'
});
banner.appendChild(secondLine);

const titleSpan = document.createElement('span');
titleSpan.style.fontWeight = 'bold';
titleSpan.textContent = 'Civitai Helper:';
firstLine.appendChild(titleSpan);

const videoLabel = document.createElement('span');
videoLabel.style.marginLeft = '15px';
videoLabel.textContent = 'Video:';
firstLine.appendChild(videoLabel);

const videoInput = document.createElement('input');
videoInput.type = 'file';
videoInput.accept = "video/mp4,video/webm";
firstLine.appendChild(videoInput);

const imageLabel = document.createElement('span');
imageLabel.textContent = 'Image (Optional):';
imageLabel.style.marginLeft = '15px';
firstLine.appendChild(imageLabel);

const imageInput = document.createElement('input');
imageInput.type = 'file';
imageInput.accept = "image/png,image/jpeg,image/webp";
firstLine.appendChild(imageInput);

const rightSideControls = document.createElement('div');
Object.assign(rightSideControls.style, {
    marginLeft: 'auto', // Pushes this group to the right
    display: 'flex',
    alignItems: 'center'
});
secondLine.appendChild(rightSideControls);


const uploadButton = document.createElement('button');
uploadButton.textContent = 'Upload & Show Details';
uploadButton.disabled = true;
uploadButton.style.marginLeft = '15px'; uploadButton.style.padding = '5px 10px'; uploadButton.style.border = '1px solid #555'; uploadButton.style.borderRadius = '5px'; uploadButton.style.backgroundColor = '#3498db'; uploadButton.style.color = 'white'; uploadButton.style.cursor = 'pointer';
secondLine.appendChild(uploadButton);

const autoPostButton = document.createElement('button');
autoPostButton.textContent = 'Auto Post';
Object.assign(autoPostButton.style, {
    marginLeft: '10px',
    padding: '5px 10px',
    border: '1px solid #c0392b',
    borderRadius: '5px',
    backgroundColor: '#e74c3c',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold'
});
secondLine.append(autoPostButton);

// --- "Auto Post Schedule" button
const scheduleButton = document.createElement('button');
scheduleButton.textContent = 'Auto Post Schedule';
Object.assign(scheduleButton.style, {
    marginLeft: '10px',
    padding: '5px 10px',
    border: '1px solid #16a085',
    borderRadius: '5px',
    backgroundColor: '#1abc9c',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold'
});
secondLine.appendChild(scheduleButton);

const scheduleDateInput = document.createElement('input');
scheduleDateInput.type = 'date';
scheduleDateInput.id = 'ch-schedule-date';
Object.assign(scheduleDateInput.style, {
    marginLeft: '10px', padding: '4px', border: '1px solid #555',
    borderRadius: '5px', backgroundColor: '#34495e', color: 'white'
});
secondLine.appendChild(scheduleDateInput);

// The time input field for the schedule
const scheduleTimeInput = document.createElement('input');
scheduleTimeInput.type = 'time'; // Use the browser's native time picker
scheduleTimeInput.id = 'ch-schedule-time';
Object.assign(scheduleTimeInput.style, {
    marginLeft: '5px',
    padding: '4px',
    border: '1px solid #555',
    borderRadius: '5px',
    backgroundColor: '#34495e',
    color: 'white'
});
secondLine.appendChild(scheduleTimeInput);

scheduleButton.addEventListener('click', () => {
    const timeValue = scheduleTimeInput.value;
    const incrementMinutes = parseInt(document.getElementById('ch-increment-minutes').value, 10);
    if (!timeValue) {
        alert("Please select a time to schedule the post.");
        return;
    }
    isAutoPostMode = true;
    isSchedulePostMode = true;
    runUploadOrchestrator();
});

// The "Increase by" number input field
const incrementInput = document.createElement('input');
incrementInput.type = 'number';
incrementInput.id = 'ch-increment-minutes';
incrementInput.min = '1';
incrementInput.step = '1';
incrementInput.value = '30'; // A sensible default
Object.assign(incrementInput.style, {
    marginLeft: '5px',
    padding: '4px',
    width: '60px', // Keep it small
    border: '1px solid #555',
    borderRadius: '5px',
    backgroundColor: '#34495e',
    color: 'white'
});
secondLine.appendChild(incrementInput);

document.getElementById('ch-schedule-time').addEventListener('input', updateNextTimeDisplay);
document.getElementById('ch-increment-minutes').addEventListener('input', updateNextTimeDisplay);
document.getElementById('ch-schedule-date').addEventListener('input', updateNextTimeDisplay);

// A label to show the calculated next post time
const nextTimeLabel = document.createElement('span');
nextTimeLabel.id = 'ch-next-time-label';
nextTimeLabel.style.marginLeft = '10px';
nextTimeLabel.style.fontWeight = 'bold';
nextTimeLabel.style.color = '#1abc9c';
secondLine.appendChild(nextTimeLabel);

const openDetailsButton = document.createElement('button');
openDetailsButton.textContent = 'Open Details';
openDetailsButton.style.display = 'none';
openDetailsButton.style.marginLeft = '15px';
openDetailsButton.style.padding = '5px 10px';
openDetailsButton.style.border = '1px solid #555';
openDetailsButton.style.borderRadius = '5px';
openDetailsButton.style.backgroundColor = '#2980b9';
openDetailsButton.style.color = 'white';
openDetailsButton.style.cursor = 'pointer';
openDetailsButton.addEventListener('click', showModal);
rightSideControls.appendChild(openDetailsButton);


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
rightSideControls.appendChild(retryBannerButton);

const statusSpan = document.createElement('span');
statusSpan.style.marginLeft = '20px';
rightSideControls.appendChild(statusSpan);

const retryButton = document.createElement('button');
retryButton.textContent = 'Delete Post & Reload';
retryButton.style.marginLeft = '15px'; retryButton.style.padding = '5px 10px'; retryButton.style.border = '1px solid #555'; retryButton.style.borderRadius = '5px'; retryButton.style.backgroundColor = '#c0392b'; retryButton.style.color = 'white'; retryButton.style.cursor = 'pointer';
retryButton.style.display = 'none';
rightSideControls.appendChild(retryButton);

// --- The "Scooch Over" Link ---
const scoochLink = document.createElement('a');
scoochLink.textContent = 'scooch over, let me click something';
scoochLink.href = '#';
Object.assign(scoochLink.style, {
    color: '#95a5a6',
    textDecoration: 'underline',
    fontSize: '12px',
    cursor: 'pointer',
    position: 'absolute',
    top: '-20px',
    right: '10px'
});
banner.appendChild(scoochLink);

scoochLink.addEventListener('click', (e) => {
    e.preventDefault();
    isBannerScootchedOver = true;
    const originalDisplay = banner.style.display;
    banner.style.display = 'none';
    setTimeout(() => {
        banner.style.display = originalDisplay;
        isBannerScootchedOver = false;
    }, 5000);
});


async function populateModalWithData(data) {
    if (!data) return;

    // Helper to set value if element exists
    const setInputValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    };

    // --- Populate standard video fields ---
    setInputValue('ch-video-prompt', sanitizePrompt(data.positive_prompt));
    setInputValue('ch-video-neg-prompt', sanitizePrompt(data.negative_prompt));
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

    if (isAutoPostMode && unrecognizedContainer.children.length > 0) {
        console.warn("Unrecognized LoRAs found in Auto Post mode. Pausing for user input.");

        const userChoice = confirm("Angry CivitAi uploadhelper found unrecognized LoRAs!\n\nClick 'OK' to post anyway (they will not be linked).\nClick 'Cancel' to stop and add them manually.");

        if (userChoice) {
            console.log("User chose to continue. Resuming auto-post.");
        } else {
            console.log("User chose to stop. Aborting auto-post and showing details.");
            isAutoPostMode = false; // Disable auto-post for this run
            showModal(); // Show our UI so they can fix it
            // Throw a specific, catchable error to gracefully stop the orchestrator
            throw new Error("AUTO-POST_INTERRUPTED");
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

    // Step 4: Prefill the technique radio buttons
    if (data && data.technique) {
        const techniqueFromData = data.technique.toLowerCase();
        // Find the radio button corresponding to the technique
        const radioToSelect = document.getElementById(`ch-technique-${techniqueFromData}`);
        if (radioToSelect) {
            radioToSelect.checked = true;
            console.log(`Pre-selected technique: ${techniqueFromData}`);
        } else {
            console.warn(`Technique "${techniqueFromData}" from metadata is not a known option.`);
        }
    }
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
        width: '900px', maxHeight: '90vh', overflowY: 'auto', color: 'white',
        display: 'flex',
        flexDirection: 'column'
    });
    modalOverlay.appendChild(modalContainer);

    const scrollableContent = document.createElement('div');
    Object.assign(scrollableContent.style, {
        overflowY: 'auto',
        flexGrow: '1',
        paddingRight: '10px'
    });
    modalContainer.appendChild(scrollableContent);

    // --- Video Section (Prompt, Seed, etc.) ---
    const videoSection = document.createElement('div');
    videoSection.innerHTML = '<h3 style="margin-top:0;">Video Generation Data</h3>';
    videoSection.appendChild(createInputRow('Prompt:', createTextarea('ch-video-prompt', 4)));
    videoSection.appendChild(createInputRow('Negative Prompt:', createTextarea('ch-video-neg-prompt', 4)));
    videoSection.appendChild(createInputRow('Guidance Scale:', createNumberInput('ch-video-guidance')));
    videoSection.appendChild(createInputRow('Steps:', createNumberInput('ch-video-steps')));
    videoSection.appendChild(createInputRow('Sampler:', createTextInput('ch-video-sampler')));
    videoSection.appendChild(createInputRow('Seed:', createNumberInput('ch-video-seed')));
    scrollableContent.appendChild(videoSection);

    // --- Resources Section ---
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
    addResourceButton.style.padding = '5px 10px';
    addResourceButton.style.border = '1px solid #777';
    addResourceButton.style.borderRadius = '4px';
    addResourceButton.style.backgroundColor = '#5f6a78';
    addResourceButton.style.color = 'white';
    addResourceButton.style.cursor = 'pointer';

    resourcesSection.appendChild(addResourceButton);
    scrollableContent.appendChild(resourcesSection);


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

    scrollableContent.appendChild(toolsSection);

    // Video techniques
    const techniquesContainer = document.createElement('div');
    techniquesContainer.style.display = 'flex';
    techniquesContainer.style.alignItems = 'center';
    techniquesContainer.style.marginBottom = '10px';

    const techniquesLabel = document.createElement('label');
    techniquesLabel.textContent = 'Technique:';
    techniquesLabel.style.width = '150px';
    techniquesLabel.style.flexShrink = '0';
    techniquesContainer.appendChild(techniquesLabel);

    const radioGroup = document.createElement('div');
    radioGroup.style.display = 'flex';
    radioGroup.style.gap = '15px';

    VIDEO_TECHNIQUES.forEach(technique => {
        const radioContainer = document.createElement('div');
        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.name = 'ch-video-technique'; // Same name groups them
        radioInput.id = `ch-technique-${technique}`;
        radioInput.value = technique;

        const radioLabel = document.createElement('label');
        radioLabel.htmlFor = radioInput.id;
        radioLabel.textContent = technique.toUpperCase();
        radioLabel.style.marginLeft = '5px';
        radioLabel.style.cursor = 'pointer';

        radioContainer.appendChild(radioInput);
        radioContainer.appendChild(radioLabel);
        radioGroup.appendChild(radioContainer);
    });

    techniquesContainer.appendChild(radioGroup);
    scrollableContent.appendChild(techniquesContainer);











    // --- Image Section (if an image is to be uploaded) ---

    const imageSection = document.createElement('div');
    imageSection.id = 'ch-image-section';
    imageSection.style.display = 'none'; // Starts hidden
    imageSection.innerHTML = '<h3 style="margin-top: 20px; border-top: 1px solid #555; padding-top: 15px;">Image Generation Data</h3>';

    // Add basic fields for Image
    imageSection.appendChild(createInputRow('Prompt:', createTextarea('ch-image-prompt', 2)));
    imageSection.appendChild(createInputRow('Negative Prompt:', createTextarea('ch-image-neg-prompt', 2)));
    imageSection.appendChild(createInputRow('Steps:', createNumberInput('ch-image-steps')));
    imageSection.appendChild(createInputRow('Sampler:', createTextInput('ch-image-sampler')));
    imageSection.appendChild(createInputRow('Guidance Scale:', createNumberInput('ch-image-guidance')));
    imageSection.appendChild(createInputRow('Seed:', createNumberInput('ch-image-seed')));

    // --- Dedicated Resource Section for the Image ---
    const imageResourcesSection = document.createElement('div');
    imageResourcesSection.innerHTML = `<h4 style="margin-top: 20px; border-top: 1px solid #777; padding-top: 10px;">Image Resources</h4>`;

    // Base Model for Image
    imageResourcesSection.appendChild(createInputRow('Base Model:', createTextInput('ch-image-base-model')));

    // Container for Recognized Image LoRAs
    imageResourcesSection.innerHTML += '<h5 style="margin-bottom: 5px;">Recognized LoRAs</h5>';
    const recognizedImageLoras = document.createElement('div');
    recognizedImageLoras.id = 'ch-image-recognized-loras';
    imageResourcesSection.appendChild(recognizedImageLoras);

    // Container for Unrecognized Image LoRAs
    imageResourcesSection.innerHTML += '<h5 style="margin-top: 10px; margin-bottom: 5px;">Unrecognized LoRAs</h5>';
    const unrecognizedImageLoras = document.createElement('div');
    unrecognizedImageLoras.id = 'ch-image-unrecognized-loras';
    imageResourcesSection.appendChild(unrecognizedImageLoras);

    // Controls for adding new image resources
    const addImageResourceBtn = document.createElement('button');
    addImageResourceBtn.id = 'ch-image-add-resource-btn';
    addImageResourceBtn.textContent = 'Add more loras';
    Object.assign(addImageResourceBtn.style, {
        marginTop: '10px',
        padding: '5px 10px',
        border: '1px solid #777',
        borderRadius: '4px',
        backgroundColor: '#5f6a78',
        color: 'white',
        cursor: 'pointer'
    });
    imageResourcesSection.appendChild(addImageResourceBtn);

    // --- Image Techniques UI ---
    const imageTechniquesContainer = document.createElement('div');
    imageTechniquesContainer.style.marginTop = '20px';
    imageTechniquesContainer.style.paddingTop = '15px';
    imageTechniquesContainer.style.borderTop = '1px solid #555';

    const imageTechniquesLabel = document.createElement('label');
    imageTechniquesLabel.textContent = 'Image Technique:';
    imageTechniquesLabel.style.fontWeight = 'bold';
    imageTechniquesLabel.style.marginBottom = '10px';
    imageTechniquesLabel.style.display = 'block';
    imageTechniquesContainer.appendChild(imageTechniquesLabel);

    const imageTechniqueRadioGroup = document.createElement('div');
    imageTechniqueRadioGroup.style.display = 'flex';
    imageTechniqueRadioGroup.style.gap = '15px';
    const IMAGE_TECHNIQUES = ["txt2img", "img2img", "inpainting", "workflow", "controlnet"];
    IMAGE_TECHNIQUES.forEach(technique => {
        const radioContainer = document.createElement('div');
        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.name = 'ch-image-technique';
        radioInput.id = `ch-image-technique-${technique}`;
        radioInput.value = technique;
        const radioLabel = document.createElement('label');
        radioLabel.htmlFor = radioInput.id;
        radioLabel.textContent = technique.toUpperCase();
        radioLabel.style.marginLeft = '5px';
        radioLabel.style.cursor = 'pointer';
        radioContainer.appendChild(radioInput);
        radioContainer.appendChild(radioLabel);
        imageTechniqueRadioGroup.appendChild(radioContainer);
    });
    imageTechniquesContainer.appendChild(imageTechniqueRadioGroup);
    imageSection.appendChild(imageTechniquesContainer);


    // --- Image Tools UI ---
    const imageToolsSection = document.createElement('div');
    imageToolsSection.id = 'ch-image-tools-section';
    imageToolsSection.innerHTML = '<h3 style="margin-top: 20px; border-top: 1px solid #555; padding-top: 15px;">Image Tools</h3>';

    const selectedImageToolsContainer = document.createElement('div');
    selectedImageToolsContainer.id = 'ch-selected-image-tools';
    Object.assign(selectedImageToolsContainer.style, { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' });
    imageToolsSection.appendChild(selectedImageToolsContainer);

    const showAllImageToolsBtn = document.createElement('button');
    showAllImageToolsBtn.textContent = 'Show All Tools ▼';
    Object.assign(showAllImageToolsBtn.style, { padding: '5px 10px', cursor: 'pointer', border: '1px solid #777', borderRadius: '4px', backgroundColor: '#5f6a78', color: 'white' });
    imageToolsSection.appendChild(showAllImageToolsBtn);

    const allImageToolsContainer = document.createElement('div');
    allImageToolsContainer.id = 'ch-all-image-tools';
    Object.assign(allImageToolsContainer.style, { display: 'none', marginTop: '15px', flexWrap: 'wrap', gap: '10px 15px', maxHeight: '200px', overflowY: 'auto', border: '1px solid #555', padding: '10px', borderRadius: '5px' });

    ALL_CIVITAI_TOOLS.forEach(toolName => {
        allImageToolsContainer.appendChild(createToolCheckbox(toolName, 'image'));
    });
    imageToolsSection.appendChild(allImageToolsContainer);

    showAllImageToolsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = allImageToolsContainer.style.display === 'none';
        allImageToolsContainer.style.display = isHidden ? 'flex' : 'none';
        showAllImageToolsBtn.textContent = isHidden ? 'Hide All Tools ▲' : 'Show All Tools ▼';
    });
    imageSection.appendChild(imageToolsSection);


    imageSection.appendChild(imageResourcesSection);
    scrollableContent.appendChild(imageSection);






    // --- Actions & Settings Link ---
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.alignItems = 'center';
    footer.style.marginTop = '20px';
    footer.style.paddingTop = '15px';
    footer.style.borderTop = '1px solid #555';
    footer.style.flexShrink = '0';

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


























// --- LOGIC ---




// *****************************************************************************
// MAIN ORCHESTRATOR FUNCTION
// This is the main function that runs when the user clicks "Start Automation".
// It tries to handle all steps automatically, with retries and error handling.
// *****************************************************************************
async function handleStartButtonClick() {
    const postButton = document.getElementById('ch-modal-post-btn');
    postButton.disabled = true;

    try {
        hideModal();
        if (videoContainerElement) {
            await fillVideoFields();
        }

        if (imageContainerElement) {
            await fillImageFields();
        }

        updateStatus("✅ All form filling complete. Publishing...");
        await new Promise(r => setTimeout(r, 1000));

        // --- FINAL STEP: CLICK PUBLISH ---
        if (isSchedulePostMode) {
            updateStatus("⏳ Scheduling post...");
            const timeValue = document.getElementById('ch-schedule-time').value;
            await schedulePost();
            updateStatus("🎉 Post Scheduled! Angry CivitAI Upolaodhelper is victorious!");
            return;
        }

        if (isAutoPostMode) {
            updateStatus("✅ All form filling complete. Publishing...");
            const publishButton = document.querySelector('button[data-tour="post:publish"]');
            if (!publishButton) throw new Error("Could not find the final 'Publish' button.");

            console.log("😡 EAT THIS, PUBLISH BUTTON!");
            publishButton.click();
            updateStatus("🎉 Post published! Angry CivitAI Upolaodhelper is victorious!");
            return;
        }

        await new Promise(r => setTimeout(r, 1000));
        const publishButton = document.querySelector('button[data-tour="post:publish"]');
        if (!publishButton) throw new Error("Could not find the final 'Publish' button.");
        publishButton.click();
        updateStatus("🎉 Post Published! Angry CivitAI Upolaodhelper is victorious!");

    } catch (error) {
        updateStatus(`❌ Error: ${error.message}`, true);
        alert(`An error occurred: ${error.message}`);
    } finally {
        postButton.disabled = false;
    }
}

// *****************************************************************************
// VIDEO FORM FILLING FUNCTION
// This function handles all the steps to fill in the video form fields,
// including metadata, resources, tools, and technique.
// It includes retries and error handling for robustness.
// *****************************************************************************
async function fillVideoFields() {
    // Video tasks
    // --- Part 1: Fill the metadata (prompts, sampler, etc.) ---
    updateStatus("⏳ Filling metadata...");
    await initiateVideoMetadataFill();
    console.log("✅ Metadata filled.");

    // --- Part 2: Get the LoRA list and add them ---
    const loras = getLoraDataFromModal();
    if (loras.length > 0) {
        updateStatus(`Adding ${loras.length} resources...`);
        await addResourcesFromList(loras, videoContainerElement);
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
                await new Promise(r => setTimeout(r, 200));
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

    // --- Part 4: Add Technique ---
    const selectedTechnique = document.querySelector('input[name="ch-video-technique"]:checked')?.value;
    if (selectedTechnique) {
        updateStatus(`⏳ Adding technique: ${selectedTechnique}...`);
        let techniqueSuccess = false;
        const MAX_ATTEMPTS = 3;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                // Check if it's already there first
                const header = Array.from(videoContainerElement.querySelectorAll('h3')).find(h => h.textContent.trim() === 'Techniques');
                if (header && header.parentElement.parentElement.innerText.includes(selectedTechnique)) {
                    console.log(`Technique "${selectedTechnique}" is already present.`);
                    techniqueSuccess = true;
                    break;
                }

                console.log(`Attempt ${attempt}/${MAX_ATTEMPTS} to add technique "${selectedTechnique}"`);
                await new Promise(r => setTimeout(r, 200));

                await addTechnique(selectedTechnique, videoContainerElement);
                await waitForTechniqueAdded(selectedTechnique, videoContainerElement);
                techniqueSuccess = true;
                console.log("✅ Technique successfully added and verified.");
                break;
            } catch (error) {
                console.error(`Attempt ${attempt} to add technique failed: ${error.message}`);
                if (attempt < MAX_ATTEMPTS) {
                    console.log("😡 EAT THIS! AGAIN!");
                }
            }
        }
        if (!techniqueSuccess) {
            updateStatus(`❌ Failed to add technique. CONTINUING.`, true);
            await new Promise(r => setTimeout(r, 1500));
        }
    } else {
        console.log("No technique selected to add.");
    }

}

// *****************************************************************************
// VIDEO METADATA FILLING FUNCTION
// This function specifically handles filling in the video metadata fields
// (prompt, negative prompt, sampler, steps, cfg, seed) in the modal.
// It includes robust element selection, retries, and error handling.
// *****************************************************************************
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
        console.log("✅ Successfully detected the prompt modal");

        try {
            // 1. Get the data from our extension's UI
            const videoData = {
                prompt: document.getElementById('ch-video-prompt').value,
                negativePrompt: document.getElementById('ch-video-neg-prompt').value,
                cfg: document.getElementById('ch-video-guidance').value,
                steps: document.getElementById('ch-video-steps').value,
                sampler: document.getElementById('ch-video-sampler').value,
                seed: document.getElementById('ch-video-seed').value
            };
            console.log("📝 Data to fill:", videoData);

            // 2. Fill the "simple" fields
            setInputValue(modal.querySelector('#input_prompt'), sanitizePrompt(videoData.prompt));
            setInputValue(modal.querySelector('#input_negativePrompt'), sanitizePrompt(videoData.negativePrompt));
            setInputValue(modal.querySelector('#input_cfgScale'), videoData.cfg);
            setInputValue(modal.querySelector('#input_steps'), videoData.steps);
            setInputValue(modal.querySelector('#input_seed'), videoData.seed);
            console.log("✅ Simple fields filled.");

            // 3. Fill the "difficult" sampler field
            const comfySampler = videoData.sampler.trim().toLowerCase();
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

// *****************************************************************************
// IMAGE FORM FILLING FUNCTION
// This function handles all the steps to fill in the image form fields,
// including metadata, resources, tools, and technique.
// It includes retries and error handling for robustness.
// *****************************************************************************
async function fillImageFields() {

    updateStatus("⏳ Filling image metadata...");
    await initiateImageMetadataFill();
    console.log("✅ Image metadata filled.");

    // Image tasks (if applicable)
    if (imageToUpload && imageContainerElement) {
        const imageLoras = getImageLoraDataFromModal();
        if (imageLoras.length > 0) {
            await addResourcesFromList(imageLoras, imageContainerElement);
        }
    }

    // Add Image Tools
    const imageTools = getImageToolDataFromModal();
    if (imageTools.length > 0) {
        await new Promise(r => setTimeout(r, 200));
        await addImageTools(imageTools);
        await Promise.all(imageTools.map(tool => waitForImageToolAdded(tool)));
        console.log("✅ All image tools successfully added and verified.");
    }

    // Add Image Technique
    const selectedImageTechnique = document.querySelector('input[name="ch-image-technique"]:checked')?.value;
    if (selectedImageTechnique) {
        let retryCounterTechnique = 0;
        let wasTechniqueAdded = false;

        while (retryCounterTechnique < 6 && wasTechniqueAdded == false) {
            try {
                await new Promise(r => setTimeout(r, 200));
                await addTechnique(selectedImageTechnique, imageContainerElement);
                await waitForTechniqueAdded(selectedImageTechnique, imageContainerElement);
                wasTechniqueAdded = true;
            } catch (error) {
                console.log("An error oocured while adding techniques for the image: ", error);                
            }
            retryCounterTechnique++;
        }
    }
}

// *****************************************************************************
// IMAGE METADATA FILLING FUNCTION
// This function specifically handles filling in the image metadata fields
// (prompt, negative prompt, sampler, steps, cfg, seed) in the modal.
// It includes a robust, angry retry loop to combat the site overwriting our values.
// *****************************************************************************
async function initiateImageMetadataFill() {
    console.log("🚀 Starting ANGRY image metadata fill...");

    if (!imageContainerElement) {
        throw new Error("Cannot fill image metadata: The image container element was not found.");
    }

    const MAX_PROMPT_RETRIES = 5; // How many times we'll fight with the website
    const RETRY_DELAY = 1000; // Wait 1 second between checks to let the site do its thing

    // --- Step 1: Find the "EDIT" button, we'll need it multiple times ---
    const h3Elements = imageContainerElement.querySelectorAll('h3');
    const promptHeader = Array.from(h3Elements).find(h => h.textContent.trim() === 'Prompt');
    if (!promptHeader) {
        throw new Error("Could not find the 'Prompt' heading element inside the image container.");
    }
    const parentDiv = promptHeader.parentElement;
    const editButton = parentDiv.querySelector('button');
    if (!editButton || !editButton.textContent.includes('EDIT')) {
        throw new Error("Could not find the 'EDIT' button next to the image prompt header.");
    }
    console.log("✅ Found image 'EDIT' button. Preparing for battle.");

    // --- Step 2: Get target data and perform the INITIAL fill ---
    const imageData = {
        prompt: document.getElementById('ch-image-prompt').value,
        negativePrompt: document.getElementById('ch-image-neg-prompt').value,
        cfg: document.getElementById('ch-image-guidance').value,
        steps: document.getElementById('ch-image-steps').value,
        sampler: document.getElementById('ch-image-sampler').value,
        seed: document.getElementById('ch-image-seed').value
    };
    const targetPrompt = sanitizePrompt(imageData.prompt);
    const targetNegativePrompt = sanitizePrompt(imageData.negativePrompt);
    const modalContentSelector = 'section.mantine-Modal-content';

    console.log("Clicking 'EDIT' for the first attempt...");
    editButton.click();
    let modal = await waitForInteractiveElement(modalContentSelector, 5000);
    console.log("📝 Performing initial data fill...");


    // Now set the prompts and other fields
    setInputValue(modal.querySelector('#input_prompt'), targetPrompt);
    setInputValue(modal.querySelector('#input_negativePrompt'), targetNegativePrompt);
    setInputValue(modal.querySelector('#input_cfgScale'), imageData.cfg);
    setInputValue(modal.querySelector('#input_steps'), imageData.steps);
    setInputValue(modal.querySelector('#input_seed'), imageData.seed);

    await new Promise(r => setTimeout(r, 300));
//    const comfySampler = imageData.sampler.trim().toLowerCase();
//    const civitaiSampler = SAMPLER_MAP[comfySampler];
//    if (civitaiSampler) {
//        await selectSampler(modal, civitaiSampler);
//    }
//    await new Promise(r => setTimeout(r, 300));

    const initialSaveButton = Array.from(modal.querySelectorAll('button')).find(b => b.textContent === 'Save');
    if (!initialSaveButton) throw new Error("Could not find the 'Save' button in the image modal.");

    let retryCounterDisappearPrompt = 0;
    let didPromptPopupDisappear = false;
    while (retryCounterDisappearPrompt < 6 && didPromptPopupDisappear == false) {
        initialSaveButton.click();
        try {
            await waitForElementToDisappear(modalContentSelector, 5000);
            didPromptPopupDisappear = true;
        } catch(error) {
            console.log("Error while waiting for prompt popup to disappear: ", error);
        }
        retryCounterDisappearPrompt++;
    }
    console.log("✅ Initial fill complete. Now, we verify.");

    // --- Step 3: The ANGRY Verification and Retry Loop ---
    for (let attempt = 1; attempt <= MAX_PROMPT_RETRIES; attempt++) {
        console.log(`🔎 Verifying prompt, attempt ${attempt}/${MAX_PROMPT_RETRIES}...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY)); // Wait for Civitai to potentially mess up

        editButton.click();
        const verificationModal = await waitForInteractiveElement(modalContentSelector, 5000);

        const currentPrompt = verificationModal.querySelector('#input_prompt').value;

        if (currentPrompt === targetPrompt) {
            console.log("✅ VICTORY! The prompt has stuck. Closing verification modal.");
            const closeButton = verificationModal.querySelector('button.mantine-Modal-close');
            if (closeButton) closeButton.click();
            await waitForElementToDisappear(modalContentSelector, 5000);
            return; // Success! Exit the function.
        }

        // If we're here, the prompt did NOT stick.
        console.warn(`😡 PROMPT MISMATCH! Site has overwritten the value. Expected: "${targetPrompt.substring(0, 50)}...", Got: "${currentPrompt.substring(0, 50)}...". REAPPLYING!`);
        updateStatus(`😡 Prompt overwritten! Re-applying... (Attempt ${attempt})`);

        // Re-apply ONLY the prompts
        setInputValue(verificationModal.querySelector('#input_prompt'), targetPrompt);
        setInputValue(verificationModal.querySelector('#input_negativePrompt'), targetNegativePrompt);

        const retrySaveButton = Array.from(verificationModal.querySelectorAll('button')).find(b => b.textContent === 'Save');
        if (!retrySaveButton) {
             const closeButton = verificationModal.querySelector('button.mantine-Modal-close');
             if (closeButton) closeButton.click();
             throw new Error("Could not find 'Save' button during retry.");
        }
        
        console.log("...saving correction...");
        retrySaveButton.click();
        await waitForElementToDisappear(modalContentSelector, 5000);
    }

    // If the loop finishes without returning, it means we failed.
    throw new Error(`DEFEAT: Failed to set the image prompt correctly after ${MAX_PROMPT_RETRIES} attempts. Civitai won this round.`);
}



/**
 * Removes forbidden words from a prompt string
 * @param {string} prompt The original prompt string.
 * @returns {string} The sanitized prompt string.
 */
function sanitizePrompt(prompt) {
    if (!prompt) {
        return '';
    }

    console.log("Sanitizing prompt:", prompt);

    const forbiddenWords = ['teenage', 'teen'];
    let sanitizedPrompt = prompt;

    forbiddenWords.forEach(wordToReplace => {
        let result = '';
        let lastIndex = 0;
        const lowerCasePrompt = sanitizedPrompt.toLowerCase();
        const lowerCaseWord = wordToReplace.toLowerCase();
        let currentIndex = lowerCasePrompt.indexOf(lowerCaseWord);

        while (currentIndex !== -1) {
            result += sanitizedPrompt.substring(lastIndex, currentIndex);
            lastIndex = currentIndex + wordToReplace.length;
            currentIndex = lowerCasePrompt.indexOf(lowerCaseWord, lastIndex);
        }
        result += sanitizedPrompt.substring(lastIndex);
        sanitizedPrompt = result;
    });

    return sanitizedPrompt;
}

// Load saved schedule settings on script start
loadScheduleSettings();

/**
 * Calculates the next schedule date and time, handling day/month/year rollovers.
 * @param {string} baseDate - Date in "YYYY-MM-DD" format.
 * @param {string} baseTime - Time in "HH:mm" format.
 * @param {number} minutesToAdd - The number of minutes to add.
 * @returns {{date: string, time: string}} The new date and time.
 */
function calculateNextTime(baseDate, baseTime, minutesToAdd) {
    const [year, month, day] = baseDate.split('-').map(Number);
    const [hours, minutes] = baseTime.split(':').map(Number);

    // Create a date object from the base date and time
    const date = new Date(year, month - 1, day, hours, minutes);

    // Add the increment
    date.setMinutes(date.getMinutes() + minutesToAdd);

    // Format the new date and time parts
    const nextYear = date.getFullYear();
    const nextMonth = (date.getMonth() + 1).toString().padStart(2, '0');
    const nextDay = date.getDate().toString().padStart(2, '0');
    const nextHours = date.getHours().toString().padStart(2, '0');
    const nextMinutes = date.getMinutes().toString().padStart(2, '0');

    return {
        date: `${nextYear}-${nextMonth}-${nextDay}`,
        time: `${nextHours}:${nextMinutes}`
    };
}

/**
 * Loads saved schedule settings, checks if they are stale, and updates the UI.
 */
async function loadScheduleSettings() {
    const data = await chrome.storage.local.get(['lastScheduleDate', 'lastScheduleTime', 'incrementMinutes']);
    const dateInput = document.getElementById('ch-schedule-date');
    const timeInput = document.getElementById('ch-schedule-time');
    const incrementInput = document.getElementById('ch-increment-minutes');

    let scheduleDate = data.lastScheduleDate;
    let scheduleTime = data.lastScheduleTime;

    const now = new Date();

    // --- The "Wake Up" Logic ---
    if (scheduleDate && scheduleTime) {
        const [year, month, day] = scheduleDate.split('-').map(Number);
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        const lastScheduledDateTime = new Date(year, month - 1, day, hours, minutes);

        // If the last scheduled time is in the past...
        if (lastScheduledDateTime < now) {
            console.log("Stale schedule found. Resetting to today.");
            // Reset the date to today
            const today = new Date();
            scheduleDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
            // Reset the time to the next full hour
            const nextHour = new Date();
            nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
            scheduleTime = `${nextHour.getHours().toString().padStart(2, '0')}:00`;
        }
    } else {
        // If there's no data at all, set to defaults (today, 16:00)
        const today = new Date();
        scheduleDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
        scheduleTime = '16:00';
    }

    if (dateInput) dateInput.value = scheduleDate;
    if (timeInput) timeInput.value = scheduleTime;
    if (incrementInput) incrementInput.value = data.incrementMinutes || '30';

    updateNextTimeDisplay();
}

/**
 * Reads the current UI values, calculates the next time, and updates the display label.
 */
function updateNextTimeDisplay() {
    const dateInput = document.getElementById('ch-schedule-date');
    const timeInput = document.getElementById('ch-schedule-time');
    const incrementInput = document.getElementById('ch-increment-minutes');
    const nextTimeLabel = document.getElementById('ch-next-time-label');

    if (dateInput && timeInput && incrementInput && nextTimeLabel) {
        const baseDate = dateInput.value;
        const baseTime = timeInput.value;
        const minutesToAdd = parseInt(incrementInput.value, 10);

        if (baseDate && baseTime && !isNaN(minutesToAdd)) {
            const { date: nextDate, time: nextTime } = calculateNextTime(baseDate, baseTime, minutesToAdd);
            nextTimeLabel.textContent = `-> Next post: ${nextDate} at ${nextTime}`;
        } else {
            nextTimeLabel.textContent = '';
        }
    }
}

function showModal() {
    if (!metadataModal) createMetadataModal();
    metadataModal.style.display = 'flex';
    const imageSection = document.getElementById('ch-image-section');
    if (imageSection) {
        imageSection.style.display = imageToUpload ? 'block' : 'none';
    }
}

window.showModal = showModal;

function hideModal() {
    if (metadataModal) metadataModal.style.display = 'none';
}

window.hideModal = hideModal;



/**
 * Automates the entire post scheduling workflow.
 * @param {string} timeValue The time in "HH:mm" format.
 */
async function schedulePost() {
    const baseDate = document.getElementById('ch-schedule-date').value;
    const baseTime = document.getElementById('ch-schedule-time').value;
    const incrementMinutes = parseInt(document.getElementById('ch-increment-minutes').value, 10);

    const { date: dateToSchedule, time: timeToSchedule } = calculateNextTime(baseDate, baseTime, incrementMinutes);
    console.log(`🎯 TARGET: Schedule for ${dateToSchedule} at ${timeToSchedule}`);

    // Parse the target date into components we can use
    const [targetYear, targetMonth, targetDay] = dateToSchedule.split('-');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const targetMonthName = monthNames[parseInt(targetMonth, 10) - 1];

    // 1. Find the clock icon button next to "Publish"
    const scheduleIconButton = document.querySelector('button[data-tour="post:publish"]').parentElement.querySelector('svg').parentElement.parentElement.parentElement;
    if (!scheduleIconButton) throw new Error("Could not find the schedule icon-button.");

    console.log("Clicking the schedule icon-button...");
    scheduleIconButton.click();

    // 2. Wait for the "Schedule your post" modal
    const scheduleModal = await waitForModalWithText("Schedule your post", 5000);
    console.log("✅ Schedule modal is open.");

    // 3. Open the date picker popover
    const dateTimeButton = scheduleModal.querySelector('button[data-dates-input="true"]');
    dateTimeButton.click();
    const datePickerPopover = await waitForInteractiveElement('div[data-dates-dropdown="true"]', 5000);
    console.log("✅ Date picker popover is visible.");

    // --- Deterministic Date Setting ---
    // 4. Navigate to Year selection
    let calendarHeaderLevel = datePickerPopover.querySelector('.mantine-DateTimePicker-calendarHeaderLevel');
    if (!calendarHeaderLevel) throw new Error("Could not find calendar header.");
    console.log(`Current view: ${calendarHeaderLevel.textContent}. Clicking to go to Year view.`);
    calendarHeaderLevel.click();
    await new Promise(r => setTimeout(r, 200)); // Wait for view to switch

    calendarHeaderLevel = datePickerPopover.querySelector('.mantine-DateTimePicker-calendarHeaderLevel');
    console.log(`Current view: ${calendarHeaderLevel.textContent}. Clicking to go to Decade view.`);
    calendarHeaderLevel.click();
    await new Promise(r => setTimeout(r, 200));

    // 5. Select the Year
    console.log(`Searching for year button: "${targetYear}"`);
    const yearButtons = datePickerPopover.querySelectorAll('button');
    const targetYearButton = Array.from(yearButtons).find(b => b.textContent === targetYear);
    if (!targetYearButton) throw new Error(`Could not find year "${targetYear}"`);
    console.log("✅ Found Year button. Clicking it.");
    targetYearButton.click();
    await new Promise(r => setTimeout(r, 200));

    // 6. Select the Month
    console.log(`Searching for month button: "${targetMonthName}"`);
    const monthButtons = datePickerPopover.querySelectorAll('.mantine-DateTimePicker-monthsListControl');
    const targetMonthButton = Array.from(monthButtons).find(b => b.textContent === targetMonthName);
    if (!targetMonthButton) throw new Error(`Could not find month "${targetMonthName}"`);
    console.log("✅ Found Month button. Clicking it.");
    targetMonthButton.click();
    await new Promise(r => setTimeout(r, 200));

    // 7. Select the Day
    console.log(`Searching for day button: "${parseInt(targetDay, 10)}"`);
    const dayButtons = datePickerPopover.querySelectorAll('.mantine-DateTimePicker-day');
    const targetDayButton = Array.from(dayButtons).find(b => b.textContent === String(parseInt(targetDay, 10)) && !b.disabled);
    if (!targetDayButton) throw new Error(`Could not find day "${targetDay}"`);
    console.log("✅ Found Day button. Clicking it.");
    targetDayButton.click();
    await new Promise(r => setTimeout(r, 200));

    // --- Time Setting ---
    // 8. Set the time value
    const timeInput = datePickerPopover.querySelector('input[type="time"]');
    if (!timeInput) throw new Error("Could not find the time input.");
    console.log(`Setting time to: ${timeToSchedule}`);
    setInputValue(timeInput, timeToSchedule);
    await new Promise(r => setTimeout(r, 100));

    // 9. Click the time confirmation checkmark
    const submitTimeButton = datePickerPopover.querySelector('button[class*="DateTimePicker-submitButton"]');
    if (!submitTimeButton) throw new Error("Could not find the time submit button (checkmark).");
    console.log("✅ Found time submit button. Clicking it.");
    submitTimeButton.click();

    await waitForElementToDisappear('div[data-dates-dropdown="true"]', 3000);
    console.log("✅ Date picker popover has closed.");

    // 10. Click the main "Schedule" button
    const finalScheduleButton = Array.from(scheduleModal.querySelectorAll('button')).find(b => b.textContent === 'Schedule');
    if (!finalScheduleButton) throw new Error("Could not find the final 'Schedule' button.");

    // 11. Save the new schedule back to storage for next time
    console.log("✅ Schedule successful (SIMULATED). Saving new date and time to storage...");
    await chrome.storage.local.set({
        lastScheduleDate: dateToSchedule,
        lastScheduleTime: timeToSchedule,
        incrementMinutes: incrementMinutes
    });
    loadScheduleSettings();

    console.log("Clicking the final 'Schedule' button...");
    finalScheduleButton.click(); // Commented out for safe testing

    await waitForModalToDisappearByText("Schedule your post", 5000);
    console.log("✅ Schedule modal has closed. Post is scheduled!");
}

/**
 * Reads the final list of selected image tools from the checkbox UI.
 * @returns {string[]} An array of selected tool names.
 */
function getImageToolDataFromModal() {
    const tools = [];
    // The master list of all checkboxes is the single source of truth.
    const container = document.getElementById('ch-all-image-tools');

    if (container) {
        // Find all checkboxes that are currently checked.
        const checkedBoxes = container.querySelectorAll('input[type="checkbox"]:checked');

        // Extract the tool name from the 'data-tool-name' attribute of each checked box.
        checkedBoxes.forEach(cb => {
            tools.push(cb.dataset.toolName);
        });
    } else {
        console.error("Could not find the image tools container ('ch-all-image-tools') to read data from.");
    }

    console.log("Gathered selected image tools for processing:", tools);
    return tools;
}

/**
 * A dedicated function to add tools ONLY to the image section.
 * @param {string[]} toolList A list of tool names.
 */
async function addImageTools(toolList) {
    if (!imageContainerElement) throw new Error("Cannot add image tools: image container not found.");
    if (toolList.length === 0) return;

    updateStatus(`⏳ Adding ${toolList.length} image tools...`);
    await new Promise(r => setTimeout(r, 200));

    // 1. Find and click the "TOOL" button in the IMAGE container.
    const toolHeader = Array.from(imageContainerElement.querySelectorAll('h3')).find(h => h.textContent.trim() === 'Tools');
    if (!toolHeader) throw new Error("Could not find 'Tools' heading in the image section.");

    const addButtonContainer = toolHeader.parentElement.nextElementSibling;
    const addToolButton = Array.from(addButtonContainer.querySelectorAll('button')).find(b => b.innerText.trim() === 'TOOL');
    if (!addToolButton) throw new Error("Could not find 'TOOL' button for the image.");

    addToolButton.click();
    await new Promise(r => setTimeout(r, 200));

    // 2. Wait for the popover.
    let retries = 0;
    let popover = null;
    while (popover == null && retries < 6)
    {
      try {
        popover = await waitForInteractiveElement('div[id^="headlessui-popover-panel-"]', 5000);
      } catch (error) {
        console.log("Error while waiting for interactiveLement: ", error);
        updateStatus(`⏳ opening tools dialog failed... `);
      }
      if (popover == null){
        updateStatus(`⏳ trying again to open tools dialog. Attempt number: ` + retries);
        retries++;
        addToolButton.click();
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // 3. Select all the tools.
    let selectedCount = 0;
    for (const toolName of toolList) {
        let targetOption = Array.from(popover.querySelectorAll('div[role="option"]')).find(opt => opt.innerText.includes(toolName));
        if (targetOption) {
            const checkboxInput = targetOption.querySelector('input[type="checkbox"]');
            simulateMouseClick(checkboxInput);
            selectedCount++;
            await new Promise(r => setTimeout(r, 200));
        } else {
            console.warn(`Could not find image tool "${toolName}". Skipping.`);
        }
    }
    await new Promise(r => setTimeout(r, 200));

    let retriesClose = 0;
    if (selectedCount === 0) {
        while (retriesClose < 5) {
            try {
                updateStatus(`⏳ Trying to close tools dialog with no selected tools`);
                await new Promise(r => setTimeout(r, 200));
                addToolButton.click(); // Close if nothing was selected
                await new Promise(r => setTimeout(r, 200));
                await waitForElementToDisappear('div[id^="headlessui-popover-panel-"]', 3000);
                return;
            } catch {
                updateStatus(`⏳ Will try to close the tools dialog again. Attempt number: ` + retriesClose);
                await new Promise(r => setTimeout(r, 200));
            }
            retriesClose++;
        }
    }

    // 4. Click "Add" N times.
    const saveButton = Array.from(popover.querySelectorAll('button')).find(b => b.textContent.trim() === 'Add');
    if (!saveButton) throw new Error("Could not find the 'Add' button for image tools.");

    console.log(`😡 Found image tools 'Add' button. Clicking it ${selectedCount} times...`);
     
    let didElementDisappear = false;
    while (retriesClose < 6 && didElementDisappear == false) {
        try {
            for (let i = 0; i < selectedCount; i++) {
                saveButton.click();
                await new Promise(r => setTimeout(r, 100));
            }
            await new Promise(r => setTimeout(r, 200));

            await waitForElementToDisappear('div[id^="headlessui-popover-panel-"]', 3000);
            didElementDisappear = true;
            console.log("✅ Image tools popover closed.");
        } catch {
            updateStatus(`⏳ Saving the selection failed. Attempt number: ` + retriesClose);
        }
        retriesClose++;
    }
}


function waitForImageToolAdded(toolName) {
    return new Promise((resolve, reject) => {
        const timeout = 5000;
        const intervalId = setInterval(() => {
            if (!imageContainerElement) return;
            const toolHeader = Array.from(imageContainerElement.querySelectorAll('h3')).find(h => h.textContent.trim() === 'Tools');
            if (!toolHeader) return;
            // The structure for added tools is different, it's a UL
            const container = toolHeader.parentElement.parentElement.parentElement;
            const addedToolSpans = container.querySelectorAll('ul li span');
            if (Array.from(addedToolSpans).some(span => span.textContent.trim() === toolName)) {
                clearInterval(intervalId);
                clearTimeout(timeoutId);
                resolve(true);
            }
        }, 250);
        const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            reject(new Error(`Verification Timeout: Image tool "${toolName}" did not appear.`));
        }, timeout);
    });
}

/**
 * Reads all LoRA data from the dedicated IMAGE resource section of the modal.
 * @returns {Array<{title: string, version: string}>}
 */
function getImageLoraDataFromModal() {
    const loras = [];
    // These are the correct IDs for the UI we built for the image section
    const rows = document.querySelectorAll('#ch-image-recognized-loras .lora-item, #ch-image-unrecognized-loras .lora-item');

    rows.forEach(row => {
        const titleInput = row.querySelector('.title');
        const versionInput = row.querySelector('.version');

        if (titleInput && versionInput && titleInput.value.trim() !== '') {
            loras.push({
                title: titleInput.value.trim(),
                version: versionInput.value.trim()
            });
        }
    });
    console.log("Found Image LoRAs to add from modal:", loras);
    return loras;
}


/**
 * Populates a specific resource section (video or image) with base model and LoRA data.
 * @param {object} resourceData The data object containing .base_model and .loras properties.
 * @param {string} prefix The prefix for the element IDs ('video' or 'image').
 */
async function populateResourceSection(resourceData, prefix) {
    if (!resourceData) return;

    // Set Base Model
    const baseModelInput = document.getElementById(`ch-${prefix}-base-model`);
    if (baseModelInput) baseModelInput.value = resourceData.base_model || '';

    // Populate LoRAs
    const recognizedContainer = document.getElementById(`ch-${prefix}-recognized-loras`);
    const unrecognizedContainer = document.getElementById(`ch-${prefix}-unrecognized-loras`);
    if (!recognizedContainer || !unrecognizedContainer) return;

    recognizedContainer.innerHTML = '';
    unrecognizedContainer.innerHTML = '';

    const storage = await chrome.storage.local.get('loraMappings');
    const loraMappings = storage.loraMappings || {};

    if (resourceData.loras) {
        for (const filename of resourceData.loras) {
            if (loraMappings[filename]) {
                const knownData = loraMappings[filename];
                createLoraRow(recognizedContainer, { filename, title: knownData.title, version: knownData.version });
            } else {
                createLoraRow(unrecognizedContainer, { filename });
            }
        }
    }

    // Hook up the section-specific 'Add Manual' button
    const addResourceBtn = document.getElementById(`ch-${prefix}-add-resource-btn`);
    if (addResourceBtn) {
        addResourceBtn.onclick = () => {
            createLoraRow(unrecognizedContainer, { filename: '' });
            const newRow = unrecognizedContainer.lastElementChild;
            if (newRow) {
                const filenameInput = newRow.querySelector('.filename');
                filenameInput.removeAttribute('readonly');
                filenameInput.style.backgroundColor = 'white';
                filenameInput.style.color = 'black';
            }
        };
    }
}


/**
 * Populates the image section of the modal with parsed metadata.
 * @param {object} data The parsed data object from readImageMetadata.
 */
async function populateImageModalData(data) {
    if (!data) return;

    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    };

    // Populate the simple fields
    set('ch-image-prompt', data.positive_prompt);
    set('ch-image-neg-prompt', data.negative_prompt);
    set('ch-image-steps', data.steps);
    set('ch-image-sampler', data.sampler_name);
    set('ch-image-guidance', data.cfg);
    set('ch-image-seed', data.seed);

    // Call the new helper to populate the image-specific resource section
    await populateResourceSection(data, 'image');

    const txt2imgRadio = document.getElementById('ch-image-technique-txt2img');
    if (txt2imgRadio) txt2imgRadio.checked = true;

    const selectedContainer = document.getElementById('ch-selected-image-tools');
    const allContainer = document.getElementById('ch-all-image-tools');
    if (!selectedContainer || !allContainer) return;

    selectedContainer.innerHTML = '';
    const preselected = new Set(["ComfyUI"]);

    allContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = preselected.has(cb.dataset.toolName);
    });

    const updateImageSummary = () => {
        selectedContainer.innerHTML = '';
        const checkedInMainList = allContainer.querySelectorAll('input:checked');
        checkedInMainList.forEach(cb => {
            const el = createToolCheckbox(cb.dataset.toolName, 'image-summary');
            el.querySelector('input').checked = true;
            el.addEventListener('change', (e) => {
                const masterCb = allContainer.querySelector(`input[data-tool-name="${cb.dataset.toolName}"]`);
                if (masterCb) masterCb.checked = false;
                updateImageSummary();
            });
            selectedContainer.appendChild(el);
        });
    };

    allContainer.addEventListener('change', updateImageSummary);
    updateImageSummary();

    // Make sure the section is visible
    const imageSection = document.getElementById('ch-image-section');
    if (imageSection) imageSection.style.display = 'block';
}

/**
 * Reads and parses metadata from a ComfyUI PNG file.
 * This version recursively traces the workflow to handle complex, dynamic prompts
 * and varying node structures.
 * @param {File} file The PNG image file to parse.
 * @returns {Promise<object|null>} A promise that resolves with the parsed workflow object, or null.
 */
function readImageMetadata(file) {
    console.log("IMAGE METADATA: " + file);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const buffer = event.target.result;
                const view = new DataView(buffer);

                // Check for PNG signature
                if (view.getUint32(0) !== 0x89504E47 || view.getUint32(4) !== 0x0D0A1A0A) {
                    console.log("Not a valid PNG file.");
                    resolve(null);
                    return;
                }

                let offset = 8;
                let workflowJSON = null;

                // Loop through PNG chunks to find the 'tEXt' chunk with 'prompt' data
                while (offset < view.byteLength) {
                    const length = view.getUint32(offset);
                    const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));

                    if (type === 'tEXt') {
                        const chunkData = new Uint8Array(buffer, offset + 8, length);
                        const decoder = new TextDecoder("utf-8");
                        const text = decoder.decode(chunkData);
                        const [keyword, value] = text.split('\0');

                        if (keyword === 'prompt') {
                            workflowJSON = value;
                            break;
                        }
                    }

                    offset += 12 + length; // Move to the next chunk
                    if (type === 'IEND') break;
                }

                if (!workflowJSON) {
                    console.log("No 'prompt' text chunk found in PNG.");
                    resolve(null);
                    return;
                }

                const cleanJSON = workflowJSON
                    .replace(/:\s*NaN\b/g, ": null")
                    .replace(/:\s*-?Infinity\b/g, ": null"); 

                const workflow = JSON.parse(cleanJSON);
                console.log("IMAGE WORKFLOW: ", workflow);

                // --- Helper function to recursively trace and build the prompt string ---
                const getFullPromptText = (startNodeId, workflow) => {
                    const visited = new Set(); // To prevent infinite loops in complex graphs

                    function trace(nodeId) {
                        if (!nodeId || visited.has(nodeId)) return '';
                        visited.add(nodeId);

                        const node = workflow[nodeId];
                        if (!node) return '';

                        // Base case: The node has a direct text value (e.g., Text Multiline)
                        if (node.inputs && typeof node.inputs.text === 'string') {
                            return node.inputs.text;
                        }

                        // Recursive cases for different node types that manipulate text
                        switch (node.class_type) {
                            case 'CLIPTextEncode':
                                // This handles both old (string) and new (link) workflows
                                if (node.inputs && Array.isArray(node.inputs.text)) {
                                    return trace(node.inputs.text[0]);
                                } else if (node.inputs && typeof node.inputs.text === 'string') {
                                    return node.inputs.text;
                                }
                                break;

                            case 'Text Concatenate': {
                                const delimiter = node.inputs.delimiter || ", ";
                                let parts = [];
                                ['text_a', 'text_b', 'text_c', 'text_d', 'text_e'].forEach(key => {
                                    if (node.inputs[key] && Array.isArray(node.inputs[key])) {
                                        parts.push(trace(node.inputs[key][0]));
                                    }
                                });
                                return parts.filter(p => p).join(delimiter);
                            }

                            case 'ImpactSwitch': {
                                if (!node.inputs.select || !Array.isArray(node.inputs.select)) return '';
                                
                                const selectorNodeId = node.inputs.select[0];
                                const selectorNode = workflow[selectorNodeId];
                                
                                if (selectorNode && selectorNode.inputs && 'value' in selectorNode.inputs) {
                                    const selectedIndex = selectorNode.inputs.value;
                                    const selectedInputName = `input${selectedIndex}`;
                                    if (node.inputs[selectedInputName] && Array.isArray(node.inputs[selectedInputName])) {
                                        return trace(node.inputs[selectedInputName][0]);
                                    }
                                }
                                return '';
                            }
                        }
                        return ''; // Return empty string if no text can be resolved
                    }
                    return trace(startNodeId);
                };

                // --- Helper function to trace the model/LoRA chain ---
                const traceModelChain = (startNode, workflow) => {
                    const resources = { base_model: null, loras: [] };
                    let currentNode = startNode;
                    let visited = new Set(); // Prevent loops

                    while (currentNode) {
                        const currentNodeId = Object.keys(workflow).find(key => workflow[key] === currentNode);
                        if (!currentNodeId || visited.has(currentNodeId)) break;
                        visited.add(currentNodeId);

                        const isBypassed = currentNode.mode === 2 || currentNode.mode === 4;

                        if (!isBypassed) {
                            if (currentNode.class_type === 'LoraLoader') {
                                resources.loras.push(currentNode.inputs.lora_name);
                            } else if (currentNode.class_type === 'CheckpointLoaderSimple') {
                                resources.base_model = currentNode.inputs.ckpt_name;
                                break; // Found the root checkpoint
                            }
                        }

                        if (currentNode.inputs && currentNode.inputs.model && Array.isArray(currentNode.inputs.model)) {
                            const modelInputNodeId = currentNode.inputs.model[0];
                            currentNode = workflow[modelInputNodeId];
                        } else {
                            break; // End of the chain
                        }
                    }
                    resources.loras.reverse(); // Order from checkpoint to KSampler
                    return resources;
                };

                // --- Main Parsing Logic ---

                // 1. Find the final SaveImage node
                const saveImageNodeId = Object.keys(workflow).find(id => workflow[id].class_type === 'SaveImage');
                if (!saveImageNodeId) {
                    console.log("Could not find SaveImage node in the workflow.");
                    resolve(null);
                    return;
                }

                // 2. Trace backwards from SaveImage to find the KSampler
                const findUpstreamAncestor = (startNodeId, targetClassType) => {
                    const queue = [startNodeId];
                    const visited = new Set();
                    while (queue.length > 0) {
                        const currentId = queue.shift();
                        if (!currentId || visited.has(currentId)) continue;
                        visited.add(currentId);

                        const node = workflow[currentId];
                        if (!node) continue;
                        if (node.class_type === targetClassType) return { id: currentId, node: node };
                        
                        if (node.inputs) {
                            for (const input of Object.values(node.inputs)) {
                                if (Array.isArray(input) && typeof input[0] === 'string') {
                                    queue.push(input[0]);
                                }
                            }
                        }
                    }
                    return null;
                };
                
                const ksamplerInfo = findUpstreamAncestor(saveImageNodeId, 'KSampler');

                if (!ksamplerInfo) {
                    console.log("Could not trace back to a KSampler node.");
                    resolve(null);
                    return;
                }
                
                const ksamplerNode = ksamplerInfo.node;
                const ksamplerInputs = ksamplerNode.inputs;
                console.log("Found KSampler node:", ksamplerInfo.id, ksamplerNode);

                // 3. Get positive and negative prompts using the new recursive function
                const posPromptNodeKey = ksamplerInputs.positive[0];
                const negPromptNodeKey = ksamplerInputs.negative[0];
                
                const positive_prompt = getFullPromptText(posPromptNodeKey, workflow);
                const negative_prompt = getFullPromptText(negPromptNodeKey, workflow);

                console.log("Extracted positive prompt:", positive_prompt);
                console.log("Extracted negative prompt:", negative_prompt);

                // 4. Get base model and LoRAs
                const modelResources = traceModelChain(ksamplerNode, workflow);

                const parsedData = {
                    positive_prompt,
                    negative_prompt,
                    steps: ksamplerInputs.steps,
                    sampler_name: ksamplerInputs.sampler_name,
                    scheduler: ksamplerInputs.scheduler,
                    cfg: ksamplerInputs.cfg,
                    seed: ksamplerInputs.seed,
                    base_model: modelResources.base_model,
                    loras: modelResources.loras,
                };

                console.log("✅ Successfully parsed PNG workflow:", parsedData);
                resolve(parsedData);

            } catch (error) {
                console.error("Failed to parse PNG metadata:", error);
                reject(error);
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Automates adding a single Technique to the post. This is a single-select action.
 * @param {string} techniqueName The name of the technique to select (e.g., "img2vid").
 */
async function addTechnique(techniqueName, containerElement) {
    if (!containerElement) throw new Error("Video container element not found.");
    await new Promise(r => setTimeout(r, 200));

    // 1. Find and click the "TECHNIQUE" button.
    console.log("Finding 'TECHNIQUE' button...");
    const header = Array.from(containerElement.querySelectorAll('h3')).find(h => h.textContent.trim() === 'Techniques');
    if (!header) throw new Error("Could not find the 'Techniques' heading.");

    // The button is in a sibling div to the header's container.
    const buttonContainer = header.parentElement.nextElementSibling;
    if (!buttonContainer) throw new Error("Could not find container for 'TECHNIQUE' button.");
    const addButton = Array.from(buttonContainer.querySelectorAll('button')).find(b => b.innerText.trim() === 'TECHNIQUE');
    if (!addButton) throw new Error("Could not find the 'TECHNIQUE' button.");

    addButton.click();
    console.log("✅ Clicked 'TECHNIQUE' button.");
    await new Promise(r => setTimeout(r, 250));

    // 2. Wait for the popover to appear.
    const popoverSelector = 'div[id^="headlessui-popover-panel-"]';
    const popover = await waitForInteractiveElement(popoverSelector, 5000);
    console.log("✅ Techniques popover is visible.");
    await new Promise(r => setTimeout(r, 250));

    // 3. Find and click the correct option. The text is in a direct child span.
    const allOptions = popover.querySelectorAll('div[role="option"]');
    const targetOption = Array.from(allOptions).find(opt => opt.querySelector('span')?.textContent.trim().toLowerCase() === techniqueName.toLowerCase());

    if (targetOption) {
        console.log(`Found technique "${techniqueName}". Clicking it.`);
        simulateMouseClick(targetOption);
        await new Promise(r => setTimeout(r, 200)); // Brief pause for state to update
    } else {
        addButton.click(); // Close the popover to avoid getting stuck
        throw new Error(`Could not find the technique option for "${techniqueName}"`);
    }

    // 4. Find the "Add" button that has appeared and click it.
    const saveButton = Array.from(popover.querySelectorAll('button')).find(b => b.textContent.trim() === 'Add');
    if (!saveButton) throw new Error("Could not find the 'Add' button in the techniques popover.");

    let retiresClose = 0;
    let didElementDisappear = false;

    while (retiresClose < 6 && didElementDisappear == false) {
        console.log("😡 Found 'Add' button. Clicking it.");
        saveButton.click();

        // 5. Wait for the popover to disappear.
        try {
        await waitForElementToDisappear(popoverSelector, 3000);
        } catch (error) {
            console.log("Error while waiting got the Image techniques popup to disappear... retrying");
        }
        didElementDisappear = true;
        retiresClose++;
        console.log("✅ Techniques popover has closed.");
    }
}

/**
 * Waits and polls the page to verify that a technique has been added.
 * @param {string} techniqueName The name of the technique to look for.
 * @returns {Promise<true>}
 */
function waitForTechniqueAdded(techniqueName, containerElement) {
    return new Promise((resolve, reject) => {
        const timeout = 5000;
        const checkInterval = 250;
        const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            reject(new Error(`Verification Timeout: Technique "${techniqueName}" did not appear on the page within ${timeout}ms. in:`, containerElement));
        }, timeout);

        const intervalId = setInterval(() => {
            if (!containerElement) return;
            const header = Array.from(containerElement.querySelectorAll('h3')).find(h => h.textContent.trim() === 'Techniques');
            if (!header) return;

            const container = header.parentElement.parentElement.parentElement;
            if (!container) return;

            // Find all spans inside list items. This is robust.
            const addedElements = container.querySelectorAll('span');
            const isPresent = Array.from(addedElements).some(span => span.textContent.trim().toLowerCase() === techniqueName.toLowerCase());

            if (isPresent) {
                clearInterval(intervalId);
                clearTimeout(timeoutId);
                resolve(true);
            }
        }, checkInterval);
    });
}


/**
 * Waits and polls the page to verify that a resource has been successfully added.
 * @param {string} resourceName The name of the resource to look for.
 * @param {number} timeout The total time to wait in milliseconds.
 * @returns {Promise<boolean>} A promise that resolves to true if found, or rejects if it times out.
 */
function waitForResourceAdded(resourceName, timeout, containerElement) {
    return new Promise((resolve, reject) => {
        const checkInterval = 250;
        const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            reject(new Error(`Verification Timeout: Resource "${resourceName}" did not appear on the page within ${timeout}ms.`));
        }, timeout);

        const intervalId = setInterval(() => {
            if (!containerElement) return;
            const resourceHeader = Array.from(containerElement.querySelectorAll('h3')).find(h => h.textContent.trim() === 'Resources');
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
    if (toolList.length === 0) return
    await new Promise(r => setTimeout(r, 200));

    // 1. Find the "TOOL" button specifically in the "Tools" section. No variables.
    console.log("Finding 'TOOL' button...");
    const toolHeader = Array.from(videoContainerElement.querySelectorAll('h3')).find(h => h.textContent.trim() === 'Tools');
    if (!toolHeader) throw new Error("Could not find the 'Tools' heading.");

    const addButtonContainer = toolHeader.parentElement.nextElementSibling;
    if (!addButtonContainer) throw new Error("Could not find the container for the 'TOOL' button.");
    const addToolButton = Array.from(addButtonContainer.querySelectorAll('button')).find(b => b.innerText.trim() === 'TOOL');
    if (!addToolButton) throw new Error("Could not find the 'TOOL' button.");

    await new Promise(r => setTimeout(r, 500));
    addToolButton.click();
    await new Promise(r => setTimeout(r, 500));
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
async function addResourcesFromList(loraList, containerElement) {
    if (!containerElement) throw new Error("Container element not provided to addResourcesFromList.");
    console.log(`😡 Angry Helper starting to add ${loraList.length} resources...`);

    for (const lora of loraList) {
        let success = false;
        const MAX_ATTEMPTS = 3;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            // Check if it's already on the page before we start
            const resourceLinks = containerElement.querySelectorAll('a');
            const alreadyExists = Array.from(resourceLinks).some(link => link.innerText.includes(lora.title));
            if (alreadyExists) {
                console.log(`Resource "${lora.title}" is already present. Skipping.`);
                success = true;
                break;
            }

            console.log(`Attempt ${attempt}/${MAX_ATTEMPTS} to add resource "${lora.title}"`);
            try {
                await addSingleResource(lora.title, lora.version, containerElement);
                await waitForResourceAdded(lora.title, 5000, containerElement);

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
async function addSingleResource(resourceName, resourceVersion, containerElement) {
    if (!containerElement) throw new Error("Container element not provided to addSingleResource.");

    // 1. Find and click the "ADD RESOURCE" button
    console.log(`Finding 'ADD RESOURCE' button...`);
    const allH3s = Array.from(containerElement.querySelectorAll('h3'));
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
            // Step 1: Click to open the dropdown.
            console.log(`Attempting to open version dropdown for "${resourceVersion}"...`);
            simulateMouseClick(versionInput);
            await new Promise(r => setTimeout(r, 100));

            // Step 2: Get the precise screen position of the input we just clicked.
            const inputRect = versionInput.getBoundingClientRect();

            // Step 3: Get ALL currently visible dropdowns on the entire page.
            const allDropdowns = Array.from(document.querySelectorAll('div.mantine-Select-dropdown'))
                .filter(d => window.getComputedStyle(d).opacity === '1');

            if (allDropdowns.length === 0) throw new Error("No visible version dropdowns found after clicking.");

            // Step 4: Loop through them and find the one that is physically closest to our input.
            let closestDropdown = null;
            let minDistance = Infinity;

            for (const dropdown of allDropdowns) {
                const dropRect = dropdown.getBoundingClientRect();
                // Calculate the vertical distance between the bottom of the input and the top of the dropdown.
                const distance = Math.abs(dropRect.top - inputRect.bottom);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestDropdown = dropdown;
                }
            }

            if (!closestDropdown) throw new Error("Could not determine the closest dropdown to the version input.");

            const versionDropdown = closestDropdown;
            console.log("✅ Found the correct version dropdown by proximity.");

            // Step 5: Now that we have the correct dropdown, find our specific version and click it.
            // Find the specific version option inside the dropdown
            let targetVersionOption = null;
            let attempts = 20; // Try for 2 seconds
            while (attempts > 0) {
                const allVersionOptions = versionDropdown.querySelectorAll('div[data-combobox-option]');

                // Find the option where the direct child SPAN's text matches exactly.
                targetVersionOption = Array.from(allVersionOptions).find(opt => {
                    const span = opt.querySelector('span');
                    return span && span.textContent.trim().toLowerCase() === resourceVersion.trim().toLowerCase();
                });

                if (targetVersionOption) {
                    console.log(`✅ Found version option "${resourceVersion}" in dropdown.`);
                    break;
                }
                await new Promise(r => setTimeout(r, 100));
                attempts--;
            }

            if (targetVersionOption) {
                console.log(`Found version option. Clicking it.`);
                simulateMouseClick(targetVersionOption);
                // Wait for the dropdown to disappear to confirm selection
                await new Promise(r => setTimeout(r, 100));
            } else {
                console.warn(`Could not find version "${resourceVersion}" in the dropdown. The default will be used.`);
                // Click outside the dropdown to close it gracefully
                document.body.click();
                await new Promise(r => setTimeout(r, 100));
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
        let checkInterval = 100; // Check every 100ms
        let timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            reject(new Error(`Timeout: Interactive element "${selector}" did not appear within ${timeout}ms.`));
        }, timeout);

        let intervalId = setInterval(() => {
            let element = document.querySelector(selector);
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
    await new Promise(r => setTimeout(r, 300));
    // STEP 2: Wait for the dropdown to be ready.
    const dropdownSelector = 'div[aria-labelledby="input_sampler-label"]';
    await waitForInteractiveElement(dropdownSelector, 5000);
    console.log("✅ Sampler dropdown is interactive.");
    await new Promise(r => setTimeout(r, 300));

    // STEP 3: Type the search term to trigger the filter.
    await typeCharacterByCharacter(samplerInput, samplerName);
    console.log(`Finished typing "${samplerName}".`);

    // A brief pause to ensure the filter has been fully applied.
    await new Promise(r => setTimeout(r, 300));

    // STEP 4: Simulate pressing the "Arrow Down" key to highlight the first (and only) result.
    console.log("Simulating 'ArrowDown' key press...");
    samplerInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    samplerInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
    await new Promise(r => setTimeout(r, 300));

    // if the sampler was "Euler" ... it needs two key downs as the first is euler a... and the second is euler
    if (samplerName.toLowerCase() == "euler") {
        console.log("Simulating SECOND 'ArrowDown' key press...");
        samplerInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
        await new Promise(r => setTimeout(r, 300));
        samplerInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
        await new Promise(r => setTimeout(r, 300));
    }

    // STEP 5: Simulate pressing the "Enter" key to select the highlighted option.
    console.log("Simulating 'Enter' key press...");
    samplerInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    samplerInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 300));

    console.log("Simulating 'Enter' key press...");
    samplerInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));

    // Give the component a moment to visually update from the 'Enter' key.
    await new Promise(r => setTimeout(r, 250));

    // Clicking the modal title is a safe and reliable way to do this.
    console.log("😡 FORCING BLUR to commit sampler state...");
    const modalTitle = modal.querySelector('.mantine-Modal-title');
    if (modalTitle) {
        modalTitle.click();
    } else {
        // Fallback if title isn't found for some reason
        samplerInput.blur();
    }

    // Give the component another moment to process the blur event and lock in the state.
    await new Promise(r => setTimeout(r, 100));
    console.log("✅ Sampler state should now be committed.");
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

                // Sanitize the prompts after they come back from the sandbox.
                console.log("Sanitizing video prompts...");
                extractedData.positive_prompt = sanitizePrompt(extractedData.positive_prompt);
                extractedData.negative_prompt = sanitizePrompt(extractedData.negative_prompt);

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
    if (banner && !isBannerScootchedOver) {
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
    // The buttons should be enabled if a video OR an image is present.
    const enabled = videoToUpload || imageToUpload;
    uploadButton.disabled = !enabled;
    autoPostButton.disabled = !enabled;
    scheduleButton.disabled = !enabled;
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

imageInput.addEventListener('change', async () => {
    imageToUpload = imageInput.files.length > 0 ? imageInput.files[0] : null;
    checkUploadability();

    const imageSection = document.getElementById('ch-image-section');
    if (imageSection) imageSection.style.display = 'block';

    if (imageToUpload) {
        if (!metadataModal) createMetadataModal();
        try {
            updateStatus("⏳ Reading image metadata...");
            const metadata = await readImageMetadata(imageToUpload);

            if (metadata) {
                // This single call now handles everything for the image section
                await populateImageModalData(metadata);
                updateStatus("✅ Image metadata parsed.");
            } else {
                if (imageSection) imageSection.style.display = 'block';
                updateStatus("ℹ️ No generation metadata found in image.");
            }
        } catch (error) {
            console.error("Error processing image metadata:", error);
            if (imageSection) imageSection.style.display = 'block';
            updateStatus("❌ Failed to read image metadata.", true);
        }
    } else {
        if (imageSection) imageSection.style.display = 'none';
        updateStatus("");
    }
});

uploadButton.addEventListener('click', () => {
    isAutoPostMode = false;
    isSchedulePostMode = false;
    runUploadOrchestrator();
});

autoPostButton.addEventListener('click', () => {
    isAutoPostMode = true;
    isSchedulePostMode = false;
    runUploadOrchestrator();
});


// --- The Orchestrator ---
// Manages the overall upload process for video and optional image
// by coordinating the lifecycle manager for each file.
// Handles UI state transitions and error reporting.
async function runUploadOrchestrator() {
    if (!videoToUpload && !imageToUpload) return;

    uploadButton.style.display = 'none';
    openDetailsButton.style.display = 'inline-block';
    retryBannerButton.style.display = 'none';
    document.getElementById('ch-modal-post-btn').disabled = true;
    showModal();

    setBannerToWorkingState();
    uploadButton.disabled = true; // Prevent double clicks
    autoPostButton.disabled = true;
    scheduleButton.disabled = true;

    try {
        let grandparentContainer = null;
        const dryProgressSelector = 'div.w-full:has(.mantine-Dropzone-root) + div.mantine-Progress-root';

        // Run the video lifecycle IF a video was provided.
        if (videoToUpload) {
            // --- VIDEO LIFECYCLE ---
            // Step 1: Upload Video and get the "Grandparent" container
            const videoResult = await manageUploadLifecycle({
                file: videoToUpload,
                name: 'Video',
                progressSelector: dryProgressSelector,
                successSelector: 'video[class*="EdgeMedia_responsive"]'
            });
            grandparentContainer = videoResult.container;
            console.log("✅ Grandparent container captured.", grandparentContainer);
        }

        // --- IMAGE LIFECYCLE (only if an image is provided) ---
        // Step 2: Upload Image (if provided)
        if (imageToUpload) {
            const imageResult = await manageUploadLifecycle({
                file: imageToUpload,
                name: 'Image',
                progressSelector: dryProgressSelector,
                successSelector: 'img[class*="EdgeImage_image"]'
            });
            // If we didn't get it from the video, get it from the image
            if (!grandparentContainer) {
                grandparentContainer = imageResult.container;
                console.log("✅ Grandparent container captured from image upload.");
            }
        }

        if (!grandparentContainer) {
            throw new Error("FATAL: Could not capture the grandparent container after uploads.");
        }

        // Step 3: Find the Content Area.
        // It's the direct child of the Grandparent that contains the video element.
        let contentArea = null;
        for (const child of grandparentContainer.children) {
            if (child.querySelector('video')) {
                contentArea = child;
                break;
            }
            if (!contentArea && imageToUpload && child.querySelector('img')) {
                contentArea = child;
                break;
            }
        }
        if (!contentArea) throw new Error("FATAL: Could not find the main content area div.");
        console.log("✅ Found main content area.", contentArea);

        // Step 4: Find the specific containers by iterating through the DIRECT children of the Content Area.
        for (const child of contentArea.children) {
            // Check if this direct child contains a video.
            if (child.querySelector('video')) {
                videoContainerElement = child;
                console.log("✅ Video container element captured.", videoContainerElement);
            }
            // Check if this direct child contains an image.
            if (imageToUpload && child.querySelector('img')) {
                imageContainerElement = child;
                console.log("✅ Image container element captured.", imageContainerElement);
            }
        }

        if (isAutoPostMode) {
            console.log("🤖 Auto Post mode enabled. Starting automation immediately.");
            document.getElementById('ch-modal-post-btn').disabled = false;
            hideModal();
            setTimeout(handleStartButtonClick, 500);
        } else {
            // Manual mode: behave as before
            document.getElementById('ch-modal-post-btn').disabled = false;
            openDetailsButton.style.display = 'inline-block';
            updateStatus('Uploads complete! You can now open details to fill the form.');
        }

    } catch (error) {
        // Gracefully handle our specific interruption error
        if (error.message === "AUTO-POST_INTERRUPTED") {
            updateStatus("🤖 Auto-post paused. Please add LoRA mappings.", false);
            openDetailsButton.style.display = 'inline-block';
            return;
        }
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
