console.log("✅ Hello from the Civitai Helper content script!");

let videoToUpload = null;
let imageToUpload = null;

// --- UI CREATION ---
const banner = document.createElement('div');
banner.innerHTML = `
  <span style="font-weight: bold;">Civitai Helper:</span>
  <span style="margin-left: 15px;">Video:</span>
`;
banner.style.position = 'fixed'; banner.style.bottom = '0'; banner.style.left = '0'; banner.style.width = '100%'; banner.style.padding = '10px'; banner.style.backgroundColor = '#2c3e50'; banner.style.color = 'white'; banner.style.textAlign = 'center'; banner.style.zIndex = '9999'; banner.style.fontFamily = 'sans-serif'; banner.style.fontSize = '16px';
document.body.append(banner);

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

// --- LOGIC ---

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

// --- The Master Orchestrator (using async/await for clarity) ---

async function runUploadOrchestrator() {
  if (!videoToUpload) return;
  
  uploadButton.disabled = true; // Prevent double clicks

  try {
    const dryProgressSelector = 'div.w-full:has(.mantine-Dropzone-root) + div.mantine-Progress-root';
    // --- VIDEO LIFECYCLE ---
    await manageUploadLifecycle({
      file: videoToUpload,
      name: 'Video',
      progressSelector:dryProgressSelector,
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

    banner.textContent = '✅ All uploads complete! You can now fill out the form.';

  } catch (error) {
    console.error('Orchestrator failed:', error);
    banner.textContent = `❌ ${error.message}`;
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
      banner.textContent = `⏳ Uploading ${config.name}... (Attempt ${attempt}/${MAX_RETRIES})`;
      triggerUpload([config.file]);

      // 2. MONITOR PROGRESS (Wait for progress bar to appear, then disappear)
      await waitForElement(config.progressSelector, 15000); // 15s timeout to appear
      banner.textContent = `⏳ Processing ${config.name}...`;
      await waitForElementToDisappear(config.progressSelector, 120000); // 2min timeout to disappear

      // 3. VERIFY OUTCOME (Wait for the final element to appear)
      banner.textContent = `⏳ Verifying ${config.name}...`;
      await waitForElement(config.successSelector, 60000); // 60s grace period

      // If all awaits complete without throwing an error, the upload was a success!
      console.log(`✅ ${config.name} upload successful on attempt ${attempt}.`);
      return; // Exit the loop and the function successfully

    } catch (error) {
      console.warn(`Attempt ${attempt} for ${config.name} failed:`, error.message);
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
