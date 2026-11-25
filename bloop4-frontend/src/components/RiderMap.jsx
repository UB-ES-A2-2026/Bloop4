import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Tessel·les d'OpenStreetMap (decisió del Sprint 2): sense clau. L'atribució és obligatòria.
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * Mapa amb la posició del rider. Fa servir un cercle (no la icona per defecte de Leaflet, que
 * necessita imatges externes) i un segon cercle amb la precisió.
 */
export default function RiderMap({ latitude, longitude, accuracy, label }) {
  const container = useRef(null);
  const map = useRef(null);
  const layers = useRef(null);

  useEffect(() => {
    map.current = L.map(container.current, { zoomControl: true, attributionControl: true }).setView([latitude, longitude], 15);
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map.current);
    layers.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current.remove();
      map.current = null;
    };
    // El mapa es crea una sola vegada; les posicions noves s'actualitzen a l'efecte de sota.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current) return;
    layers.current.clearLayers();
    if (accuracy) L.circle([latitude, longitude], { radius: accuracy, weight: 1, fillOpacity: 0.1 }).addTo(layers.current);
    L.circleMarker([latitude, longitude], { radius: 9, weight: 3, fillOpacity: 0.9 }).bindTooltip(label).addTo(layers.current);
    map.current.panTo([latitude, longitude]);
  }, [latitude, longitude, accuracy, label]);

  return <div ref={container} className="rider-map" role="img" aria-label={`Mapa: ${label}`} />;
}
