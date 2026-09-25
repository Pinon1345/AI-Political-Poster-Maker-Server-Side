import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        res.status(401).json({ error: 'Access denied. No token provided.' });
        return;
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        // @ts-ignore
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ error: 'Invalid token.' });
    }
};