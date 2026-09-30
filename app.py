import os
import time
import threading
import requests
from datetime import datetime
from flask import Flask, render_template, request, jsonify

app = Flask(__name__, template_folder='templates')

# ग्लोबल वेरिएबल्स
server_status = "Deactivated"
stop_event = threading.Event()
bot_thread = None
logs_list = []

def run_messenger_bot(delay, thread_id, messages, hater_name, cookie):
    global server_status, logs_list
    server_status = "Active"
    
    print(f"🤖 Bot Started for Thread: {thread_id}")
    message_index = 0
    
    while not stop_event.is_set():
        if not messages:
            logs_list.append("[SYSTEM] ❌ कोई मैसेज नहीं मिला।")
            break
            
        current_time = datetime.now().strftime("%I:%M:%S %p")
        raw_message = messages[message_index]
        final_message = f"{hater_name} {raw_message}"
        
        # बिल्कुल सही URL
        url = "https://facebook.com" + str(thread_id)
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            "Cookie": cookie,
            "Accept": "*/*",
            "Referer": f"https://facebook.com{thread_id}",
            "Origin": "https://facebook.com"
        }
        
        payload = {
            "body": final_message,
            "action_type": "ma-type:user-generated-message"
        }
        
        try:
            response = requests.post(url, headers=headers, data=payload, timeout=10)
            if response.status_code == 200:
                log_entry = f"\"{hater_name}\"<br>[{current_time}] ✅ Sent:<br>\"{final_message}\""
            else:
                log_entry = f"\"{hater_name}\"<br>[{current_time}] ❌ Failed: (Facebook Response {response.status_code})"
        except Exception as e:
            log_entry = f"[{current_time}] ❌ Error: {str(e)}"
            
        logs_list.append(log_entry)
        if len(logs_list) > 15:
            logs_list.pop(0)
            
        message_index = (message_index + 1) % len(messages)
        
        for _ in range(int(delay)):
            if stop_event.is_set():
                break
            time.sleep(1)
            
    server_status = "Deactivated"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/start', methods=['POST'])
def start_bot():
    global bot_thread, stop_event
    if server_status == "Active":
        return jsonify({"success": False, "message": "बॉट पहले से ही चल रहा है!"})
        
    try:
        delay = request.form.get('delay', 10)
        thread_id = request.form.get('thread_id')
        hater_name = request.form.get('hater_name', 'DC SERVER')
        cookie = request.form.get('cookie')
        
        msg_file = request.files.get('message_file')
        if not msg_file:
            return jsonify({"success": False, "message": "कृपया .txt फ़ाइल अपलोड करें!"})
            
        file_content = msg_file.read().decode('utf-8')
        messages = [line.strip() for line in file_content.split('\n') if line.strip()]
        
        if not cookie or not thread_id:
            return jsonify({"success": False, "message": "Cookie या Thread ID गायब है!"})
            
        stop_event.clear()
        bot_thread = threading.Thread(target=run_messenger_bot, args=(delay, thread_id, messages, hater_name, cookie))
        bot_thread.daemon = True
        bot_thread.start()
        
        return jsonify({"success": True, "message": "बॉट सफलतापूर्वक स्टार्ट हो गया है!"})
        
    except Exception as e:
        return jsonify({"success": False, "message": f"सर्वर एरर: {str(e)}"})

@app.route('/stop', methods=['POST'])
def stop_bot():
    stop_event.set()
    return jsonify({"success": True, "message": "बॉट को रोक दिया गया है।"})

@app.route('/status', methods=['GET'])
def get_status():
    return jsonify({"status": server_status, "logs": logs_list})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, threaded=True)
    
