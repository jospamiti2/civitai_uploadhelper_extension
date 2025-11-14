let mediaInfoInstance = null;

/**
 * Parses the ComfyUI metadata comment from a media file.
 *
 * @param {string} commentData The raw comment string containing the workflow JSON.
 * @returns {object|null} A structured object with extracted metadata, or null if parsing fails.
 */
function parseComfyMetadata(commentData) {
    //console.log("CommantDaza: " + commentData);
    if (!commentData) {
        return null;
    }

    try {
        // 1. Double-parse the JSON data
        const outerMetadata = JSON.parse(commentData.replaceAll(': NaN', ': null'));
        const executedGraph = outerMetadata.prompt ? JSON.parse(outerMetadata.prompt) : {};
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
            if (!currentNode) return null;

            let link = currentNode?.inputs?.[inputName];

            // Traverse backwards through the graph following the link for the specified input
            while (link && executedGraph[link[0]]) {
                const parentNodeId = link[0];
                const parentNode = executedGraph[parentNodeId];

                // If the parent node is a text encode node, we found our source.
                if (parentNode.class_type === 'CLIPTextEncode') {
                    return parentNode;
                }
                
                // For other nodes, see if they have the same input to continue tracing.
                // This handles reroute nodes or other intermediate steps.
                link = parentNode?.inputs?.[inputName];
                
                // If the input name doesn't exist on the parent, stop.
                if (!link) {
                    return parentNode; // Return the last node in the chain for this input.
                }
            }
            return currentNode; // Fallback to the start node if no traversal happens
        };

        // 2. Find all KSampler nodes (standard and advanced)
        const samplerNodes = Object.values(executedGraph).filter(node =>
            node.class_type === "KSampler" || node.class_type === "KSamplerAdvanced"
        );

        if (samplerNodes.length === 0) {
            return null; // No generation happened
        }

        // --- Identify the final sampler and the full chain ---
        // A robust way is to find the VAE Decode node and trace back from its 'samples' input.
        const vaeDecodeNode = Object.values(executedGraph).find(node => node.class_type === 'VAEDecode');
        let finalSampler = null;
        let finalSamplerId = null;

        if (vaeDecodeNode && vaeDecodeNode.inputs.samples) {
            const finalSamplerNodeId = vaeDecodeNode.inputs.samples[0];
            finalSampler = executedGraph[finalSamplerNodeId];
            finalSamplerId = finalSamplerNodeId;
        } else {
            // Fallback for workflows without a VAEDecode (e.g., latent outputs)
            // Heuristic: The final sampler is the one not used as a latent input to another sampler.
            const samplerIds = new Set(Object.keys(executedGraph).filter(id => executedGraph[id].class_type.includes("KSampler")));
            const latentInputs = new Set();
            samplerNodes.forEach(node => {
                if (node.inputs.latent_image) {
                    latentInputs.add(node.inputs.latent_image[0]);
                }
            });
            const finalSamplerIds = [...samplerIds].filter(id => !latentInputs.has(id));
            finalSamplerId = finalSamplerIds.length > 0 ? finalSamplerIds[0] : Object.keys(executedGraph).find(key => executedGraph[key] === samplerNodes[samplerNodes.length - 1]);
            finalSampler = executedGraph[finalSamplerId];
        }
        
        // Find the first sampler in the chain to get the initial seed
        const samplerChain = findAllAncestors(finalSamplerId, executedGraph).filter(node =>
            node.class_type === "KSampler" || node.class_type === "KSamplerAdvanced"
        );
        const firstSampler = samplerChain.length > 0 ? samplerChain[samplerChain.length - 1] : finalSampler;


        // 3. Extract core generation parameters
        const extractedData = {
            seed: firstSampler.inputs.seed || firstSampler.inputs.noise_seed,
            steps: finalSampler.inputs.steps,
            cfg: finalSampler.inputs.cfg,
            sampler_name: finalSampler.inputs.sampler_name,
            scheduler: finalSampler.inputs.scheduler,
            denoise: finalSampler.inputs.denoise,
            positive_prompt: '',
            negative_prompt: '',
            technique: 'txt2img', // Default value
            resources: {
                base_models: [],
                loras: [],
                vae: null,
                clip: null
            }
        };

        // 4. Trace and extract prompts from the final sampler
        const positivePromptNode = findUpstreamSourceNode(finalSamplerId, 'positive');
        if (positivePromptNode && positivePromptNode.inputs.text) {
            extractedData.positive_prompt = positivePromptNode.inputs.text;
        }

        const negativePromptNode = findUpstreamSourceNode(finalSamplerId, 'negative');
        if (negativePromptNode && negativePromptNode.inputs.text) {
            extractedData.negative_prompt = negativePromptNode.inputs.text;
        }

        // 5. Trace all resources from the entire sampler chain
        const allSamplerAncestors = findAllAncestors(finalSamplerId, executedGraph);
        
        for (const node of allSamplerAncestors) {
             const workflowNode = workflowNodeMap[Object.keys(executedGraph).find(key => executedGraph[key] === node)];
             const isBypassed = workflowNode && workflowNode.mode === 4;
             if (isBypassed) continue; // Skip bypassed nodes

            switch (node.class_type) {
                case 'CheckpointLoaderSimple':
                case 'CheckpointLoader':
                    extractedData.resources.base_models.push(node.inputs.ckpt_name);
                    break;
                case 'UNETLoader':
                     extractedData.resources.base_models.push(node.inputs.unet_name);
                    break;
                case 'LoraLoaderModelOnly':
                case 'LoraLoader':
                    extractedData.resources.loras.push(node.inputs.lora_name);
                    break;
            }
        }
        
        // Clean up duplicates
        extractedData.resources.base_models = [...new Set(extractedData.resources.base_models)];
        extractedData.resources.loras = [...new Set(extractedData.resources.loras)];


        // 6. Identify other resources from the whole graph
        for (const node of Object.values(executedGraph)) {
            if (node.class_type === 'VAELoader') {
                extractedData.resources.vae = node.inputs.vae_name;
            }
            if (node.class_type === 'CLIPLoader') {
                extractedData.resources.clip = node.inputs.clip_name;
            }
        }

        // 7. Determine the generation technique
        const latentInput = finalSampler.inputs.latent_image;
        if (latentInput) {
            const latentSourceNodeId = latentInput[0];
            const latentAncestors = findAllAncestors(latentSourceNodeId, executedGraph);

            const vidNodeTypes = ['LoadVideo', 'VHS_LoadVideo'];
            const imgNodeTypes = ['LoadImage', 'WanImageToVideo', 'WanFirstLastFrameToVideo'];
            const emptyNodeTypes = ['EmptyLatentImage'];

            if (latentAncestors.some(node => vidNodeTypes.includes(node.class_type))) {
                extractedData.technique = 'vid2vid';
            } else if (latentAncestors.some(node => imgNodeTypes.includes(node.class_type))) {
                extractedData.technique = 'img2vid';
            } else if (latentAncestors.some(node => emptyNodeTypes.includes(node.class_type))) {
                extractedData.technique = 'txt2vid';
            }
        } else {
             extractedData.technique = 'txt2img'; // Fallback if no latent input
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