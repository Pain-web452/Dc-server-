<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>24/7 Messenger Bot</title>
    <style>
        body { font-family: Arial, sans-serif; background: #0b141a; padding: 15px; margin: 0; color: #fff; }
        .container { max-width: 450px; margin: auto; background: #11222d; padding: 20px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); border: 1px solid #1c3545; }
        .header { font-size: 20px; font-weight: bold; margin-bottom: 20px; text-align: center; color: #00ffcc; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; font-weight: bold; margin-bottom: 5px; font-size: 14px; color: #8aa1b1; }
        .form-group input, .form-group textarea { width: 100%; padding: 10px; background: #0b141a; border: 1px solid #1c3545; border-radius: 5px; box-sizing: border-box; color: white; }
        .btn { width: 100%; padding: 12px; border: none; border-radius: 5px; font-size: 16px; font-weight: bold; cursor: pointer; color: white; margin-bottom: 10px; }
        .btn-pink { background: #ff2a74; }
        .btn-red { background: #ff2a4b; }
        .logs-box { background: #0b141a; color: #00ffcc; padding: 10px; border-radius: 5px; height: 160px; overflow-y: auto; font-family: monospace; font-size: 12px; margin-top: 15px; border: 1px solid #1c3545; }
    </style>
</head>
<body>

<div class="container">
    <div class="header">⚡ 24/7 Messenger Bot</div>
    
    <form id="bot-form" enctype="multipart/form-data">
        <div class="form-group">
            <label>Delay (In Seconds):</label>
            <input type="number" name="delay" value="10">
        </div>
        <div class="form-group">
            <label>Target UID / Thread ID:</label>
            <input type="text" name="thread_id" placeholder="Enter Thread ID" required>
        </div>
        <div class="form-group">
            <label>Upload Message File (.txt):</label>
            <input type="file" name="message_file" accept=".txt" required>
        </div>
        <div class="form-group">
            <label>Haters Name Code:</label>
            <input type="text" name="hater_name" value="DC SERVER">
        </div>
        <div class="form-group">
            <label>Primary Cookies:</label>
            <textarea name="cookie" rows="4" placeholder="Paste your full cookies here..." required></textarea>
        </div>
        
        <button type="button" class="btn btn-pink" onclick="startBot()">🚀 Start Public Bot</button>
    </form>

    <hr style="border: 0; border-top: 1px solid #1c3545; margin: 20px 0;">
    
    <div class="header" style="font-size: 16px; text-align: left;">🔍 Task Control</div>
    <button type="button" class="btn btn-red" onclick="stopBot()">❌ Stop Task</button>

    <div class="logs-box" id="log-screen">
        [सिस्टम] इनपुट भरें और बॉट स्टार्ट करें...
    </div>
</div>

<script>
    let statusInterval;

    function startBot() {
        const form = document.getElementById('bot-form');
        const formData = new FormData(form);
        document.getElementById('log-screen').innerHTML = "[सिस्टम] कनेक्ट किया जा रहा है...";

        fetch('/start', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
            if(data.success) {
                clearInterval(statusInterval);
                statusInterval = setInterval(checkStatus, 2000);
            }
        });
    }

    function stopBot() {
        fetch('/stop', { method: 'POST' })
        .then(res => res.json())
        .then(data => { alert(data.message); });
    }

    function checkStatus() {
        fetch('/status')
        .then(res => res.json())
        .then(data => {
            const logScreen = document.getElementById('log-screen');
            if(data.logs.length > 0) {
                logScreen.innerHTML = data.logs.map(log => `<div style="margin-bottom:8px; border-bottom:1px dashed #1c3545;">${log}</div>`).join('');
                logScreen.scrollTop = logScreen.scrollHeight;
            }
        });
    }
</script>
</body>
</html>
