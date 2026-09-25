import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export const registerUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, name, email, password } = req.body;

        // Fallback between 'username' or 'name' depending on what the client sends
        const displayName = username || name;

        if (!email || !password || !displayName) {
            res.status(400).json({ error: 'Please provide name/username, email, and password' });
            return;
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({ error: 'User already exists with this email' });
            return;
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            name: displayName,
            email,
            passwordHash,
            role: 'user',
        });

        res.status(201).json({ message: 'User registered successfully', userId: newUser._id });
    } catch (error: any) {
        console.error('Registration error details:', error);
        res.status(500).json({ error: 'Server error during registration', details: error.message });
    }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            res.status(400).json({ error: 'Invalid email or password' });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            res.status(400).json({ error: 'Invalid email or password' });
            return;
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error: any) {
        console.error('Login error details:', error);
        res.status(500).json({ error: 'Server error during login', details: error.message });
    }
};