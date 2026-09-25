import { Request, Response } from 'express';
import { Poster } from '../models/Poster.js';

// ---- Types for the Gemini response shape we actually use ----
interface GeminiPart {
    text?: string;
}
interface GeminiContent {
    parts?: GeminiPart[];
}
interface GeminiCandidate {
    content?: GeminiContent;
}
interface GeminiSuccessResponse {
    candidates?: GeminiCandidate[];
}
interface GeminiErrorResponse {
    error?: {
        code?: number;
        message?: string;
        status?: string;
    };
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500; // used for exponential backoff when Gemini doesn't give a retry delay
const REQUEST_TIMEOUT_MS = 20000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls the Gemini API with retry + exponential backoff on 429 (quota) responses.
 * Throws on non-retryable errors, or after exhausting retries.
 */
async function callGeminiWithRetry(
    apiEndpoint: string,
    body: unknown
): Promise<GeminiSuccessResponse> {
    let lastError: { status: number; data: GeminiErrorResponse } | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        let apiResponse: globalThis.Response;
        try {
            apiResponse = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeout);
        }

        // Gemini can return non-JSON on some failures; parse defensively.
        let data: GeminiSuccessResponse & GeminiErrorResponse;
        try {
            data = await apiResponse.json();
        } catch {
            throw new Error(`Gemini API returned a non-JSON response (status ${apiResponse.status})`);
        }

        if (apiResponse.ok) {
            return data as GeminiSuccessResponse;
        }

        const status = apiResponse.status;
        lastError = { status, data };

        // Only retry on 429 (quota/rate limit) or 503 (transient overload)
        const isRetryable = status === 429 || status === 503;
        if (!isRetryable || attempt === MAX_RETRIES) {
            break;
        }

        // Try to honor Gemini's suggested retry delay (e.g. "Please retry in 41.6s")
        const retryMessage = data?.error?.message || '';
        const match = retryMessage.match(/retry in (\d+(?:\.\d+)?)s/i);
        const suggestedDelayMs = match ? parseFloat(match[1]) * 1000 : null;
        const backoffMs = suggestedDelayMs ?? BASE_DELAY_MS * Math.pow(2, attempt);

        console.warn(
            `Gemini API returned ${status} (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${Math.round(
                backoffMs
            )}ms...`
        );
        await sleep(backoffMs);
    }

    const err = new Error(lastError?.data?.error?.message || 'Failed to communicate with Gemini API.');
    (err as any).status = lastError?.status ?? 502;
    (err as any).details = lastError?.data;
    throw err;
}

export const generatePoster = async (req: Request, res: Response): Promise<void> => {
    try {
        const { candidateName, slogan, prompt } = req.body;
        const userId = (req as any).user?.id;

        if (!candidateName || !slogan || !prompt) {
            res.status(400).json({ error: 'Please provide candidateName, slogan, and prompt' });
            return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            res.status(500).json({ error: 'GEMINI_API_KEY is missing from environment variables.' });
            return;
        }

        const aiPrompt = `Generate political campaign content for a candidate named ${candidateName} with the slogan "${slogan}".
Context/Focus points: ${prompt}.
Please provide a structured response including:
1. A compelling core message summary.
2. Three key bullet-point policy highlights.
3. A short call-to-action statement for voters.`;

        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

        let data: GeminiSuccessResponse;
        try {
            data = await callGeminiWithRetry(apiEndpoint, {
                contents: [
                    {
                        parts: [{ text: aiPrompt }],
                    },
                ],
            });
        } catch (apiErr: any) {
            console.error('Gemini API Error:', apiErr.details || apiErr.message);

            // Give the client a clearer signal for quota exhaustion specifically
            if (apiErr.status === 429) {
                res.status(429).json({
                    error: 'Gemini API quota exceeded. Please wait a moment and try again, or check your plan/billing.',
                    details: apiErr.message,
                });
                return;
            }

            res.status(502).json({
                error: 'Failed to communicate with Gemini API.',
                details: apiErr.message || 'Unknown error',
            });
            return;
        }

        const generatedText =
            data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
            'Campaign generated content unavailable.';

        const newPoster = await Poster.create({
            user: userId,
            candidateName,
            slogan,
            prompt,
            generatedContent: generatedText,
        } as any);

        res.status(201).json({
            message: 'Poster content generated successfully',
            poster: newPoster,
        });
    } catch (error: any) {
        console.error('Detailed Poster Generation Error:', error);
        res.status(500).json({
            error: 'Internal server error during poster generation.',
            details: error?.message || 'An unexpected error occurred.',
        });
    }
};