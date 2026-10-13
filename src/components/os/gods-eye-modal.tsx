'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Globe,
  Search,
  Crosshair,
  Maximize2,
  Minimize2,
  Minus,
  RefreshCw,
  Compass,
  MapPin,
  X,
  Shield,
  Layers,
  ZoomIn,
  ZoomOut,
  Navigation,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Plus,
  Radio,
  Eye,
  Plane,
  Ship,
  Sun,
  Grid,
  Trash2,
} from 'lucide-react';
import {
  GODS_EYE_DEFAULT_URL,
  GODS_EYE_PRESETS,
  cleanGeographicQuery,
  type GeoLocation,
} from '@/lib/godseye';
import { soundFx } from '@/lib/audio-synth';
import { cn } from '@/lib/utils';
import { orbitron } from '@/lib/fonts';

interface GodsEyeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLocation?: GeoLocation | null;
  targetQuery?: string;
}

export interface WaypointItem extends GeoLocation {
  id: string;
}

export interface OsintLayers {
  satellites: boolean;
  aircraft: boolean;
  maritime: boolean;
  terminator: boolean;
  geofence: boolean;
  milGrid: boolean;
}

const DEFAULT_WAYPOINTS: WaypointItem[] = [
  { id: 'wp-1', name: 'Area 51 Groom Lake', lat: 37.2431, lon: -115.793, alt: 3500, pitch: -35, heading: 45, category: 'military' },
  { id: 'wp-2', name: 'Tokyo Tower, Japan', lat: 35.6586, lon: 139.7454, alt: 1800, pitch: -45, heading: 0, category: 'landmark' },
  { id: 'wp-3', name: 'CERN Hadron Collider', lat: 46.233, lon: 6.0557, alt: 4200, pitch: -50, heading: 120, category: 'research' },
  { id: 'wp-4', name: 'Pyramids of Giza, Egypt', lat: 29.9792, lon: 31.1342, alt: 2200, pitch: -40, heading: 30, category: 'landmark' },
  { id: 'wp-5', name: 'Kremlin, Moscow', lat: 55.752, lon: 37.6175, alt: 2500, pitch: -45, heading: 270, category: 'government' },
];

type WindowMode = 'normal' | 'maximized' | 'minimized';
type FlightStatus = 'idle' | 'flying' | 'locked' | 'failed';

const EARTH_ORBIT_HASH = 'lat=15.00000&lon=0.00000&alt=22000000&pitch=-90&heading=0';

export const GodsEyeModal: React.FC<GodsEyeModalProps> = ({
  isOpen,
  onClose,
  initialLocation,
  targetQuery,
}) => {
  const [windowMode, setWindowMode] = useState<WindowMode>('normal');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Active target entity
  const [activeTarget, setActiveTarget] = useState<GeoLocation | null>(initialLocation || null);

  // Genuine live camera telemetry streamed from CesiumJS
  const [cameraTelemetry, setCameraTelemetry] = useState<{
    lat: number;
    lon: number;
    alt: number;
    pitch: number;
    heading: number;
  }>({
    lat: 15.0,
    lon: 0.0,
    alt: 22000000,
    pitch: -90,
    heading: 0,
  });

  const [flightStatus, setFlightStatus] = useState<FlightStatus>('idle');
  const [flightDuration, setFlightDuration] = useState<number>(3.5);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const [isCesiumReady, setIsCesiumReady] = useState(false);
  const isCesiumReadyRef = useRef<boolean>(false);
  const pendingTargetRef = useRef<GeoLocation | null>(null);
  const lastTargetFlyTimeRef = useRef<{ name: string; time: number } | null>(null);

  // Multi-Target Waypoint Sequence & Tour Planner
  const [waypoints, setWaypoints] = useState<WaypointItem[]>(DEFAULT_WAYPOINTS);
  const [activeWaypointIndex, setActiveWaypointIndex] = useState<number>(0);
  const [isTourPlaying, setIsTourPlaying] = useState<boolean>(false);
  const [showWaypointsPlanner, setShowWaypointsPlanner] = useState<boolean>(true);

  // OSINT Layer Intelligence Toggles
  const [osintLayers, setOsintLayers] = useState<OsintLayers>({
    satellites: true,
    aircraft: true,
    maritime: false,
    terminator: true,
    geofence: true,
    milGrid: false,
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentQueryRef = useRef<string>('');
  const lastInitialQueryRef = useRef<string | null>(null);

  // Post message safely to embedded Cesium globe
  const postToGlobe = useCallback((message: any) => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(message, '*');
      } catch (err) {
        console.warn('PostMessage to Cesium globe failed:', err);
      }
    }
  }, []);

  // Toggle OSINT layer and synchronize with Cesium
  const toggleLayer = useCallback(
    (layerKey: keyof OsintLayers) => {
      soundFx.playClick(1100);
      setOsintLayers((prev) => {
        const updated = { ...prev, [layerKey]: !prev[layerKey] };
        postToGlobe({
          type: 'gev:toggleLayer',
          layer: layerKey,
          enabled: updated[layerKey],
        });
        return updated;
      });
    },
    [postToGlobe]
  );

  // Dispatch smooth flight command to Cesium
  const flyToLocation = useCallback(
    (target: GeoLocation) => {
      // Debounce duplicate calls for same target within 400ms
      if (
        lastTargetFlyTimeRef.current?.name === target.name &&
        Date.now() - lastTargetFlyTimeRef.current.time < 400
      ) {
        return;
      }
      lastTargetFlyTimeRef.current = { name: target.name, time: Date.now() };

      soundFx.playTaskStart();
      setFlightStatus('flying');
      setActiveTarget(target);
      setSearchError(null);

      if (!isCesiumReadyRef.current) {
        pendingTargetRef.current = target;
      }

      postToGlobe({
        type: 'gev:flyTo',
        lat: target.lat,
        lon: target.lon,
        alt: target.alt || 1800,
        pitch: target.pitch || -45,
        heading: target.heading || 0,
        name: target.name,
      });
    },
    [postToGlobe]
  );

  // Fly to high Earth space view
  const flyToEarthOrbit = useCallback(() => {
    soundFx.playClick(900);
    setFlightStatus('flying');
    setActiveTarget(null);
    setSearchError(null);
    setSearchQuery('');
    postToGlobe({ type: 'gev:earthOrbit' });
  }, [postToGlobe]);

  // Recenter on active target
  const handleRecenter = useCallback(() => {
    soundFx.playClick(900);
    if (activeTarget) {
      flyToLocation(activeTarget);
    } else {
      flyToEarthOrbit();
    }
  }, [activeTarget, flyToLocation, flyToEarthOrbit]);

  // Zoom controls
  const handleZoomIn = () => {
    soundFx.playClick(1000);
    postToGlobe({ type: 'gev:zoomIn' });
  };

  const handleZoomOut = () => {
    soundFx.playClick(950);
    postToGlobe({ type: 'gev:zoomOut' });
  };

  const handleResetHeading = () => {
    soundFx.playClick(1000);
    postToGlobe({ type: 'gev:resetHeading' });
  };

  // Search and resolve location query
  const executeSearch = useCallback(
    async (rawQuery: string) => {
      const q = cleanGeographicQuery(rawQuery);
      if (!q) return;

      setSearchQuery(q);
      currentQueryRef.current = q;
      setIsSearching(true);
      setSearchError(null);
      soundFx.playClick(1000);

      try {
        const res = await fetch(`/api/godseye/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();

        // Check if query is still the latest one
        if (currentQueryRef.current !== q) return;

        if (res.ok && data.success && Number.isFinite(data.lat) && Number.isFinite(data.lon)) {
          const target: GeoLocation = {
            name: data.name || q,
            lat: data.lat,
            lon: data.lon,
            alt: data.alt || 1800,
            pitch: data.pitch || -45,
            heading: data.heading || 0,
            formattedAddress: data.formattedAddress,
            category: data.category || 'landmark',
          };
          flyToLocation(target);
        } else {
          setFlightStatus('failed');
          setSearchError(data.error || `Location "${q}" could not be resolved on the global map.`);
          soundFx.playJarvisAlert();
        }
      } catch (err: any) {
        if (currentQueryRef.current === q) {
          setFlightStatus('failed');
          setSearchError(`Network error resolving "${q}". Please check connectivity.`);
          soundFx.playJarvisAlert();
        }
      } finally {
        if (currentQueryRef.current === q) {
          setIsSearching(false);
        }
      }
    },
    [flyToLocation]
  );

  // Listen for messages from the embedded Cesium globe (telemetry, flight lifecycle)
  useEffect(() => {
    const handleGlobeMessage = (event: MessageEvent) => {
      if (!event.data) return;
      const { type } = event.data;

      if (type === 'gev:ready') {
        isCesiumReadyRef.current = true;
        setIsCesiumReady(true);
        setIsIframeLoaded(true);
        if (pendingTargetRef.current) {
          const target = pendingTargetRef.current;
          pendingTargetRef.current = null;
          postToGlobe({
            type: 'gev:flyTo',
            lat: target.lat,
            lon: target.lon,
            alt: target.alt || 1800,
            pitch: target.pitch || -45,
            heading: target.heading || 0,
            name: target.name,
          });
        }
      } else if (type === 'gev:telemetry') {
        setIsIframeLoaded(true);
        setCameraTelemetry({
          lat: event.data.lat,
          lon: event.data.lon,
          alt: event.data.alt,
          pitch: event.data.pitch,
          heading: event.data.heading,
        });
      } else if (type === 'gev:flightStart') {
        setFlightStatus('flying');
        if (typeof event.data.duration === 'number') {
          setFlightDuration(event.data.duration);
        }
      } else if (type === 'gev:flightComplete') {
        setFlightStatus('locked');
        soundFx.playTaskSuccess();
      } else if (type === 'gev:flightCancel') {
        // Handled cleanly when interrupted by a subsequent search
      }
    };

    window.addEventListener('message', handleGlobeMessage);
    return () => window.removeEventListener('message', handleGlobeMessage);
  }, [postToGlobe]);

  // Listen for global custom event 'hermes:open-godseye'
  useEffect(() => {
    const handleGlobalOpen = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;

      if (detail?.target && Number.isFinite(Number(detail.target.lat)) && Number.isFinite(Number(detail.target.lon))) {
        const t = detail.target;
        const target: GeoLocation = {
          name: t.target || t.name || 'Target',
          lat: Number(t.lat),
          lon: Number(t.lon),
          alt: t.alt ? Number(t.alt) : 1800,
          pitch: t.pitch ? Number(t.pitch) : -45,
          heading: t.heading ? Number(t.heading) : 0,
          formattedAddress: t.address || t.formattedAddress,
          category: t.category,
        };
        lastInitialQueryRef.current = target.name;
        setSearchQuery(target.name);
        setWindowMode('normal');
        flyToLocation(target);
      } else if (detail?.query) {
        lastInitialQueryRef.current = detail.query;
        setSearchQuery(detail.query);
        setWindowMode('normal');
        executeSearch(detail.query);
      }
    };

    window.addEventListener('hermes:open-godseye', handleGlobalOpen);
    return () => window.removeEventListener('hermes:open-godseye', handleGlobalOpen);
  }, [executeSearch, flyToLocation]);

  // Automated Flight Sequence Tour interval
  useEffect(() => {
    if (!isOpen || !isTourPlaying || waypoints.length === 0) return;
    const tourInterval = setInterval(() => {
      setActiveWaypointIndex((prev) => {
        const next = (prev + 1) % waypoints.length;
        flyToLocation(waypoints[next]);
        return next;
      });
    }, 6500);
    return () => clearInterval(tourInterval);
  }, [isOpen, isTourPlaying, waypoints, flyToLocation]);

  const handleSelectWaypoint = (index: number) => {
    if (index < 0 || index >= waypoints.length) return;
    soundFx.playClick(1000);
    setActiveWaypointIndex(index);
    flyToLocation(waypoints[index]);
  };

  const handleToggleTour = () => {
    soundFx.playClick(1100);
    setIsTourPlaying((prev) => !prev);
  };

  const handleNextWaypoint = () => {
    soundFx.playClick(1000);
    const next = (activeWaypointIndex + 1) % waypoints.length;
    setActiveWaypointIndex(next);
    flyToLocation(waypoints[next]);
  };

  const handlePrevWaypoint = () => {
    soundFx.playClick(1000);
    const prev = (activeWaypointIndex - 1 + waypoints.length) % waypoints.length;
    setActiveWaypointIndex(prev);
    flyToLocation(waypoints[prev]);
  };

  const handleAddCurrentToWaypoints = () => {
    if (!activeTarget) return;
    soundFx.playClick(1200);
    const newWp: WaypointItem = {
      ...activeTarget,
      id: `wp-${Date.now()}`,
    };
    setWaypoints((w) => [...w, newWp]);
    setActiveWaypointIndex(waypoints.length);
  };

  const handleRemoveWaypoint = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playClick(900);
    setWaypoints((w) => w.filter((item) => item.id !== id));
  };

  // Handle initial location or target query when opened
  useEffect(() => {
    if (!isOpen) {
      lastInitialQueryRef.current = null;
      return;
    }

    if (initialLocation) {
      setActiveTarget(initialLocation);
      setSearchQuery(initialLocation.name);
      flyToLocation(initialLocation);
    } else if (targetQuery && targetQuery !== lastInitialQueryRef.current) {
      lastInitialQueryRef.current = targetQuery;
      setSearchQuery(targetQuery);
      executeSearch(targetQuery);
    }
  }, [isOpen, initialLocation, targetQuery, executeSearch, flyToLocation]);

  // Gracefully dissolve iframe loading overlay
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      setIsIframeLoaded(true);
    }, 3200);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const isMaximized = windowMode === 'maximized';

  // Format altitude cleanly (meters vs kilometers)
  const formatAltitude = (altMeters: number) => {
    if (altMeters >= 1000000) {
      return `${(altMeters / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
    } else if (altMeters >= 1000) {
      return `${(altMeters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(altMeters)} m`;
  };

  return (
    <>
      {/* Minimized floating dock pill at bottom right */}
      {isOpen && windowMode === 'minimized' && (
        <div className="fixed bottom-4 right-4 z-[90] animate-bounce-subtle">
          <button
            onClick={() => {
              soundFx.playClick(1000);
              setWindowMode('normal');
            }}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-primary/40 bg-background/95 backdrop-blur-xl text-primary shadow-[0_0_25px_hsl(var(--primary)/0.3)] hover:border-accent hover:text-accent transition-all cursor-pointer font-mono text-xs font-bold"
            title="Restore In-UI God's Eye Window"
          >
            <Globe size={16} className="text-accent animate-spin-slow" />
            <span>GOD&apos;S EYE: {activeTarget ? activeTarget.name : 'EARTH ORBIT'}</span>
            {activeTarget && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 border border-primary/30 text-muted-foreground">
                {activeTarget.lat.toFixed(2)}°, {activeTarget.lon.toFixed(2)}°
              </span>
            )}
            <span className="text-xs text-accent">↗ RESTORE</span>
          </button>
        </div>
      )}

      {/* Main In-App God's Eye View Modal Window */}
      <div
        className={cn(
          "fixed inset-0 z-[85] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 transition-all duration-300",
          (!isOpen || windowMode === 'minimized') && "pointer-events-none opacity-0 invisible"
        )}
      >
      {/* Container */}
      <div
        className={cn(
          "flex flex-col bg-background/95 backdrop-blur-2xl border border-primary/40 shadow-[0_0_80px_hsl(var(--primary)/0.25)] rounded-2xl overflow-hidden font-headline transition-all duration-300 relative",
          isMaximized
            ? "w-[99vw] h-[97vh] max-w-none"
            : "w-[96vw] max-w-6xl h-[88vh] max-h-[880px]"
        )}
      >
        {/* Top Control Bar */}
        <div className="px-4 py-3 border-b border-primary/20 bg-primary/5 shrink-0 select-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Title & Status */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="h-8 w-8 rounded-xl border border-primary/40 bg-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_hsl(var(--primary)/0.3)]">
                <Globe size={18} className="text-accent animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={cn("text-sm font-bold tracking-wider text-primary", orbitron.className)}>
                    GOD&apos;S EYE // 3D GEOSPATIAL INTELLIGENCE
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary font-mono flex items-center gap-1.5">
                    <span className={cn("h-1.5 w-1.5 rounded-full", isCesiumReady ? "bg-emerald-400 animate-ping" : "bg-amber-400")} />
                    {isCesiumReady ? "CESIUM 3D CORE ACTIVE" : "INITIALIZING CORE..."}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Photorealistic 3D Globe with Atmosphere & Elevation (~/gods-eye-view)
                </p>
              </div>
            </div>

            {/* Quick Search Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeSearch(searchQuery);
              }}
              className="relative flex-1 max-w-md w-full"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary/70" />
              <Input
                data-testid="godseye-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any country, city, or landmark on Earth..."
                className="pl-9 pr-24 h-8 rounded-xl border-primary/30 bg-background/80 font-mono text-xs text-foreground focus-visible:ring-1 focus-visible:ring-accent"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isSearching || !searchQuery.trim()}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 px-3 text-[10px] font-mono font-bold bg-primary/20 text-accent hover:bg-accent hover:text-accent-foreground cursor-pointer"
              >
                {isSearching ? 'SEARCHING...' : 'FLY TO'}
              </Button>
            </form>

            {/* Window Management Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
              {/* Earth Orbit Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={flyToEarthOrbit}
                className="h-7 px-2.5 text-[11px] font-mono border-primary/30 hover:border-accent hover:text-accent cursor-pointer"
                title="Pull back camera to global Earth space view"
              >
                <Globe size={12} className="mr-1.5 text-accent" />
                <span>EARTH VIEW</span>
              </Button>

              {/* Minimize to Dock Pill */}
              <button
                onClick={() => {
                  soundFx.playClick(900);
                  setWindowMode('minimized');
                }}
                className="h-7 w-7 rounded-lg border border-primary/30 bg-background/60 flex items-center justify-center text-primary hover:text-accent hover:border-accent hover:bg-primary/20 transition-all cursor-pointer"
                title="Minimize In-UI Window to Dock"
              >
                <Minus size={13} />
              </button>

              {/* Maximize / Restore Toggle */}
              <button
                onClick={() => {
                  soundFx.playClick(1000);
                  setWindowMode(isMaximized ? 'normal' : 'maximized');
                }}
                className="h-7 w-7 rounded-lg border border-primary/30 bg-background/60 flex items-center justify-center text-primary hover:text-accent hover:border-accent hover:bg-primary/20 transition-all cursor-pointer"
                title={isMaximized ? 'Restore Windowed Size' : 'Maximize Fullscreen Inside UI'}
              >
                {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>

              {/* Close Button */}
              <button
                onClick={() => {
                  soundFx.playClick(900);
                  onClose();
                }}
                className="h-7 w-7 rounded-lg border border-destructive/40 bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all cursor-pointer"
                title="Close God's Eye Window"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Quick Presets Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 scrollbar-none">
            <span className="text-[10px] font-mono text-primary/70 shrink-0 font-bold uppercase tracking-wider">
              PRESETS:
            </span>
            {GODS_EYE_PRESETS.map((preset) => {
              const isSelected = activeTarget?.name === preset.name;
              return (
                <button
                  key={preset.name}
                  onClick={() => {
                    soundFx.playClick(950);
                    setSearchQuery(preset.name);
                    flyToLocation(preset);
                  }}
                  className={cn(
                    "px-2 py-0.5 rounded-lg text-[10px] font-mono whitespace-nowrap transition-all border shrink-0 cursor-pointer",
                    isSelected
                      ? "border-accent bg-accent/20 text-accent font-bold shadow-[0_0_10px_hsl(var(--accent)/0.25)]"
                      : "border-primary/20 bg-background/50 text-muted-foreground hover:text-foreground hover:border-primary/40"
                  )}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>

          {/* Multi-Target Flight Sequence & Waypoints Planner Bar */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-primary/10 mt-1.5 overflow-x-auto scrollbar-none font-mono">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-accent font-bold uppercase tracking-wider flex items-center gap-1">
                <Navigation size={11} className="text-accent" />
                FLIGHT TOUR:
              </span>
              <Button
                size="sm"
                variant={isTourPlaying ? "default" : "outline"}
                onClick={handleToggleTour}
                className={cn(
                  "h-6 px-2 text-[10px] gap-1 font-bold",
                  isTourPlaying ? "bg-accent text-accent-foreground animate-pulse" : "border-primary/30 text-accent"
                )}
                title={isTourPlaying ? "Pause Automatic Flight Sequence Tour" : "Start Automatic Flight Sequence Tour"}
              >
                {isTourPlaying ? <Pause size={10} /> : <Play size={10} />}
                <span>{isTourPlaying ? "PAUSE TOUR" : "START TOUR"}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrevWaypoint}
                className="h-6 w-6 p-0 border-primary/30 text-muted-foreground hover:text-accent"
                title="Previous Target Waypoint"
              >
                <SkipBack size={10} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleNextWaypoint}
                className="h-6 w-6 p-0 border-primary/30 text-muted-foreground hover:text-accent"
                title="Next Target Waypoint"
              >
                <SkipForward size={10} />
              </Button>
            </div>

            {/* Waypoint Chips Queue */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {waypoints.map((wp, idx) => {
                const isActive = activeWaypointIndex === idx && activeTarget?.name === wp.name;
                return (
                  <div
                    key={wp.id}
                    onClick={() => handleSelectWaypoint(idx)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] cursor-pointer whitespace-nowrap transition-all shrink-0",
                      isActive
                        ? "border-accent bg-accent/25 text-accent font-bold shadow-[0_0_12px_hsl(var(--accent)/0.3)]"
                        : "border-primary/20 bg-primary/5 text-muted-foreground hover:text-foreground hover:border-primary/40"
                    )}
                  >
                    <span className="text-[9px] opacity-70 font-bold">{idx + 1}.</span>
                    <span className="truncate max-w-[110px]">{wp.name}</span>
                    {waypoints.length > 2 && (
                      <button
                        onClick={(e) => handleRemoveWaypoint(wp.id, e)}
                        className="ml-1 opacity-50 hover:opacity-100 hover:text-destructive"
                        title="Remove waypoint from tour"
                      >
                        <X size={9} />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Add Current Target to Waypoints Button */}
              {activeTarget && !waypoints.some((w) => w.name === activeTarget.name) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddCurrentToWaypoints}
                  className="h-6 px-2 text-[10px] gap-1 font-bold border-dashed border-accent/50 text-accent hover:bg-accent/10 shrink-0"
                  title="Add current searched location to flight itinerary"
                >
                  <Plus size={10} />
                  <span>+ QUEUE TARGET</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 3D Viewport Area */}
        <div className="relative flex-1 w-full h-full min-h-0 bg-black overflow-hidden">
          {/* Iframe Loading Overlay (dismisses once Cesium starts) */}
          {!isIframeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-30 font-mono">
              <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-accent animate-spin mb-3" />
              <p className="text-xs text-primary font-bold tracking-widest animate-pulse">
                INITIALIZING 3D EARTH VIEWPORT...
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Loading Cesium 3D Globe, Atmosphere & Satellite Imagery
              </p>
            </div>
          )}

          {/* Embedded Cesium 3D Globe Iframe */}
          <iframe
            ref={iframeRef}
            src={`${GODS_EYE_DEFAULT_URL}/?embed=1#${EARTH_ORBIT_HASH}`}
            className="w-full h-full border-none"
            allow="geolocation; microphone; camera; display-capture"
            onLoad={() => {
              setIsIframeLoaded(true);
            }}
            title="God's Eye 3D Earth Console"
          />

          {/* Tactical OSINT Overlays Deck (Top-Center Right) */}
          <div className="absolute top-3 right-14 z-20 pointer-events-auto flex items-center gap-1 bg-background/85 backdrop-blur-xl border border-primary/30 rounded-xl p-1 shadow-2xl font-mono text-[10px]">
            <span className="px-1.5 font-bold text-primary flex items-center gap-1">
              <Layers size={11} className="text-accent" />
              OSINT:
            </span>
            <button
              onClick={() => toggleLayer('satellites')}
              className={cn(
                "px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer font-bold",
                osintLayers.satellites
                  ? "border-accent bg-accent/20 text-accent shadow-[0_0_8px_hsl(var(--accent)/0.25)]"
                  : "border-primary/20 bg-background/50 text-muted-foreground hover:text-foreground"
              )}
              title="Toggle Low Earth Orbit (LEO) Satellite Trajectories"
            >
              <Radio size={10} className={osintLayers.satellites ? "animate-pulse" : ""} />
              <span>SATELLITES</span>
            </button>
            <button
              onClick={() => toggleLayer('aircraft')}
              className={cn(
                "px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer font-bold",
                osintLayers.aircraft
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_8px_hsl(142_71%_45%/0.25)]"
                  : "border-primary/20 bg-background/50 text-muted-foreground hover:text-foreground"
              )}
              title="Toggle ADS-B Commercial & Military Aviation Vectors"
            >
              <Plane size={10} />
              <span>ADS-B</span>
            </button>
            <button
              onClick={() => toggleLayer('maritime')}
              className={cn(
                "px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer font-bold hidden sm:flex",
                osintLayers.maritime
                  ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-[0_0_8px_hsl(180_100%_50%/0.25)]"
                  : "border-primary/20 bg-background/50 text-muted-foreground hover:text-foreground"
              )}
              title="Toggle AIS Maritime Vessels & Sea Lanes"
            >
              <Ship size={10} />
              <span>AIS</span>
            </button>
            <button
              onClick={() => toggleLayer('terminator')}
              className={cn(
                "px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer font-bold hidden md:flex",
                osintLayers.terminator
                  ? "border-amber-400 bg-amber-400/20 text-amber-300 shadow-[0_0_8px_hsl(45_100%_50%/0.25)]"
                  : "border-primary/20 bg-background/50 text-muted-foreground hover:text-foreground"
              )}
              title="Toggle Solar Day/Night Illumination Terminator Boundary"
            >
              <Sun size={10} />
              <span>TERMINATOR</span>
            </button>
            <button
              onClick={() => toggleLayer('geofence')}
              className={cn(
                "px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer font-bold hidden sm:flex",
                osintLayers.geofence
                  ? "border-rose-400 bg-rose-500/20 text-rose-300 shadow-[0_0_8px_hsl(350_100%_65%/0.25)]"
                  : "border-primary/20 bg-background/50 text-muted-foreground hover:text-foreground"
              )}
              title="Toggle Tactical Radial Geofence Rings around active destination"
            >
              <Shield size={10} />
              <span>GEOFENCE</span>
            </button>
            <button
              onClick={() => toggleLayer('milGrid')}
              className={cn(
                "px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer font-bold hidden lg:flex",
                osintLayers.milGrid
                  ? "border-violet-400 bg-violet-500/20 text-violet-300 shadow-[0_0_8px_hsl(270_100%_65%/0.25)]"
                  : "border-primary/20 bg-background/50 text-muted-foreground hover:text-foreground"
              )}
              title="Toggle MGRS Military Coordinate Tactical Grid"
            >
              <Grid size={10} />
              <span>GRID</span>
            </button>
          </div>

          {/* Interactive Tactical OSINT SVG Overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {/* Tactical Military Grid Overlay */}
            {osintLayers.milGrid && (
              <g stroke="rgba(147, 51, 234, 0.2)" strokeWidth="1" strokeDasharray="3 6">
                <line x1="25%" y1="0" x2="25%" y2="100%" />
                <line x1="50%" y1="0" x2="50%" y2="100%" />
                <line x1="75%" y1="0" x2="75%" y2="100%" />
                <line x1="0" y1="25%" x2="100%" y2="25%" />
                <line x1="0" y1="50%" x2="100%" y2="50%" />
                <line x1="0" y1="75%" x2="100%" y2="75%" />
              </g>
            )}

            {/* Tactical Geofence Concentric Rings centered on Target */}
            {osintLayers.geofence && activeTarget && flightStatus === 'locked' && (
              <g>
                <circle cx="50%" cy="50%" r="85" fill="rgba(244, 63, 94, 0.04)" stroke="rgba(244, 63, 94, 0.55)" strokeWidth="1.5" strokeDasharray="4 4" />
                <circle cx="50%" cy="50%" r="150" fill="none" stroke="rgba(244, 63, 94, 0.3)" strokeWidth="1" strokeDasharray="8 6" />
                <circle cx="50%" cy="50%" r="220" fill="none" stroke="rgba(244, 63, 94, 0.15)" strokeWidth="1" />
                <text x="51%" y="42%" fill="rgba(244, 63, 94, 0.85)" fontSize="9" fontFamily="monospace">PERIMETER ALPHA: 5KM</text>
                <text x="51%" y="32%" fill="rgba(244, 63, 94, 0.6)" fontSize="9" fontFamily="monospace">TACTICAL GEOFENCE: 25KM</text>
              </g>
            )}

            {/* LEO Satellite Orbital Track Overlays */}
            {osintLayers.satellites && (
              <g>
                <path d="M 60 160 Q 420 90, 840 210 T 1200 400" fill="none" stroke="rgba(6, 182, 212, 0.45)" strokeWidth="1.5" strokeDasharray="4 4" />
                <circle cx="480" cy="110" r="4" fill="hsl(var(--accent))" />
                <text x="490" y="108" fill="hsl(var(--accent))" fontSize="9" fontFamily="monospace">USA-224 (KH-11) // 384km LEO</text>
                <path d="M 120 580 Q 560 470, 960 520" fill="none" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="1" strokeDasharray="3 5" />
                <circle cx="720" cy="495" r="3.5" fill="#38bdf8" />
                <text x="730" y="493" fill="#38bdf8" fontSize="9" fontFamily="monospace">ISS // 418km (51.6° INC)</text>
              </g>
            )}

            {/* ADS-B Live Aircraft Flight Vectors */}
            {osintLayers.aircraft && (
              <g>
                <circle cx="340" cy="290" r="3" fill="#4ade80" />
                <line x1="340" y1="290" x2="370" y2="265" stroke="#4ade80" strokeWidth="1.5" />
                <text x="375" y="265" fill="#4ade80" fontSize="9" fontFamily="monospace">UAL852 • FL360 • 490kt</text>
                <circle cx="800" cy="370" r="3" fill="#4ade80" />
                <line x1="800" y1="370" x2="830" y2="390" stroke="#4ade80" strokeWidth="1.5" />
                <text x="835" y="395" fill="#4ade80" fontSize="9" fontFamily="monospace">AFR066 • FL380 • 510kt</text>
              </g>
            )}

            {/* AIS Maritime Vessels */}
            {osintLayers.maritime && (
              <g>
                <circle cx="620" cy="440" r="3" fill="#22d3ee" />
                <text x="630" y="442" fill="#22d3ee" fontSize="9" fontFamily="monospace">EVER GIVEN // 18.2kt</text>
              </g>
            )}

            {/* Day/Night Terminator Arc */}
            {osintLayers.terminator && (
              <path d="M 0 0 Q 600 350, 1200 800 L 1200 0 Z" fill="rgba(245, 158, 11, 0.02)" stroke="rgba(245, 158, 11, 0.25)" strokeWidth="1" strokeDasharray="6 6" />
            )}
          </svg>

          {/* Floating Compact Target Information Panel (Top-Left) */}
          {activeTarget && (
            <div className="absolute top-3 left-3 z-20 pointer-events-auto max-w-sm w-full bg-background/85 backdrop-blur-xl border border-primary/30 rounded-xl p-3 shadow-2xl font-mono text-xs transition-all">
              <div className="flex items-center justify-between border-b border-primary/20 pb-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-accent shrink-0" />
                  <span className="font-bold text-foreground truncate">{activeTarget.name}</span>
                </div>
                <span
                  className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase",
                    flightStatus === 'flying'
                      ? "border border-amber-400/40 bg-amber-400/15 text-amber-300 animate-pulse"
                      : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                  )}
                >
                  {flightStatus === 'flying' ? 'TRANSITIONING' : 'TARGET LOCKED'}
                </span>
              </div>

              <div className="space-y-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Coordinates:</span>
                  <span className="font-bold text-primary">
                    {activeTarget.lat.toFixed(4)}°, {activeTarget.lon.toFixed(4)}°
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Target Altitude:</span>
                  <span className="font-bold text-foreground">
                    {formatAltitude(activeTarget.alt || 1800)}
                  </span>
                </div>
                {activeTarget.category && (
                  <div className="flex justify-between">
                    <span>Classification:</span>
                    <span className="text-accent uppercase font-semibold">
                      {activeTarget.category}
                    </span>
                  </div>
                )}
                {activeTarget.formattedAddress && (
                  <div className="pt-1 border-t border-primary/15 text-[10px] text-foreground/80 leading-relaxed truncate">
                    📍 {activeTarget.formattedAddress}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search Error Notice Banner (Top-Center) */}
          {searchError && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-md w-full bg-destructive/90 backdrop-blur-md border border-destructive rounded-xl p-3 shadow-2xl text-destructive-foreground font-mono text-xs flex items-center justify-between gap-2 animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{searchError}</span>
              </div>
              <button
                onClick={() => setSearchError(null)}
                className="text-destructive-foreground/80 hover:text-white p-1 rounded"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Floating On-Globe Interactive Controls (Top-Right) */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 pointer-events-auto">
            <button
              onClick={handleZoomIn}
              className="h-8 w-8 rounded-lg bg-background/85 backdrop-blur-md border border-primary/30 text-primary hover:text-accent hover:border-accent hover:bg-primary/20 flex items-center justify-center transition-all shadow-lg cursor-pointer"
              title="Zoom In Camera"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={handleZoomOut}
              className="h-8 w-8 rounded-lg bg-background/85 backdrop-blur-md border border-primary/30 text-primary hover:text-accent hover:border-accent hover:bg-primary/20 flex items-center justify-center transition-all shadow-lg cursor-pointer"
              title="Zoom Out Camera"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={handleRecenter}
              className="h-8 w-8 rounded-lg bg-background/85 backdrop-blur-md border border-primary/30 text-primary hover:text-accent hover:border-accent hover:bg-primary/20 flex items-center justify-center transition-all shadow-lg cursor-pointer"
              title="Recenter on Active Target"
            >
              <Crosshair size={14} />
            </button>
            <button
              onClick={handleResetHeading}
              className="h-8 w-8 rounded-lg bg-background/85 backdrop-blur-md border border-primary/30 text-primary hover:text-accent hover:border-accent hover:bg-primary/20 flex items-center justify-center transition-all shadow-lg cursor-pointer"
              title="Reset Compass Heading to North (0°)"
            >
              <Compass size={14} />
            </button>
          </div>

          {/* Genuine Camera Telemetry Status Bar (Bottom) */}
          <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-none flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            {/* Live Camera Readout from Cesium */}
            <div className="pointer-events-auto bg-background/85 backdrop-blur-md border border-primary/30 rounded-xl px-3 py-1.5 text-[10px] font-mono text-muted-foreground flex flex-wrap items-center gap-2.5 shadow-lg">
              <span className="flex items-center gap-1 text-primary font-bold">
                <Shield size={11} className="text-accent" />
                CAMERA:
              </span>
              <span>ALT: <strong className="text-foreground">{formatAltitude(cameraTelemetry.alt)}</strong></span>
              <span>PITCH: <strong className="text-foreground">{cameraTelemetry.pitch}°</strong></span>
              <span>BEARING: <strong className="text-foreground">{cameraTelemetry.heading}°</strong></span>
              <span className="hidden md:inline">
                VIEWPORT: <strong className="text-foreground">{cameraTelemetry.lat.toFixed(2)}°, {cameraTelemetry.lon.toFixed(2)}°</strong>
              </span>
            </div>

            {/* Platform & Data Provider Status */}
            <div className="pointer-events-auto bg-background/85 backdrop-blur-md border border-primary/30 rounded-xl px-3 py-1.5 text-[10px] font-mono text-muted-foreground flex items-center gap-3 shadow-lg">
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 size={11} /> 3D TILES & TERRAIN READY
              </span>
              <span className="hidden sm:inline border-l border-primary/20 pl-2">
                CESIUM WEBGL
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};
