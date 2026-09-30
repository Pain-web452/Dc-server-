import os
import time
import threading
import re
from datetime import datetime

from flask import Flask, render_template, request, jsonify

app = Flask(__name__, template_folder="templates")

# Global variables
server_status = "Deactivated"
stop_event = threading.Event()
bot_thread = None
logs_list = []


def run_messenger_bot(delay, thread_id, messages, hater_name):
    global server_status, logs_list

    server_status = "Active"

    # Thread ID में सिर्फ numbers रखें
    clean_thread_id = re.sub(r"[^0-9]", "", str(thread_id).strip())

    if not clean_thread_id:
        logs_list.append("[SYSTEM] ❌ Invalid Thread ID")
        server_status = "Deactivated"
        return

    # FIX: facebook.com और Thread ID के बीच "/" जरूरी है
    url = f"https://facebook.com/{clean_thread_id}"

    print(f"🤖 Bot Started")
    print(f"Thread ID: {clean_thread_id}")
    print(f"URL: {url}")

    message_index = 0

    while not stop_event.is_set():

        if not messages:
            logs_list.append("[SYSTEM] ❌ कोई मैसेज नहीं मिला।")
            break

        current_time = datetime.now().strftime("%I:%M:%S %p")

        raw_message = messages[message_index]
        final_message = f"{hater_name} {raw_message}"

        # Safe preview/dry-run
        log_entry = (
            f'"{hater_name}"<br>'
            f'[{current_time}] ✅ Prepared:<br>'
            f'"{final_message}"<br>'
            f'🔗 {url}'
        )

        logs_list.append(log_entry)

        if len(logs_list) > 15:
            logs_list.pop(0)

        message_index = (message_index + 1) % len(messages)

        # Delay
        try:
            delay_seconds = max(1, int(delay))
        except (ValueError, TypeError):
            delay_seconds = 10

        for _ in range(delay_seconds):
            if stop_event.is_set():
                break
            time.sleep(1)

    server_status = "Deactivated"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/start", methods=["POST"])
def start_bot():
    global bot_thread, stop_event

    if server_status == "Active":
        return jsonify({
            "success": False,
            "message": "बॉट पहले से ही चल रहा है!"
        })

    try:
        delay = request.form.get("delay", "10")
        thread_id = request.form.get("thread_id", "").strip()
        hater_name = request.form.get("hater_name", "DC SERVER").strip()

        msg_file = request.files.get("message_file")

        if not msg_file:
            return jsonify({
                "success": False,
                "message": "कृपया .txt फ़ाइल अपलोड करें!"
            })

        if not thread_id:
            return jsonify({
                "success": False,
                "message": "Thread ID गायब है!"
            })

        # Thread ID validate करें
        clean_thread_id = re.sub(r"[^0-9]", "", thread_id)

        if not clean_thread_id:
            return jsonify({
                "success": False,
                "message": "Invalid Thread ID!"
            })

        # Message file पढ़ें
        file_content = msg_file.read().decode("utf-8")

        messages = [
            line.strip()
            for line in file_content.splitlines()
            if line.strip()
        ]

        if not messages:
            return jsonify({
                "success": False,
                "message": "TXT file में कोई message नहीं मिला!"
            })

        # Previous stop event reset
        stop_event.clear()

        bot_thread = threading.Thread(
            target=run_messenger_bot,
            args=(
                delay,
                clean_thread_id,
                messages,
                hater_name
            ),
            daemon=True
        )

        bot_thread.start()

        return jsonify({
            "success": True,
            "message": "बॉट सफलतापूर्वक स्टार्ट हो गया है!",
            "thread_id": clean_thread_id,
            "url": f"https://facebook.com/{clean_thread_id}"
        })

    except UnicodeDecodeError:
        return jsonify({
            "success": False,
            "message": "TXT file UTF-8 format में होनी चाहिए!"
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"सर्वर एरर: {str(e)}"
        })


@app.route("/stop", methods=["POST"])
def stop_bot():
    global server_status

    stop_event.set()
    server_status = "Deactivated"

    return jsonify({
        "success": True,
        "message": "बॉट को रोक दिया गया है।"
    })


@app.route("/status", methods=["GET"])
def get_status():
    return jsonify({
        "status": server_status,
        "logs": logs_list
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))

    app.run(
        host="0.0.0.0",
        port=port,
        threaded=True
        )
    
