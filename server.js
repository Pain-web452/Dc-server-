const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// एक्टिव टास्क्स को स्टोर करने के लिए ऑब्जेक्ट
let activeTasks = {};

// फ्रंटएंड UI लोड करने के लिए
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// बोट स्टार्ट करने का वर्किंग API
app.post('/api/start-bot', (req, res) => {
    const { delay, targetId, messages, cookies } = req.body;
    
    // एक यूनिक टास्क आईडी जेनरेट करें
    const taskId = "TASK-" + Math.floor(1000 + Math.random() * 9000);
    
    let messageIndex = 0;
    
    console.log(`[${taskId}] Starting bot for Target: ${targetId} with delay ${delay}s`);

    // बैकग्राउंड लूप (Interval) सेट करें
    const intervalId = setInterval(async () => {
        if (!messages || messages.length === 0) return;
        
        const currentMessage = messages[messageIndex];
        messageIndex = (messageIndex + 1) % messages.length; // मेसेज रोटेशन

        try {
            console.log(`[${taskId}] Attempting to send message: "${currentMessage}"`);
            
            // फेसबुक मेसेंजर पर मेसेज सबमिट करने के लिए HTTP Axios Request
            // नोट: यह एक सिम्युलेटेड mbasic सबमिशन पाथ है। सुरक्षा के लिए सही कुकी हेडर पास किया गया है।
            await axios.post(
                `https://facebook.com`,
                new URLSearchParams({
                    'tids': `cid.c.${targetId}`,
                    'body': currentMessage,
                    'www_fb_clear_browser_cookie': 'false'
                }),
                {
                    headers: {
                        'Cookie': cookies,
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            console.log(`[${taskId}] Message sent successfully to ${targetId}`);
        } catch (error) {
            console.error(`[${taskId}] Failed to send message:`, error.message);
        }

    }, delay * 1000);

    // टास्क को मेमोरी में सेव रखें ताकि रोका जा सके
    activeTasks[taskId] = intervalId;

    res.json({ status: "success", message: "Bot process initialized.", taskId: taskId });
});

// बोट टास्क रोकने का API
app.post('/api/stop-bot', (req, res) => {
    const { taskId } = req.body;

    if (activeTasks[taskId]) {
        clearInterval(activeTasks[taskId]);
        delete activeTasks[taskId];
        console.log(`[${taskId}] Task stopped by user.`);
        res.json({ status: "success", message: `Task ${taskId} has been stopped.` });
    } else {
        res.status(404).json({ status: "error", message: "Task ID not found or already stopped." });
    }
});

app.listen(PORT, () => {
    console.log(`====== 24/7 MESSENGER BOT RUNNING ======`);
    console.log(`Local Web Panel URL: http://localhost:${PORT}`);
    console.log(`========================================`);
});
