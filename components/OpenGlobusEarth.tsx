import React, { useEffect, useRef } from 'react';
import { Globe, XYZ, PlanetCamera, LonLat } from '@openglobus/og';
import { ControlRefs } from '../types';

// Free tile sources (no API key required)
const ESRI_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

interface OpenGlobusEarthProps {
  controlRef: React.MutableRefObject<ControlRefs>;
}

const OpenGlobusEarth: React.FC<OpenGlobusEarthProps> = ({ controlRef }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<Globe | null>(null);
  const camRef = useRef<PlanetCamera | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const globe = new Globe({
      target: containerRef.current,
      name: 'earth',
      atmosphereEnabled: true,
      sun: { active: true },
      terrain: undefined as any, // no terrain provider for now
    });

    globeRef.current = globe;

    // Add satellite imagery layer
    const satelliteLayer = new XYZ('esri-satellite', {
      url: ESRI_SATELLITE,
      isBaseLayer: true,
      visibility: true,
      maxNativeZoom: 18,
      opacity: 1,
    });
    globe.planet.addLayer(satelliteLayer);

    // Add OSM labels overlay
    const osmLayer = new XYZ('osm', {
      url: OSM_URL,
      isBaseLayer: false,
      visibility: true,
      maxNativeZoom: 19,
      opacity: 0.5,
    });
    globe.planet.addLayer(osmLayer);

    // Initialize camera
    globe.planet.camera?.setAltitude(8000000);
    globe.planet.camera?.setLonLat(new LonLat(105, 35, 0));
    camRef.current = globe.planet.camera;

    // Handle resize
    const ro = new ResizeObserver(() => {
      globe.renderer?.resize();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      globe.destroy();
      globeRef.current = null;
      camRef.current = null;
    };
  }, []);

  // Gesture control integration
  useEffect(() => {
    let rafId: number;
    let lastFrameAt = performance.now();

    const tick = () => {
      const cam = camRef.current;
      if (!cam) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const now = performance.now();
      const delta = Math.min(Math.max((now - lastFrameAt) / 1000, 0), 0.05);
      lastFrameAt = now;

      const { rotationVelocity, zoomSpeed } = controlRef.current;
      const sensitivity = 0.005 * (controlRef.current.interactionSettings?.rotationSpeed ?? 5.0);

      // Horizontal rotation
      if (Math.abs(rotationVelocity.y) > 0.0001) {
        cam.rotateRight(rotationVelocity.y * sensitivity * 0.8 * delta, false);
      }
      // Vertical rotation (inverted to feel natural)
      if (Math.abs(rotationVelocity.x) > 0.0001) {
        cam.rotateUp(-rotationVelocity.x * sensitivity * 0.5 * delta);
      }

      // Zoom
      if (zoomSpeed !== 0) {
        const alt = cam.getAltitude();
        // Zoom is a normalized rate. Exponential integration keeps the
        // response stable across refresh rates and avoids large jumps after
        // a delayed frame.
        const newAlt = Math.max(1, alt * Math.exp(-zoomSpeed * 0.3 * delta));
        cam.setAltitude(newAlt);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [controlRef]);

  return (
    <div ref={containerRef} className="w-full h-full bg-black" />
  );
};

export default OpenGlobusEarth;
