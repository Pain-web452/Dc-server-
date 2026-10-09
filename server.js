const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// एक्टिव टास्क और ब्राउज़र सेशन्स को स्टोर करने के लिए ऑब्जेक्ट
const activeTasks = {};

// 1. नया टास्क (बॉट ब्राउज़र) शुरू करने की API
app.post('/api/start-task', async (req, res) => {
    const { taskId } = req.body;
    
    if (activeTasks[taskId]) {
        return res.json({ success: true, message: "Task already running" });
    }

    try {
        console.log(`[+] Starting browser for Task ID: ${taskId}`);
        
        // बिना ब्लॉक हुए बैकग्राउंड में ब्राउज़र चालू करना
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();
        
        // शुरुआती स्क्रीन साइज़ और यूजर एजेंट सेट करना
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // टास्क को मेमोरी में सेव करना
        activeTasks[taskId] = { browser, page };
        
        res.json({ success: true, message: "Task initialized successfully" });
    } catch (error) {
        console.error("Start Task Error:", error);
        res.status(500).json({ error: "Failed to start task" });
    }
});

// 2. कुकीज़ अपडेट करने और मैसेंजर एक्टिव करने की API (Updated for messenger.com)
app.post('/api/update-cookies', async (req, res) => {
    const { taskId, primaryCookies, backupCookies } = req.body;
    const task = activeTasks[taskId];
    
    if (!task) return res.status(404).json({ error: "Task not found. Please start the task first." });

    try {
        const activeCookies = primaryCookies || backupCookies;
        if (activeCookies) {
            const cookieArray = [];
            
            // कुकीज़ को बिना तोड़े सही तरीके से पार्स करना (xs टोकन फिक्स)
            activeCookies.split(';').forEach(pair => {
                const parts = pair.trim().split('=');
                const name = parts[0];
                const value = parts.slice(1).join('='); 
                
                if (name && value) {
                    const cleanName = name.trim();
                    const cleanValue = value.trim();

                    // मैसेंजर डोमेन के लिए कुकीज़ इंजेक्ट करना
                    cookieArray.push({ 
                        name: cleanName, value: cleanValue, 
                        domain: '.messenger.com', path: '/', 
                        secure: true, sameSite: 'None' 
                    });
                    
                    // सुरक्षा बायपास करने के लिए फेसबुक डोमेन पर भी मैप करना
                    cookieArray.push({ 
                        name: cleanName, value: cleanValue, 
                        domain: '.facebook.com', path: '/', 
                        secure: true, sameSite: 'None' 
                    });
                }
            });

            // ब्राउज़र का पुराना कैशे और कचरा कुकीज़ साफ़ करना
            const client = await task.page.target().createCDPSession();
            await client.send('Network.clearBrowserCookies');
            await client.send('Network.clearBrowserCache');

            // सुरक्षा बायपास के लिए 'wd' (विंडो डाइमेंशन) कुकी डालना जरूरी है
            cookieArray.push({ name: 'wd', value: '1920x937', domain: '.messenger.com', path: '/' });
            cookieArray.push({ name: 'wd', value: '1920x937', domain: '.facebook.com', path: '/' });

            // ब्राउज़र में नई कुकीज़ सेट करना
            await task.page.setCookie(...cookieArray);

            // यूजर एजेंट को दोबारा री-चेक करना
            await task.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            
            // कुकीज़ लोड करने के बाद मैसेंजर को लाइव रीलोड करना (ताकि इनिशियलाइजेशन फेल न हो)
            console.log(`[+] Initializing Messenger for Task ${taskId}...`);
            await task.page.goto('https://messenger.com', { waitUntil: 'networkidle2', timeout: 60000 });

            res.json({ success: true, message: "Cookies updated and Messenger successfully initialized!" });
        } else {
            res.status(400).json({ error: "No cookies provided" });
        }
    } catch (error) {
        console.error("Cookie Update Error:", error);
        res.status(500).json({ error: "Failed to update cookies" });
    }
});

// 3. टास्क को डिलीट/स्टॉप करने की API
app.post('/api/delete-task', async (req, res) => {
    const { taskId } = req.body;
    const task = activeTasks[taskId];

    if (!task) return res.status(404).json({ error: "Task not found" });

    try {
        console.log(`[-] Closing browser for Task ID: ${taskId}`);
        await task.browser.close();
        delete activeTasks[taskId];
        res.json({ success: true, message: "Task deleted successfully" });
    } catch (error) {
        console.error("Delete Task Error:", error);
        res.status(500).json({ error: "Failed to delete task" });
    }
});

// सर्वर पोर्ट सेटिंग्स
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`🚀 Messenger Bot Server running on port ${PORT}`);
    console.log(`=============================================`);
});
