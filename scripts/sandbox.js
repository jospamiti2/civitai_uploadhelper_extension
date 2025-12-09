let mediaInfoInstance = null;

/**
 * Parses the ComfyUI metadata comment from a media file.
 *
 * @param {string} commentData The raw comment string containing the workflow JSON.
 * @returns {object|null} A structured object with extracted metadata, or null if parsing fails.
 */
function parseComfyMetadata(commentData) {
    // console.log("CommentData: " + commentData); // Optional: Keep for debugging
    if (!commentData) {
        return null;
    }

    try {
        // 1. Double-parse the JSON data
        // Handle potential NaN values which are valid in Python/Comfy but invalid in standard JSON
        const outerMetadata = JSON.parse(commentData.replaceAll(': NaN', ': null'));
        const executedGraph = outerMetadata.prompt ? JSON.parse(outerMetadata.prompt) : {};
        const fullWorkflow = outerMetadata.workflow;

        // Create a lookup for workflow nodes (UI side)
        const workflowNodeMap = fullWorkflow?.nodes ? fullWorkflow.nodes.reduce((acc, node) => {
            acc[node.id] = node;
            return acc;
        }, {}) : {};

        // --- Helper: BFS to find all ancestor nodes ---
        const findAllAncestors = (startNodeId, graph) => {
            const ancestors = new Map();
            const queue = [startNodeId];
            const visited = new Set();

            while (queue.length > 0) {
                const currentId = queue.shift();
                if (!currentId || visited.has(currentId)) continue;
                visited.add(currentId);

                const node = graph[currentId];
                if (!node) continue;

                ancestors.set(currentId, node);

                if (node.inputs) {
                    for (const input of Object.values(node.inputs)) {
                        if (Array.isArray(input) && typeof input[0] === 'string') {
                            queue.push(input[0]);
                        }
                    }
                }
            }
            return Array.from(ancestors.values());
        };

        // --- Helper: Recursively resolve input values (Fixes the crash) ---
        // If a value is ["123", 0], it looks up node 123 and tries to find the actual primitive value
        const resolveValue = (val, depth = 0) => {
            if (depth > 5) return val; // Prevent infinite loops
            
            // If it's a link (Array [nodeId, slotIndex])
            if (Array.isArray(val) && val.length === 2 && typeof val[0] === 'string' && executedGraph[val[0]]) {
                const sourceNode = executedGraph[val[0]];
                
                // Common keys where primitives store their actual data
                const primitiveKeys = ['value', 'text', 'string', 'seed', 'noise_seed', 'int', 'float', 'val'];
                
                for (const key of primitiveKeys) {
                    if (sourceNode.inputs && sourceNode.inputs[key] !== undefined) {
                        return resolveValue(sourceNode.inputs[key], depth + 1);
                    }
                }
                // If we found a node but couldn't guess the input, return the original link or the node itself? 
                // Returning the original val ensures we don't return undefined.
                return val; 
            }
            
            return val;
        };

        // --- Helper: Trace upstream to find the Prompt Node ---
        const findUpstreamSourceNode = (startNodeId, inputName) => {
            let currentNode = executedGraph[startNodeId];
            if (!currentNode) return null;

            let link = currentNode?.inputs?.[inputName];

            // Traverse backwards
            while (link && Array.isArray(link) && executedGraph[link[0]]) {
                const parentNodeId = link[0];
                const parentNode = executedGraph[parentNodeId];

                // If found a Text Encode, we are done
                if (parentNode.class_type === 'CLIPTextEncode' || parentNode.class_type === 'NetworkTextEncode') {
                    return parentNode;
                }
                
                // Continue tracing if the input names match (e.g., passing "positive" through a switch or reroute)
                // Note: WanImageToVideo uses 'positive', CLIPText uses 'text'. 
                // If the input name changes, we stop at the node *before* the name change (which is usually what we want)
                if (parentNode.inputs && parentNode.inputs[inputName]) {
                    link = parentNode.inputs[inputName];
                } else {
                    return parentNode; // Found the end of the chain for this specific input name
                }
            }
            return currentNode;
        };

        // 2. Find Samplers (Including WanImageToVideo if it acts as a generator)
        const samplerNodes = Object.values(executedGraph).filter(node =>
            node.class_type === "KSampler" || 
            node.class_type === "KSamplerAdvanced" ||
            node.class_type === "WanImageToVideo" // Wan often acts as the main generator
        );

        if (samplerNodes.length === 0) {
            return null; 
        }

        // --- Identify Final Sampler ---
        const vaeDecodeNode = Object.values(executedGraph).find(node => node.class_type === 'VAEDecode');
        let finalSampler = null;
        let finalSamplerId = null;

        if (vaeDecodeNode && vaeDecodeNode.inputs.samples) {
            // Standard flow: VAE Decode -> Sampler
            finalSamplerId = vaeDecodeNode.inputs.samples[0];
            finalSampler = executedGraph[finalSamplerId];
        } else {
            // Fallback (e.g., VHS_VideoCombine connected directly to latent or special workflows)
            // Sort by ID is a crude but often effective heuristic for "last added" in simple workflows, 
            // but finding the one that isn't input to another sampler is better.
            const allLatentInputs = new Set();
            samplerNodes.forEach(node => {
                if (node.inputs.latent_image) allLatentInputs.add(node.inputs.latent_image[0]);
                if (node.inputs.samples) allLatentInputs.add(node.inputs.samples[0]);
            });
            
            // The sampler whose ID is NOT in anyone else's input list is likely the final one
            const finalCandidates = samplerNodes.filter(node => 
                !allLatentInputs.has(Object.keys(executedGraph).find(key => executedGraph[key] === node))
            );
            
            if (finalCandidates.length > 0) {
                finalSampler = finalCandidates[0];
                finalSamplerId = Object.keys(executedGraph).find(key => executedGraph[key] === finalSampler);
            } else {
                // Last ditch: last sampler in list
                finalSampler = samplerNodes[samplerNodes.length - 1];
                finalSamplerId = Object.keys(executedGraph).find(key => executedGraph[key] === finalSampler);
            }
        }

        if (!finalSampler) return null;

        // Find the first sampler for the seed (in case of refiners)
        const samplerAncestors = findAllAncestors(finalSamplerId, executedGraph);
        const samplerChain = samplerAncestors.filter(node =>
            node.class_type === "KSampler" || 
            node.class_type === "KSamplerAdvanced" ||
            node.class_type === "WanImageToVideo"
        );
        // Add self if not found in ancestors (single sampler case)
        if (!samplerChain.includes(finalSampler)) samplerChain.push(finalSampler);
        
        // Use logic: First in chain (furthest upstream) usually holds the initial seed
        // Ancestors are usually returned closest-first, so we reverse or check inputs
        const firstSampler = samplerChain.length > 1 ? samplerChain[samplerChain.length - 1] : finalSampler;


        // 3. Extract core generation parameters
        const extractedData = {
            seed: resolveValue(firstSampler.inputs.seed || firstSampler.inputs.noise_seed),
            steps: resolveValue(finalSampler.inputs.steps),
            cfg: resolveValue(finalSampler.inputs.cfg),
            sampler_name: resolveValue(finalSampler.inputs.sampler_name),
            scheduler: resolveValue(finalSampler.inputs.scheduler),
            denoise: resolveValue(finalSampler.inputs.denoise),
            positive_prompt: '',
            negative_prompt: '',
            technique: 'txt2img',
            resources: {
                base_models: [],
                loras: [],
                vae: null,
                clip: null
            }
        };

        // 4. Trace Prompts (Positive/Negative)
        const positivePromptNode = findUpstreamSourceNode(finalSamplerId, 'positive');
        if (positivePromptNode) {
            // Check 'text' (standard) or 'text_g'/'text_l' (SDXL) or 'value' (Primitives)
            const rawVal = positivePromptNode.inputs.text || positivePromptNode.inputs.text_g || positivePromptNode.inputs.value;
            extractedData.positive_prompt = resolveValue(rawVal);
            
            // Handle array of strings (concatenation)
            if (Array.isArray(extractedData.positive_prompt)) {
                // If resolving failed to find a primitive string, it might return the array.
                // We join it just in case, or default to empty to prevent .toLowerCase() crash
                extractedData.positive_prompt = extractedData.positive_prompt.join(' ');
            }
        }

        const negativePromptNode = findUpstreamSourceNode(finalSamplerId, 'negative');
        if (negativePromptNode) {
            const rawVal = negativePromptNode.inputs.text || negativePromptNode.inputs.text_g || negativePromptNode.inputs.value;
            extractedData.negative_prompt = resolveValue(rawVal);
            
            if (Array.isArray(extractedData.negative_prompt)) {
                extractedData.negative_prompt = extractedData.negative_prompt.join(' ');
            }
        }
        
        // Ensure they are strings to prevent crash
        if (typeof extractedData.positive_prompt !== 'string') extractedData.positive_prompt = "";
        if (typeof extractedData.negative_prompt !== 'string') extractedData.negative_prompt = "";


        // 5. Trace Resources (Models/LoRAs)
        // We look at ALL ancestors of the final sampler to catch everything used
        for (const node of samplerAncestors) {
             const nodeId = Object.keys(executedGraph).find(key => executedGraph[key] === node);
             const workflowNode = workflowNodeMap[nodeId];
             
             // Skip bypassed nodes (mode 4 is Mute/Bypass in standard Comfy)
             if (workflowNode && (workflowNode.mode === 2 || workflowNode.mode === 4)) continue; 

            if (node.class_type === 'CheckpointLoaderSimple' || node.class_type === 'CheckpointLoader') {
                extractedData.resources.base_models.push(resolveValue(node.inputs.ckpt_name));
            } else if (node.class_type === 'UNETLoader' || node.class_type === 'UnetLoaderGGUF') {
                 extractedData.resources.base_models.push(resolveValue(node.inputs.unet_name));
            } else if (node.class_type === 'LoraLoaderModelOnly' || node.class_type === 'LoraLoader') {
                // Standard Lora Loader
                extractedData.resources.loras.push(resolveValue(node.inputs.lora_name));
            } else if (node.class_type === 'Power Lora Loader (rgthree)') {
                // Power Lora Loader Logic
                // Iterate through all inputs to find defined LoRAs
                if (node.inputs) {
                    for (const val of Object.values(node.inputs)) {
                        // rgthree stores loras as objects: { "on": true, "lora": "filename.safetensors", "strength": 1 }
                        if (val && typeof val === 'object' && val.lora && val.on === true) {
                            extractedData.resources.loras.push(resolveValue(val.lora));
                        }
                    }
                }
            }
        }
        
        extractedData.resources.base_models = [...new Set(extractedData.resources.base_models)].filter(Boolean);
        extractedData.resources.loras = [...new Set(extractedData.resources.loras)].filter(Boolean);


        // 6. Global Resource Search (VAE/CLIP) - Fallback
        for (const node of Object.values(executedGraph)) {
            if (node.class_type === 'VAELoader') {
                extractedData.resources.vae = resolveValue(node.inputs.vae_name);
            }
            if (node.class_type === 'CLIPLoader') {
                extractedData.resources.clip = resolveValue(node.inputs.clip_name);
            }
        }

        // 7. Determine Technique
        const latentInput = finalSampler.inputs.latent_image || finalSampler.inputs.samples;
        if (latentInput) {
            const latentSourceNodeId = latentInput[0];
            const latentAncestors = findAllAncestors(latentSourceNodeId, executedGraph);

            const vidNodeTypes = ['LoadVideo', 'VHS_LoadVideo'];
            // Added WanImageToVideo here specifically as a source logic
            const imgNodeTypes = ['LoadImage', 'WanImageToVideo', 'WanFirstLastFrameToVideo']; 
            const emptyNodeTypes = ['EmptyLatentImage'];

            if (latentAncestors.some(node => vidNodeTypes.includes(node.class_type))) {
                extractedData.technique = 'vid2vid';
            } else if (latentAncestors.some(node => imgNodeTypes.includes(node.class_type))) {
                extractedData.technique = 'img2vid';
            } else if (latentAncestors.some(node => emptyNodeTypes.includes(node.class_type))) {
                extractedData.technique = 'txt2vid'; // Technically standard txt2img, but contextually correct
            }
        }
        
        // Fallback for Wan if it is the sampler itself
        if (finalSampler.class_type === 'WanImageToVideo') {
             extractedData.technique = 'img2vid'; // Usually takes a start image
        }

        return extractedData;

    } catch (error) {
        console.error("Failed to parse ComfyUI metadata:", error);
        return null;
    }
}

// ... Listener code remains the same ...
window.addEventListener('message', async (event) => {
    const file = event.data.file;
    if (!file) return;

    try {
        if (!mediaInfoInstance) {
            const wasmUrl = event.data.wasmUrl;
            mediaInfoInstance = await MediaInfo.mediaInfoFactory({
                format: 'JSON',
                locateFile: () => wasmUrl
            });
        }

        const readChunk = async (chunkSize, offset) => {
            const buffer = await file.slice(offset, offset + chunkSize).arrayBuffer();
            return new Uint8Array(buffer);
        };

        const resultString = await mediaInfoInstance.analyzeData(file.size, readChunk);
        const result = JSON.parse(resultString);
        const commentData = result?.media?.track[0]?.Comment;

        if (!commentData) {
            return window.parent.postMessage({ type: 'metadataResult', data: null }, '*');
        }

        const extractedData = parseComfyMetadata(commentData);
        window.parent.postMessage({ type: 'metadataResult', data: extractedData }, '*');

    } catch (error) {
        window.parent.postMessage({ type: 'metadataError', error: error.message }, '*');
    }
});