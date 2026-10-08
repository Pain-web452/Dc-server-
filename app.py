const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// फ्रंटएंड फाइलों को सर्व करने के लिए
app.use(express.static(path.join(__dirname)));

let activeTasks = {};

// Messenger.com पर मैसेज भेजने वाला असली फंक्शन
async function sendMessengerMessage(page, targetId, message) {
    try {
        // सीधे मैसेंजर चैट लिंक पर जाएं
        await page.goto(`https://messenger.com{targetId}`, { waitUntil: 'networkidle2' });

        // मैसेंजर का मैसेज बॉक्स (इनपुट फ़ील्ड) ढूँढें
        const messageBoxSelector = '[role="textbox"][contenteditable="true"]';
        await page.waitForSelector(messageBoxSelector, { timeout: 15000 });

        // इनपुट बॉक्स पर फोकस करें
        await page.click(messageBoxSelector);

        // मैसेज टाइप करें
        await page.type(messageBoxSelector, message);

        // Enter दबाकर मैसेज सेंड करें
        await page.keyboard.press('Enter');
        
        console.log(`[MESSENGER BOT] Sent to ${targetId}: "${message}"`);
        return true;
    } catch (err) {
        console.error(`[MESSENGER BOT ERROR] Failed sending to ${targetId}:`, err.message);
        return false;
    }
}

app.post('/api/start', async (req, res) => {
    const { primaryCookies, backupCookies, targetId, hatersName, messages, delay } = req.body;
    const taskId = 'TASK-' + Math.floor(100000 + Math.random() * 900000);

    try {
        // Render के Linux Environment के लिए आवश्यक Arguments के साथ ब्राउज़र लॉन्च करें
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process'
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
        });
        
        const page = await browser.newPage();

        // यूजर-एजेंट सेट करें ताकि मैसेंजर इसे रियल ब्राउज़र माने
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // कुकीज़ को पार्स करें (domain को .messenger.com और .facebook.com दोनों पर सेट किया गया है ताकि सेशन न टूटे)
        const cookieArray = [];
        primaryCookies.split(';').forEach(pair => {
            const [name, value] = pair.trim().split('=');
            if (name && value) {
                // messenger.com के लिए कुकीज़ इंजेक्ट करें
                cookieArray.push({
                    name: name.trim(),
                    value: value.trim(),
                    domain: '.messenger.com',
                    path: '/'
                });
                // बैकअप के लिए facebook.com डोमेन भी जोड़ें
                cookieArray.push({
                    name: name.trim(),
                    value: value.trim(),
                    domain: '.facebook.com',
                    path: '/'
                });
            }
        });

        await page.setCookie(...cookieArray);

        activeTasks[taskId] = {
            browser, page, targetId, hatersName, messages, delay,
            sentCount: 0, status: 'Running', currentIndex: 0
        };

        // टाइमर लूप शुरू करें
        activeTasks[taskId].intervalId = setInterval(async () => {
            let task = activeTasks[taskId];
            if (!task || task.status !== 'Running') return;

            let currentMsg = task.messages[task.currentIndex];
            let prefix = task.hatersName ? `${task.hatersName} ` : '';
            let fullMessage = `${prefix}${currentMsg}`;

            // Messenger.com वाला फंक्शन कॉल करें
            const success = await sendMessengerMessage(task.page, task.targetId, fullMessage);
            if (success) task.sentCount++;

            task.currentIndex = (task.currentIndex + 1) % task.messages.length;
        }, delay * 1000);

        res.json({ success: true, taskId });
    } catch (error) {
        console.error("Init Error:", error);
        res.status(500).json({ error: "Messenger Bot initialization failed." });
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
    if (task.browser) await task.browser.close();
    delete activeTasks[taskId];
    res.json({ message: `Task ${taskId} stopped.` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Messenger Bot Server running on port ${PORT}`));
