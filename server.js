const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

const activeTasks = {};

app.get('/', (req, res) => {
    res.json({ status: "Online", message: "Lightweight Messenger API Server is ready!" });
});

// टास्क शुरू करने और सीधे मैसेज भेजने की API (बिना ब्राउज़र के)
app.post('/api/start-task', async (req, res) => {
    const { taskId, primaryCookies, targetId, messages, delay } = req.body;
    
    if (!primaryCookies || !targetId || !messages) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // टास्क को एक्टिव लिस्ट में डालना
    activeTasks[taskId] = { running: true };
    res.json({ success: true, message: "Task started successfully" });

    // बैकग्राउंड में लूप चलाना (24/7 सेंडिंग)
    const msgArray = messages.split('\n').filter(m => m.trim() !== '');
    let index = 0;

    // मैसेंजर कुकी से fb_dtsg टोकन निकालने का फंक्शन
    async function getFbDtsg(cookies) {
        try {
            const res = await axios.get(`https://messenger.com{targetId}/`, {
                headers: { 'Cookie': cookies, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            const match = res.data.match(/["']token["']:\s*["']([^"']+)["']/);
            return match ? match[1] : null;
        } catch (e) { return null; }
    }

    const fb_dtsg = await getFbDtsg(primaryCookies);
    if (!fb_dtsg) {
        console.log(`[-] Task ${taskId}: Failed to fetch fb_dtsg token. Cookies might be expired.`);
        activeTasks[taskId].running = false;
        return;
    }

    // सेंडिंग लूप
    while (activeTasks[taskId] && activeTasks[taskId].running) {
        if (index >= msgArray.length) index = 0; // मैसेज रिपीट करने के लिए
        const currentMsg = msgArray[index];

        try {
            await axios.post('https://messenger.com', 
                new URLSearchParams({
                    'fb_dtsg': fb_dtsg,
                    'body': currentMsg,
                    'message_batch[action_type]': 'ma-type:user-generated-message',
                    'message_batch[timestamp]': Date.now(),
                    'message_batch[body]': currentMsg,
                    'message_batch[specific_to_list][0]': `fbid:${targetId}`,
                    'message_batch[client_generated_message_id]': Math.floor(Math.random() * 1000000000000)
                }), 
                { headers: { 'Cookie': primaryCookies, 'Origin': 'https://messenger.com' } }
            );
            console.log(`[+] Sent to ${targetId}: ${currentMsg}`);
            index++;
        } catch (err) {
            console.log(`[-] Failed to send message. Retrying...`);
        }

        // यूजर द्वारा सेट किया गया डिले (Seconds to Milliseconds)
        await new Promise(resolve => setTimeout(resolve, (delay || 10) * 1000));
    }
});

app.post('/api/delete-task', (req, res) => {
    const { taskId } = req.body;
    if (activeTasks[taskId]) {
        activeTasks[taskId].running = false;
        delete activeTasks[taskId];
        return res.json({ success: true, message: "Task stopped successfully" });
    }
    res.status(404).json({ error: "Task not found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
