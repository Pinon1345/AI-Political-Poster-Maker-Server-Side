import { Router } from 'express';
import { generatePoster } from '../controllers/posterController.js';
import { Poster } from '../models/Poster.js';
import upload from '../middleware/upload.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// Protected route with optional image file upload support
router.post('/generate', verifyToken, upload.single('image'), generatePoster);

export default router;