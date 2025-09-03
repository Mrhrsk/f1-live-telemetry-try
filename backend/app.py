from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import fastf1
import threading
import time
import requests

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

fastf1.Cache.enable_cache('f1_cache')

def fetch_live_telemetry():
    while True:
        session = fastf1.get_event(2024, "Saudi Arabian Grand Prix").get_race()
        session.load(laps=True, telemetry=True)

        drivers_data = []
        for drv in session.drivers:
            drv_data = session.laps.pick_driver(drv).iloc[-1]
            telemetry = drv_data.get_car_data().add_distance()

            if telemetry.empty or 'X' not in telemetry.columns or 'Y' not in telemetry.columns:
                continue

            latest_point = telemetry.iloc[-1]
            drivers_data.append({
                "driver": drv_data.Driver,
                "x": float(latest_point['X']),
                "y": float(latest_point['Y']),
                "speed": float(latest_point['Speed']),
                "lap_time": str(drv_data.LapTime),
                "position": int(drv_data.Position),
                "gap": str(drv_data.GapToLeader),
                "pit_status": drv_data.PitOutTime is not None
            })

        socketio.emit('telemetry_update', drivers_data)
        time.sleep(2)

@app.route('/seasons')
def get_seasons():
    return jsonify([year for year in range(2018, 2025)])

@app.route('/races')
def get_races():
    season = request.args.get('season', default=2024, type=int)
    event = fastf1.get_event_schedule(season)
    races = event['EventName'].tolist()
    return jsonify(races)

@app.route('/circuit')
def get_circuit_image():
    race = request.args.get('race', "")
    season = request.args.get('season', "2024")

    # Use Wikipedia circuit images (they follow a consistent pattern)
    formatted_race = race.replace(" Grand Prix", "").replace(" ", "_")
    wikipedia_image_url = f"https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/{formatted_race}_Circuit.png/800px-{formatted_race}_Circuit.png"

    return jsonify({"image_url": wikipedia_image_url})

@app.route('/')
def home():
    return jsonify({"status": "F1 Telemetry API Running"})

@socketio.on("request_live_data")
def handle_live_request():
    fetch_live_telemetry()

if __name__ == '__main__':
    telemetry_thread = threading.Thread(target=fetch_live_telemetry)
    telemetry_thread.daemon = True
    telemetry_thread.start()
    socketio.run(app, host='0.0.0.0', port=5001)
