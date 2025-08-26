// This is the new content for popup.js
document.addEventListener('DOMContentLoaded', () => {
    const mappingsContainer = document.getElementById('mappingsContainer');
    const addNewButton = document.getElementById('addNewButton');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');

    // --- Core Functions ---

    function showStatus(message) {
        statusDiv.textContent = message;
        setTimeout(() => statusDiv.textContent = '', 3000);
    }

    // Creates a single row of inputs for a mapping
    function createMappingItem(filename = '', title = '', version = '') {
        const item = document.createElement('div');
        item.className = 'mapping-item';

        item.innerHTML = `
            <div>
                <label>Filename:</label>
                <input type="text" class="filename" value="${filename}" placeholder="lora_v1.safetensors">
            </div>
            <div>
                <label>Civitai Title:</label>
                <input type="text" class="title" value="${title}" placeholder="My Awesome LoRA">
            </div>
            <div>
                <label>Version:</label>
                <input type="text" class="version" value="${version}" placeholder="v1.0">
            </div>
            <button class="delete-btn">X</button>
        `;

        // Add event listener to the new delete button
        item.querySelector('.delete-btn').addEventListener('click', () => {
            item.remove();
        });

        mappingsContainer.appendChild(item);
    }

    // Reads all the input fields from the UI and saves them to storage
async function saveMappings() {
    const mappings = {};
    const items = mappingsContainer.querySelectorAll('.mapping-item');

    for (const item of items) {
        const filename = item.querySelector('.filename').value.trim();
        const title = item.querySelector('.title').value.trim();
        const version = item.querySelector('.version').value.trim();

        // The key is to only add to the object if a filename exists
        if (filename) {
            mappings[filename] = { title, version };
        }
    }

    try {
        await chrome.storage.local.set({ loraMappings: mappings });
        showStatus('Mappings saved successfully!');
    } catch (error) {
        showStatus(`Error saving: ${error.message}`);
    }
}

    // Loads mappings from storage and populates the UI
async function loadMappings() {
    // This is the correct way to get the data
    const result = await chrome.storage.local.get('loraMappings');
    const mappings = result.loraMappings || {};

    // Clear any existing UI items before loading new ones
    mappingsContainer.innerHTML = '';

    if (Object.keys(mappings).length === 0) {
        // If there are no saved mappings, create one empty row for the user to start
        createMappingItem();
    } else {
        // Loop through the saved data and create a UI row for each entry
        for (const [filename, data] of Object.entries(mappings)) {
            createMappingItem(filename, data.title, data.version);
        }
    }
}

    // --- Event Listeners ---

    addNewButton.addEventListener('click', () => createMappingItem());
    saveButton.addEventListener('click', saveMappings);
    
    // Initial load
    loadMappings();
});