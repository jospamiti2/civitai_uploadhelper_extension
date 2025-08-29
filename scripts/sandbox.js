let mediaInfoInstance = null;

/**
 * Parses the ComfyUI metadata comment from a media file.
 *
 * @param {string} commentData The raw comment string containing the workflow JSON.
 * @returns {object|null} A structured object with extracted metadata, or null if parsing fails.
 */
function parseComfyMetadata(commentData) {
   if (!commentData) {
        return null;
    }

    try {
        // 1. Double-parse the JSON data
        const outerMetadata = JSON.parse(commentData);
        const executedGraph = JSON.parse(outerMetadata.prompt);
        const fullWorkflow = outerMetadata.workflow;

        // Create a quick lookup map for workflow nodes by their ID for efficient access
        const workflowNodeMap = fullWorkflow.nodes.reduce((acc, node) => {
            acc[node.id] = node;
            return acc;
        }, {});

        const findAllAncestors = (startNodeId, graph) => {
            const ancestors = new Map();
            const queue = [startNodeId];
            const visited = new Set();

            while (queue.length > 0) {
                const currentId = queue.shift();
                if (!currentId || visited.has(currentId)) {
                    continue;
                }
                visited.add(currentId);

                const node = graph[currentId];
                if (!node) {
                    continue;
                }
                
                // Store the node itself, keyed by its ID
                ancestors.set(currentId, node);

                // Add all linked input nodes to the queue for traversal
                if (node.inputs) {
                    for (const input of Object.values(node.inputs)) {
                        // An input is a link if it's an array with a string node ID at the first position
                        if (Array.isArray(input) && typeof input[0] === 'string') {
                            queue.push(input[0]);
                        }
                    }
                }
            }
            return Array.from(ancestors.values());
        };        

        // --- Helper function to find the source of an input by tracing links ---
        const findUpstreamSourceNode = (startNodeId, inputName) => {
            let currentNode = executedGraph[startNodeId];
            let link = currentNode?.inputs?.[inputName];
            
            // Traverse backwards through the graph following the link for the specified input
            while (link && executedGraph[link[0]]) {
                currentNode = executedGraph[link[0]];
                link = currentNode?.inputs?.[inputName];
                // Stop if the current node IS the source (e.g., CLIPTextEncode)
                if (currentNode.class_type === 'CLIPTextEncode') {
                    return currentNode;
                }
            }
            return currentNode;
        };

        // --- Helper function to trace the model and LoRA chain ---
        const traceModelChain = (startNodeId) => {
            const resources = {
                base_model: null,
                loras: [],
                vae: null,
                clip: null
            };
            let currentNodeId = startNodeId;
            let chain = [];

            // Follow the 'model' input chain all the way to the start
            while (currentNodeId) {
                const node = executedGraph[currentNodeId];
                if (!node) break;
                
                chain.push(node);

                // Find the next link in the chain
                const modelInput = node.inputs.model || node.inputs.MODEL;
                currentNodeId = modelInput ? modelInput[0] : null;
            }
            
            // Now, process the chain in forward order (from loader to KSampler)
            chain.reverse();

            for (const node of chain) {
                 // Check if the node was bypassed in the full workflow definition
                const workflowNode = workflowNodeMap[node.class_type === "KSampler" ? chain.find(n => n.inputs.model)?.inputs.model[0] : Object.keys(executedGraph).find(key => executedGraph[key] === node)];
                const isBypassed = workflowNode && workflowNode.mode === 4;

                switch (node.class_type) {
                    case 'CheckpointLoaderSimple':
                    case 'CheckpointLoader':
                    case 'UNETLoader': // Your example uses this
                        resources.base_model = node.inputs.ckpt_name || node.inputs.unet_name;
                        break;
                    case 'LoraLoaderModelOnly': // Your example uses this
                    case 'LoraLoader':
                        if (!isBypassed) {
                            resources.loras.push(node.inputs.lora_name);
                        }
                        break;
                    case 'VAELoader':
                        resources.vae = node.inputs.vae_name;
                        break;
                    case 'CLIPLoader':
                        resources.clip = node.inputs.clip_name;
                        break;
                }
            }
            
            return resources;
        };
        
        // 2. Find the final KSampler node
        // A good heuristic: Find the last KSampler in the executed graph, as it's often the final one.
        // A more robust method would be to find the SaveImage/VideoCombine node and trace back.
        const kSamplerNodes = Object.values(executedGraph).filter(node => node.class_type === "KSampler");
        if (kSamplerNodes.length === 0) {
            return null; // No generation happened
        }
        const finalKSampler = kSamplerNodes[kSamplerNodes.length - 1];
        const finalKSamplerId = Object.keys(executedGraph).find(key => executedGraph[key] === finalKSampler);

        // 3. Extract core generation parameters from the KSampler
        const extractedData = {
            seed: finalKSampler.inputs.seed,
            steps: finalKSampler.inputs.steps,
            cfg: finalKSampler.inputs.cfg,
            sampler_name: finalKSampler.inputs.sampler_name,
            scheduler: finalKSampler.inputs.scheduler,
            denoise: finalKSampler.inputs.denoise,
            positive_prompt: '',
            negative_prompt: '',
            technique: 'txt2vid', // Default value,
            resources: {}
        };

        // 4. Trace and extract prompts
        const positivePromptNode = findUpstreamSourceNode(finalKSamplerId, 'positive');
        if (positivePromptNode && positivePromptNode.inputs.text) {
            extractedData.positive_prompt = positivePromptNode.inputs.text;
        }

        const negativePromptNode = findUpstreamSourceNode(finalKSamplerId, 'negative');
        if (negativePromptNode && negativePromptNode.inputs.text) {
            extractedData.negative_prompt = negativePromptNode.inputs.text;
        }

        // 5. Trace the model chain to find base model and active LoRAs
        const modelResources = traceModelChain(finalKSampler.inputs.model[0]);
        extractedData.resources = {
            base_model: modelResources.base_model,
            loras: modelResources.loras
            // You can add vae, clip etc. here if needed
        };

        // 6. Identify other resources from the graph that might not be in the model chain
        for (const node of Object.values(executedGraph)) {
            if (node.class_type === 'VAELoader') {
                extractedData.resources.vae = node.inputs.vae_name;
            }
            if (node.class_type === 'CLIPLoader') {
                extractedData.resources.clip = node.inputs.clip_name;
            }
        }

        // 7. Determine the generation technique (img2vid, vid2vid, txt2vid)
        if (finalKSampler.inputs.latent_image) {
            const latentSourceNodeId = finalKSampler.inputs.latent_image[0];
            const latentAncestors = findAllAncestors(latentSourceNodeId, executedGraph);

            // Define known class types for each technique. This can be expanded.
            const vidNodeTypes = ['LoadVideo', 'VHS_LoadVideo']; // For vid2vid
            const imgNodeTypes = ['LoadImage', 'WanImageToVideo', 'WanFirstLastFrameToVideo']; // For img2vid
            const emptyNodeTypes = ['EmptyLatentImage']; // For txt2vid

            // Check with priority: vid2vid > img2vid > txt2vid
            if (latentAncestors.some(node => vidNodeTypes.includes(node.class_type))) {
                extractedData.technique = 'vid2vid';
            } else if (latentAncestors.some(node => imgNodeTypes.includes(node.class_type))) {
                extractedData.technique = 'img2vid';
            } else if (latentAncestors.some(node => emptyNodeTypes.includes(node.class_type))) {
                extractedData.technique = 'txt2vid';
            }
            // If none of these specific nodes are found, we stick with the default 'txt2vid',
            // as it's the most basic form of generation.
        }        


        return extractedData;

    } catch (error) {
        console.error("Failed to parse ComfyUI metadata:", error);
        return null; // Return null on any parsing error
    }
}



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

        // --- All parsing now happens here in the sandbox ---
        const extractedData = parseComfyMetadata(commentData);

        // Send back the final, clean object
        window.parent.postMessage({ type: 'metadataResult', data: extractedData }, '*');

    } catch (error) {
        window.parent.postMessage({ type: 'metadataError', error: error.message }, '*');
    }
});