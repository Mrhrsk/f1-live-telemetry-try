import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";

const MapContainer = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(mod => mod.Popup), { ssr: false });

import "leaflet/dist/leaflet.css";

const socket = io("http://localhost:5001");

export default function Home() {
  const [drivers, setDrivers] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [races, setRaces] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState("2024");
  const [selectedRace, setSelectedRace] = useState(null);
  const [circuitImage, setCircuitImage] = useState("");

  useEffect(() => {
    axios.get("http://localhost:5001/seasons").then((response) => {
      setSeasons(response.data);
    });
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      axios.get(`http://localhost:5001/races?season=${selectedSeason}`).then((response) => {
        setRaces(response.data);
      });
    }
  }, [selectedSeason]);

  useEffect(() => {
    if (selectedRace) {
      axios.get(`http://localhost:5001/circuit?race=${selectedRace}&season=${selectedSeason}`).then((response) => {
        setCircuitImage(response.data.image_url);
      }).catch(() => setCircuitImage(""));
    }
  }, [selectedRace]);

  const handleLiveSession = () => {
    setSelectedRace(null);
    setCircuitImage("");
    socket.emit("request_live_data");
  };

  return (
    <div className="flex flex-col items-center p-4 relative">
      <h1 className="text-2xl font-bold mb-4">F1 Live Telemetry</h1>
      
      <div className="flex gap-4 mb-4">
        <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)}>
          {seasons.map((season) => (
            <option key={season} value={season}>{season}</option>
          ))}
        </select>

        <select value={selectedRace} onChange={(e) => setSelectedRace(e.target.value)}>
          <option value="">Select Race</option>
          {races.map((race) => (
            <option key={race} value={race}>{race}</option>
          ))}
        </select>

        <button onClick={handleLiveSession} className="bg-red-500 text-white px-4 py-2 rounded">Live</button>
      </div>

      {circuitImage ? (
        <img
        src={circuitImage}
        alt="Circuit Layout"
        className="w-3/4 h-auto border border-gray-300"
        onError={(e) => e.target.src = "/fallback-track.png"} // Default image if not found
      />
      ) : (
        <MapContainer center={[25.0, 50.0]} zoom={13} style={{ height: "500px", width: "80%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {drivers.map((driver, index) => (
            <Marker key={index} position={[driver.y, driver.x]}>
              <Popup>
                <div>
                  <h2 className="font-bold">{driver.driver}</h2>
                  <p>Speed: {driver.speed} km/h</p>
                  <p>Lap Time: {driver.lap_time}</p>
                  <p>Position: {driver.position}</p>
                  <p>Gap: {driver.gap}</p>
                  <p>Pit Status: {driver.pit_status ? "In Pit" : "On Track"}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
}