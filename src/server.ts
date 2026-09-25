import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import authRoutes from './routes/authRoutes'; // Moved import to the top

// Load environment variables

dotenv.config();

// Initialize Express app

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Mount Routes

app.use('/api/auth', authRoutes);

// Test route

app.get('/', (req, res) => {
    res.send('AI Political Poster Maker API is running smoothly!');
});

// Start server and connect DB

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});