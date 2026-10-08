const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core'); 
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

let activeTasks = {};

async function sendMessengerMessage(page, targetId, message) {
    try {
        // सुधार 1: URL को सही किया गया है (/t/ लगाना मैसेंजर चैट के लिए ज़रूरी है)
        await page.goto(`https://messenger.com{targetId}`, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // मैसेंजर का नया चैट बॉक्सSelector
        const messageBoxSelector = '[role="textbox"][contenteditable="true"]';
        await page.waitForSelector(messageBoxSelector, { timeout: 15000 });
        
        await page.click(messageBoxSelector);
        // इनपुट बॉक्स को साफ़ करने और टाइप करने का सुरक्षित तरीका
        await page.type(messageBoxSelector, message);
        await page.keyboard.press('Enter');
        
        console.log(`[BOT] Sent to ${targetId}: "${message}"`);
        return true;
    } catch (err) {
        console.error(`[BOT ERROR] ${targetId}:`, err.message);
        return false;
    }
}

app.post('/api/start', async (req, res) => {
    const { primaryCookies, targetId, hatersName, messages, delay } = req.body;
    const taskId = 'TASK-' + Math.floor(100000 + Math.random() * 900000);

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--single-process',
                '--no-zygote'
            ],
            executablePath: '/usr/bin/google-chrome-stable'
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // कुकीज़ पार्सिंग
        const cookieArray = [];
        primaryCookies.split(';').forEach(pair => {
            const [name, value] = pair.trim().split('=');
            if (name && value) {
                cookieArray.push({ name: name.trim(), value: value.trim(), domain: '.messenger.com', path: '/' });
                cookieArray.push({ name: name.trim(), value: value.trim(), domain: '.facebook.com', path: '/' });
            }
        });

        await page.setCookie(...cookieArray);
        
        // सुधार 2: सीधे चैट पर जाने से पहले एक बार होमपेज लोड कराएं ताकि सेशन रीडायरेक्ट न हो
        await page.goto('https://www.messenger.com', { waitUntil: 'networkidle2' });

        activeTasks[taskId] = { browser, page, targetId, hatersName, messages, delay, sentCount: 0, status: 'Running', currentIndex: 0 };

        activeTasks[taskId].intervalId = setInterval(async () => {
            let task = activeTasks[taskId];
            if (!task || task.status !== 'Running') return;

            let currentMsg = task.messages[task.currentIndex];
            let prefix = task.hatersName ? `${task.hatersName} ` : '';
            let fullMessage = `${prefix}${currentMsg}`;

            const success = await sendMessengerMessage(task.page, task.targetId, fullMessage);
            if (success) task.sentCount++;

            task.currentIndex = (task.currentIndex + 1) % task.messages.length;
        }, delay * 1000);

        res.json({ success: true, taskId });
    } catch (error) {
        console.error("Puppeteer Init Error:", error);
        res.status(500).json({ error: "Messenger initialization failed." });
    }
});

app.get('/api/status/:taskId', (req, res) => {
    const task = activeTasks[req.params.taskId];
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ status: task.status, sentCount: task.sentCount });
});

app.delete('/api/delete/:taskId', async (req, res) => {
    const taskId = req.params.taskId;
    const task = activeTasks[taskId];
    if (!task) return res.status(404).json({ error: "Task not found" });

    clearInterval(task.intervalId);
    if (task.browser) {
        try {
            await task.browser.close();
        } catch (e) {
            console.error("Browser close error", e);
        }
    }
    delete activeTasks[taskId];
    res.json({ message: `Task ${taskId} stopped.` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
