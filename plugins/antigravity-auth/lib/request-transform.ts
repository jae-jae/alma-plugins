/**
 * Request/Response Transformation for Antigravity
 *
 * Transforms Google AI SDK requests to Antigravity API format.
 * The AI SDK sends requests in Gemini format (contents/parts), we just need
 * to wrap them in Antigravity's envelope format and add auth headers.
 */

import type {
    AntigravityRequestBody,
    GeminiRequest,
    GeminiGenerationConfig,
    HeaderStyle,
    AntigravityHeaders,
} from './types';
import { getModelFamily, isClaudeThinkingModel, parseModelWithTier } from './models';

// ============================================================================
// Constants
// ============================================================================

// Antigravity API endpoints (in fallback order)
export const ANTIGRAVITY_ENDPOINTS = [
    'https://daily-cloudcode-pa.sandbox.googleapis.com',
    'https://autopush-cloudcode-pa.sandbox.googleapis.com',
    'https://cloudcode-pa.googleapis.com',
] as const;

export const PRIMARY_ENDPOINT = ANTIGRAVITY_ENDPOINTS[0];

// Headers for different quota types
export const ANTIGRAVITY_HEADERS: AntigravityHeaders = {
    'User-Agent': 'antigravity/1.11.5 windows/amd64',
    'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
    'Client-Metadata': '{"ideType":"IDE_UNSPECIFIED","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}',
};

export const GEMINI_CLI_HEADERS: AntigravityHeaders = {
    'User-Agent': 'google-api-nodejs-client/9.15.1',
    'X-Goog-Api-Client': 'gl-node/22.17.0',
    'Client-Metadata': 'ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI',
};

// Claude thinking model max output tokens
const CLAUDE_THINKING_MAX_OUTPUT_TOKENS = 65536;

// ============================================================================
// Request URL Detection
// ============================================================================

/**
 * Check if this is a Generative Language API request
 */
export function isGenerativeLanguageRequest(url: string): boolean {
    return url.includes('generativelanguage.googleapis.com');
}

/**
 * Extract model from URL
 */
export function extractModelFromUrl(url: string): string | null {
    const match = url.match(/\/models\/([^:/?]+)/);
    return match?.[1] ?? null;
}

/**
 * Detect if this is a streaming request
 */
export function isStreamingRequest(url: string): boolean {
    return url.includes(':streamGenerateContent');
}

// ============================================================================
// Request Transformation
// ============================================================================

export interface TransformResult {
    url: string;
    body: string;
    headers: Headers;
    streaming: boolean;
    effectiveModel: string;
    projectId: string;
}

/**
 * Transform Google AI SDK request to Antigravity format.
 *
 * The AI SDK sends requests in Gemini format:
 * {
 *   contents: [...],
 *   systemInstruction: {...},
 *   tools: [...],
 *   generationConfig: {...}
 * }
 *
 * We wrap this in Antigravity's envelope:
 * {
 *   project: "...",
 *   model: "...",
 *   request: { ...geminiRequest }
 * }
 */
export function transformRequest(
    originalUrl: string,
    body: string,
    accessToken: string,
    projectId: string,
    headerStyle: HeaderStyle = 'antigravity',
    endpoint: string = PRIMARY_ENDPOINT
): TransformResult {
    let parsed: any;
    try {
        parsed = JSON.parse(body);
    } catch {
        throw new Error('Invalid request body');
    }

    // Extract model from URL (e.g., /models/claude-sonnet-4-5-thinking:streamGenerateContent)
    const modelFromUrl = extractModelFromUrl(originalUrl);
    const requestedModel = modelFromUrl || parsed.model || 'unknown';
    const { baseModel, thinkingLevel, thinkingBudget } = parseModelWithTier(requestedModel);
    const effectiveModel = baseModel;
    const family = getModelFamily(requestedModel);
    const isClaude = family === 'claude';
    const isThinking = isClaudeThinkingModel(requestedModel);
    const streaming = isStreamingRequest(originalUrl);

    // The request body from AI SDK is already in Gemini format
    // We just need to enhance it and wrap it
    const geminiRequest: GeminiRequest = {
        contents: parsed.contents || [],
    };

    // Copy system instruction if present
    if (parsed.systemInstruction) {
        geminiRequest.systemInstruction = parsed.systemInstruction;

        // Add thinking hint for Claude thinking models with tools
        if (isThinking && parsed.tools && parsed.tools.length > 0) {
            const hint = 'Interleaved thinking is enabled. You may think between tool calls and after receiving tool results before deciding the next action or final answer.';
            if (geminiRequest.systemInstruction.parts) {
                geminiRequest.systemInstruction.parts.push({ text: hint });
            }
        }
    }

    // Copy tools if present
    if (parsed.tools) {
        geminiRequest.tools = parsed.tools;

        // Set tool config for Claude VALIDATED mode
        if (isClaude) {
            geminiRequest.toolConfig = {
                functionCallingConfig: {
                    mode: 'VALIDATED',
                },
            };
        }
    }

    // Build generation config
    const generationConfig: GeminiGenerationConfig = parsed.generationConfig || {};

    // Add thinking config for Claude thinking models
    if (isThinking && thinkingBudget) {
        generationConfig.thinkingConfig = {
            include_thoughts: true,
            thinking_budget: thinkingBudget,
        };
        // Ensure maxOutputTokens is large enough
        const currentMax = generationConfig.maxOutputTokens || generationConfig.max_output_tokens || 0;
        if (!currentMax || currentMax <= thinkingBudget) {
            generationConfig.maxOutputTokens = CLAUDE_THINKING_MAX_OUTPUT_TOKENS;
        }
    }

    if (Object.keys(generationConfig).length > 0) {
        geminiRequest.generationConfig = generationConfig;
    }

    // Add session ID for multi-turn conversations
    geminiRequest.sessionId = `alma-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Wrap in Antigravity format
    const antigravityBody: AntigravityRequestBody = {
        project: projectId,
        model: effectiveModel,
        request: geminiRequest,
        userAgent: 'antigravity',
        requestId: `alma-${crypto.randomUUID()}`,
    };

    // Build URL
    const action = streaming ? 'streamGenerateContent' : 'generateContent';
    const url = `${endpoint}/v1internal:${action}${streaming ? '?alt=sse' : ''}`;

    // Build headers
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Content-Type', 'application/json');

    const selectedHeaders = headerStyle === 'gemini-cli' ? GEMINI_CLI_HEADERS : ANTIGRAVITY_HEADERS;
    headers.set('User-Agent', selectedHeaders['User-Agent']);
    headers.set('X-Goog-Api-Client', selectedHeaders['X-Goog-Api-Client']);
    headers.set('Client-Metadata', selectedHeaders['Client-Metadata']);

    if (streaming) {
        headers.set('Accept', 'text/event-stream');
    }

    // Add interleaved thinking header for Claude thinking models
    if (isThinking) {
        headers.set('anthropic-beta', 'interleaved-thinking-2025-05-14');
    }

    return {
        url,
        body: JSON.stringify(antigravityBody),
        headers,
        streaming,
        effectiveModel,
        projectId,
    };
}

// ============================================================================
// Response Transformation
// ============================================================================

/**
 * Transform Antigravity SSE response.
 * The response needs to be unwrapped from Antigravity's envelope format.
 */
export function transformStreamingResponse(response: Response): Response {
    if (!response.body) {
        return response;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';

    const transformStream = new TransformStream({
        async transform(chunk, controller) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (!line.trim()) {
                    controller.enqueue(encoder.encode('\n'));
                    continue;
                }

                if (!line.startsWith('data: ')) {
                    controller.enqueue(encoder.encode(line + '\n'));
                    continue;
                }

                const dataStr = line.slice(6).trim();
                if (!dataStr || dataStr === '[DONE]') {
                    controller.enqueue(encoder.encode(line + '\n'));
                    continue;
                }

                try {
                    const data = JSON.parse(dataStr);
                    // Unwrap Antigravity envelope - the 'response' field contains the actual Gemini response
                    const unwrapped = data.response || data;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(unwrapped)}\n`));
                } catch {
                    // Pass through as-is if parsing fails
                    controller.enqueue(encoder.encode(line + '\n'));
                }
            }
        },
        flush(controller) {
            if (buffer.trim()) {
                controller.enqueue(encoder.encode(buffer + '\n'));
            }
        }
    });

    return new Response(response.body.pipeThrough(transformStream), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
}

/**
 * Transform non-streaming response from Antigravity.
 * Unwrap the Antigravity envelope format.
 */
export async function transformNonStreamingResponse(response: Response): Promise<Response> {
    const text = await response.text();

    try {
        const data = JSON.parse(text);

        // Unwrap Antigravity envelope - the 'response' field contains the actual Gemini response
        const unwrapped = data.response || data;

        return new Response(JSON.stringify(unwrapped), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    } catch {
        // Return original response if parsing fails
        return new Response(text, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    }
}
