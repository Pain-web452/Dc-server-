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
        // सुधार 1: फेसबुक ब्लॉक न करे, इसलिए असली यूज़र की तरह बिहेवियर दिखाना
        await page.goto(`https://messenger.com{targetId}`, { 
            waitUntil: 'networkidle0', // पूरी तरह पेज लोड होने का इंतज़ार करें
            timeout: 60000 
        });
        
        // एक छोटा सा इंसानी पॉज़ (Human-like pause)
        await new Promise(resolve => setTimeout(resolve, 2000));

        const messageBoxSelector = '[role="textbox"][contenteditable="true"]';
        await page.waitForSelector(messageBoxSelector, { timeout: 20000 });
        
        await page.click(messageBoxSelector);
        
        // सुधार 2: एक-एक अक्षर करके टाइप करना ताकि फेसबुक को बॉट न लगे
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

app.post('/api/start', async (req, res) => {
    const { primaryCookies, targetId, hatersName, messages, delay } = req.body;
    const taskId = 'TASK-' + Math.floor(100000 + Math.random() * 900000);

    try {
        // सुधार 3: बॉट डिटेक्शन को बायपास करने के लिए नए Args
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--single-process',
                '--no-zygote',
                '--disable-blink-features=AutomationControlled', // यह क्रोम को बॉट दिखाने से रोकता है
                '--window-size=1280,800'
            ],
            executablePath: '/usr/bin/google-chrome-stable'
        });
        
        const page = await browser.newPage();
        
        // असली दिखने वाला User-Agent और स्क्रीन साइज सेट करना
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // कुकीज़ पार्सिंग
        const cookieArray = [];
        primaryCookies.split(';').forEach(pair => {
            const [name, value] = pair.trim().split('=');
            if (name && value) {
                // सुरक्षित कुकीज़ सेटिंग्स जो फेसबुक रिजेक्ट न करे
                cookieArray.push({ name: name.trim(), value: value.trim(), domain: '.messenger.com', path: '/', secure: true, httpOnly: name.trim() === 'xs' });
                cookieArray.push({ name: name.trim(), value: value.trim(), domain: '.facebook.com', path: '/', secure: true, httpOnly: name.trim() === 'xs' });
            }
        });

        await page.setCookie(...cookieArray);
        
        // सीधे लॉगिन चेक करने के लिए होमपेज पर जाना
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

// (बाकी का status और delete कोड पुराना ही रहेगा)
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
        try { await task.browser.close(); } catch (e) { console.error(e); }
    }
    delete activeTasks[taskId];
    res.json({ message: `Task ${taskId} stopped.` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
