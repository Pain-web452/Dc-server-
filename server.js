const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core'); 
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

let activeTasks = {};

// मैसेंजर पर मैसेज भेजने का मुख्य फंक्शन
async function sendMessengerMessage(page, targetId, message) {
    try {
        await page.goto(`https://messenger.com{targetId}`, { 
            waitUntil: 'networkidle0', 
            timeout: 60000 
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        const messageBoxSelector = '[role="textbox"][contenteditable="true"]';
        await page.waitForSelector(messageBoxSelector, { timeout: 20000 });
        
        await page.click(messageBoxSelector);
        await page.type(messageBoxSelector, message, { delay: 100 }); 
        
        await new Promise(resolve => setTimeout(resolve, 500));
        await page.keyboard.press('Enter');
        
        console.log(`[BOT] Sent to ${targetId}: "${message}"`);
        return true;
    } catch (err) {
        console.error(`[BOT ERROR] ${targetId}:`, err.message);
        return false;
    }
}

// 1. टास्क शुरू करने की API (Render के लिए फिक्स किया हुआ हिस्सा)
app.post('/api/start', async (req, res) => {
    const { primaryCookies, targetId, hatersName, messages, delay } = req.body;
    const taskId = 'TASK-' + Math.floor(100000 + Math.random() * 900000);

    try {
        // यहाँ Render पर क्रोम लोड न होने की समस्या को पूरी तरह फिक्स कर दिया गया है
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--single-process',
                '--no-zygote',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1280,800'
            ]
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        const cookieArray = [];
        primaryCookies.split(';').forEach(pair => {
            const [name, value] = pair.trim().split('=');
            if (name && value) {
                cookieArray.push({ name: name.trim(), value: value.trim(), domain: '.messenger.com', path: '/', secure: true });
                cookieArray.push({ name: name.trim(), value: value.trim(), domain: '.facebook.com', path: '/', secure: true });
            }
        });

        await page.setCookie(...cookieArray);
        await page.goto('https://messenger.com', { waitUntil: 'networkidle2' });

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

// 2. टास्क स्टेटस चेक करने की API
app.get('/api/status/:taskId', (req, res) => {
    const task = activeTasks[req.params.taskId];
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ status: task.status, sentCount: task.sentCount });
});

// 3. कुकीज़ अपडेट करने की API
app.post('/api/update-cookies', async (req, res) => {
    const { taskId, primaryCookies, backupCookies } = req.body;
    const task = activeTasks[taskId];
    
    if (!task) return res.status(404).json({ error: "Task not found" });

    try {
        const activeCookies = primaryCookies || backupCookies;
        if (activeCookies) {
            const cookieArray = [];
            activeCookies.split(';').forEach(pair => {
                const [name, value] = pair.trim().split('=');
                if (name && value) {
                    cookieArray.push({ name: name.trim(), value: value.trim(), domain: '.messenger.com', path: '/', secure: true });
                    cookieArray.push({ name: name.trim(), value: value.trim(), domain: '.facebook.com', path: '/', secure: true });
                }
            });
            await task.page.setCookie(...cookieArray);
            await task.page.goto('https://messenger.com', { waitUntil: 'networkidle2' });
            res.json({ message: `Task ${taskId} cookies updated successfully.` });
        } else {
            res.status(400).json({ error: "No cookies provided." });
        }
    } catch (error) {
        console.error("Update Cookies Error:", error);
        res.status(500).json({ error: "Failed to update cookies." });
    }
});

// 4. टास्क डिलीट/स्टॉप करने की API
app.delete('/api/delete/:taskId', async (req, res) => {
    const taskId = req.params.taskId;
    const task = activeTasks[taskId];
    if (!task) return res.status(404).json({ error: "Task not found" });

    clearInterval(task.intervalId);
    if (task.browser) {
        try { await task.browser.close(); } catch (e) { console.error(e); }
    }
    delete activeTasks[taskId];
    res.json({ message: `Task ${taskId} stopped.` });
});

// सर्वर स्टार्ट पोर्ट सेटिंग
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
