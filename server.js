// यह रूट पिछले बैकएंड कोड में सबसे नीचे (app.listen से ठीक पहले) जोड़ें
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
            // कुकीज़ लोड होने के बाद एक बार फिर होमपेज पर रीडायरेक्ट करें
            await task.page.goto('https://messenger.com', { waitUntil: 'networkidle2' });
            res.json({ message: `Task ${taskId} cookies updated successfully.` });
        } else {
            res.status(400).json({ error: "No cookies provided." });
        }
    } catch (error) {
        console.error("Update Cookies Error:", error);
        res.status(500).json({ error: "Failed to update cookies in browser session." });
    }
});
