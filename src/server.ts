import express, { Request, Response } from 'express';
import puppeteer, { Browser, Page } from 'puppeteer';
import WebSocket from 'ws';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Types
interface PageInfo {
    title: string;
    url: string;
    screenshot: string;
    sessionId: string;
}

interface ExecuteResult {
    result: any;
    pageInfo: PageInfo;
}

interface SessionInfo {
    sessionId: string;
    createdAt: Date;
    lastActivity: Date;
}

// Store active browser sessions
const browserSessions = new Map<string, BrowserSession>();

// Browser session class
class BrowserSession {
    public sessionId: string;
    private browser: Browser | null = null;
    private page: Page | null = null;
    public createdAt: Date;
    public lastActivity: Date;

    constructor(sessionId: string) {
        this.sessionId = sessionId;
        this.createdAt = new Date();
        this.lastActivity = new Date();
    }

    async initialize(): Promise<boolean> {
        try {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });

            this.page = await this.browser.newPage();
            await this.page.setViewport({ width: 1280, height: 720 });

            console.log(`Browser session ${this.sessionId} initialized`);
            return true;
        } catch (error) {
            console.error(`Failed to initialize browser session ${this.sessionId}:`, error);
            return false;
        }
    }

    async navigate(url: string): Promise<PageInfo> {
        if (!this.page) throw new Error('Browser session not initialized');

        this.lastActivity = new Date();
        try {
            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            return await this.getPageInfo();
        } catch (error) {
            throw new Error(`Navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getScreenshot(): Promise<string> {
        if (!this.page) throw new Error('Browser session not initialized');

        this.lastActivity = new Date();
        const screenshot = await this.page.screenshot({
            type: 'png',
            fullPage: false,
            encoding: 'base64'
        });

        return screenshot as string;
    }

    async getPageInfo(): Promise<PageInfo> {
        if (!this.page) throw new Error('Browser session not initialized');

        const title = await this.page.title();
        const url = this.page.url();
        const screenshot = await this.getScreenshot();

        return {
            title,
            url,
            screenshot: `data:image/png;base64,${screenshot}`,
            sessionId: this.sessionId
        };
    }

    async click(x: number, y: number): Promise<PageInfo> {
        if (!this.page) throw new Error('Browser session not initialized');

        this.lastActivity = new Date();
        await this.page.mouse.click(x, y);
        return await this.getPageInfo();
    }

    async type(text: string): Promise<PageInfo> {
        if (!this.page) throw new Error('Browser session not initialized');

        this.lastActivity = new Date();
        await this.page.keyboard.type(text);
        return await this.getPageInfo();
    }

    async scroll(deltaY: number): Promise<PageInfo> {
        if (!this.page) throw new Error('Browser session not initialized');

        this.lastActivity = new Date();
        await this.page.mouse.wheel({ deltaY });
        return await this.getPageInfo();
    }

    async executeScript(script: string): Promise<ExecuteResult> {
        if (!this.page) throw new Error('Browser session not initialized');

        this.lastActivity = new Date();
        const result = await this.page.evaluate(script);
        const pageInfo = await this.getPageInfo();
        return { result, pageInfo };
    }

    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            console.log(`Browser session ${this.sessionId} closed`);
        }
    }
}

// API Routes

// Create new browser session
app.post('/api/session/create', async (req: Request, res: Response): Promise<void> => {
    try {
        const sessionId = uuidv4();
        const session = new BrowserSession(sessionId);

        const initialized = await session.initialize();
        if (!initialized) {
            res.status(500).json({ error: 'Failed to initialize browser session' });
            return;
        }

        browserSessions.set(sessionId, session);

        res.json({
            sessionId,
            message: 'Browser session created successfully'
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: errorMessage });
    }
});

// Navigate to URL
app.post('/api/session/:sessionId/navigate', async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const { url } = req.body;

        if (!sessionId) {
            res.status(400).json({ error: 'Session ID is required' });
            return;
        }

        if (!url || typeof url !== 'string') {
            res.status(400).json({ error: 'URL is required and must be a string' });
            return;
        }

        const session = browserSessions.get(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        const pageInfo = await session.navigate(url);
        res.json(pageInfo);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: errorMessage });
    }
});

// Get screenshot
app.get('/api/session/:sessionId/screenshot', async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            res.status(400).json({ error: 'Session ID is required' });
            return;
        }

        const session = browserSessions.get(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        const pageInfo = await session.getPageInfo();
        res.json(pageInfo);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: errorMessage });
    }
});

// Click at coordinates
app.post('/api/session/:sessionId/click', async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const { x, y } = req.body;

        if (!sessionId) {
            res.status(400).json({ error: 'Session ID is required' });
            return;
        }

        if (typeof x !== 'number' || typeof y !== 'number') {
            res.status(400).json({ error: 'x and y coordinates must be numbers' });
            return;
        }

        const session = browserSessions.get(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        const pageInfo = await session.click(x, y);
        res.json(pageInfo);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: errorMessage });
    }
});

// Type text
app.post('/api/session/:sessionId/type', async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const { text } = req.body;

        if (!sessionId) {
            res.status(400).json({ error: 'Session ID is required' });
            return;
        }

        if (!text || typeof text !== 'string') {
            res.status(400).json({ error: 'Text is required and must be a string' });
            return;
        }

        const session = browserSessions.get(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        const pageInfo = await session.type(text);
        res.json(pageInfo);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: errorMessage });
    }
});

// Scroll page
app.post('/api/session/:sessionId/scroll', async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const { deltaY } = req.body;

        if (!sessionId) {
            res.status(400).json({ error: 'Session ID is required' });
            return;
        }

        if (typeof deltaY !== 'number') {
            res.status(400).json({ error: 'deltaY must be a number' });
            return;
        }

        const session = browserSessions.get(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        const pageInfo = await session.scroll(deltaY);
        res.json(pageInfo);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: errorMessage });
    }
});

// Execute JavaScript
app.post('/api/session/:sessionId/execute', async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const { script } = req.body;

        if (!sessionId) {
            res.status(400).json({ error: 'Session ID is required' });
            return;
        }

        if (!script || typeof script !== 'string') {
            res.status(400).json({ error: 'Script is required and must be a string' });
            return;
        }

        const session = browserSessions.get(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        const result = await session.executeScript(script);
        res.json(result);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: errorMessage });
    }
});

// Close session
app.delete('/api/session/:sessionId', async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            res.status(400).json({ error: 'Session ID is required' });
            return;
        }

        const session = browserSessions.get(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        await session.close();
        browserSessions.delete(sessionId);

        res.json({ message: 'Session closed successfully' });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: errorMessage });
    }
});

// List active sessions
app.get('/api/sessions', (req: Request, res: Response) => {
    const sessions: SessionInfo[] = Array.from(browserSessions.values()).map(session => ({
        sessionId: session.sessionId,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity
    }));

    res.json({ sessions, count: sessions.length });
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeSessions: browserSessions.size
    });
});

// Cleanup inactive sessions (run every 5 minutes)
setInterval(async () => {
    const now = new Date();
    const maxInactiveTime = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of browserSessions.entries()) {
        if (now.getTime() - session.lastActivity.getTime() > maxInactiveTime) {
            console.log(`Cleaning up inactive session: ${sessionId}`);
            await session.close();
            browserSessions.delete(sessionId);
        }
    }
}, 5 * 60 * 1000);

// Graceful shutdown
const gracefulShutdown = async (): Promise<void> => {
    console.log('Shutting down gracefully...');

    // Close all browser sessions
    for (const session of browserSessions.values()) {
        await session.close();
    }

    process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

app.listen(PORT, () => {
    console.log(`Cloud Browser API server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});
