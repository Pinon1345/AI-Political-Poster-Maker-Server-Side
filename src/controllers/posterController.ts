import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { Poster } from '../models/Poster.js';

export const generatePoster = async (req: Request, res: Response): Promise<void> => {
    try {
        const { candidateName, slogan, prompt } = req.body;
        const userId = (req as any).user?.id;

        if (!candidateName || !slogan || !prompt) {
            res.status(400).json({ error: 'Please provide candidateName, slogan, and prompt' });
            return;
        }

        // Explicitly check for the API key to prevent credential errors
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            res.status(500).json({ error: 'GEMINI_API_KEY is missing from environment variables.' });
            return;
        }

        const ai = new GoogleGenAI({ apiKey });

        const aiPrompt = `Generate political campaign content for a candidate named ${candidateName} with the slogan "${slogan}". 
        Context/Focus points: ${prompt}. 
        Please provide a structured response including:
        1. A compelling core message summary.
        2. Three key bullet-point policy highlights.
        3. A short call-to-action statement for voters.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: aiPrompt,
        });

        const generatedText = response.text || 'Campaign generated content unavailable.';

        const newPoster = await Poster.create({
            user: userId,
            candidateName,
            slogan,
            prompt,
            generatedContent: generatedText,
        } as any);

        res.status(201).json({
            message: 'Poster content generated successfully',
            poster: newPoster
        });

    } catch (error: any) {
        console.error('Detailed Poster Generation Error:', error);
        res.status(500).json({
            error: 'Internal server error during poster generation.',
            details: error.message
        });
    }
};