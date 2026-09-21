const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Facebook Message Sender
async function sendFbMessage(cookie, targetId, message) {
    try {
        const url = `https://facebook.com{targetId}/messages`;
        await axios.post(url, {
            messaging_type: "RESPONSE",
            recipient: { id: targetId },
            message: { text: message }
        }, {
            headers: {
                'Cookie': cookie,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        console.log(`✅ Sent: "${message}"`);
        return true;
    } catch (error) {
        console.error(`❌ Send Failed:`, error.response ? error.response.data : error.message);
        return false;
    }
}

app.post('/start-bot', upload.single('messageFile'), async (req, res) => {
    const { primaryCookies, backupCookies, targetId, hatersName, manualMessages, delay } = req.body;
    let messages = [];

    if (req.file) {
        const fileContent = fs.readFileSync(req.file.path, 'utf-8');
        messages = fileContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        fs.unlinkSync(req.file.path);
    } else if (manualMessages) {
        messages = manualMessages.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    }

    if (messages.length === 0) {
        return res.send("⚠️ No messages found!");
    }

    res.send("🚀 Bot Render backend par start ho gaya hai! Logs check karein.");

    const delayMs = parseInt(delay) * 1000;
    let currentCookie = primaryCookies;

    for (let i = 0; i < messages.length; i++) {
        let msgToSend = messages[i];
        if (hatersName) {
            msgToSend = `${hatersName} ${msgToSend}`;
        }

        console.log(`[Loop] Message ${i+1}/${messages.length}`);
        let success = await sendFbMessage(currentCookie, targetId, msgToSend);

        if (!success && backupCookies) {
            console.log("🔄 Switching to Backup Cookie...");
            currentCookie = backupCookies;
            await sendFbMessage(currentCookie, targetId, msgToSend);
        }

        await sleep(delayMs);
    }
    console.log("🏁 Sequence Completed.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // --- RENDER ANTI-SLEEP SELF PINGER ---
    // Jab aapka app Render par chalega, ye har 5 minute mein khud ko ping karega taaki server soye nahi
    setInterval(() => {
        const myUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
        axios.get(myUrl)
            .then(() => console.log('🎯 Self-Ping: Server active rakhne ke liye auto hit kamiyab.'))
            .catch((err) => console.log('⚠️ Self-Ping delay, server response checked.'));
    }, 5 * 60 * 1000); // Har 5 minute mein loop chalega
});
