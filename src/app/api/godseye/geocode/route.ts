import { NextRequest, NextResponse } from 'next/server';
import { GODS_EYE_PRESETS, buildGodsEyeUrl, cleanGeographicQuery, type GeoLocation } from '@/lib/godseye';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  if (!query || !query.trim()) {
    return NextResponse.json({ error: 'Query parameter q is required', success: false }, { status: 400 });
  }

  const cleanQuery = cleanGeographicQuery(query);
  if (!cleanQuery) {
    return NextResponse.json({ error: 'Query parameter q is empty after normalization', success: false }, { status: 400 });
  }

  const lowerQuery = cleanQuery.toLowerCase();

  // 1. Check curated intelligence presets first
  const matchedPreset = GODS_EYE_PRESETS.find((p) => {
    const pName = p.name.toLowerCase();
    const pBase = pName.split(',')[0].trim();
    return pName === lowerQuery || pBase === lowerQuery || lowerQuery === pName;
  });

  if (matchedPreset) {
    return NextResponse.json({
      success: true,
      query: cleanQuery,
      name: matchedPreset.name,
      lat: matchedPreset.lat,
      lon: matchedPreset.lon,
      alt: matchedPreset.alt || 1800,
      pitch: matchedPreset.pitch || -45,
      heading: matchedPreset.heading || 0,
      formattedAddress: matchedPreset.formattedAddress || matchedPreset.name,
      category: matchedPreset.category || 'landmark',
      source: 'preset',
      godsEyeUrl: buildGodsEyeUrl(matchedPreset.lat, matchedPreset.lon, matchedPreset.alt || 1800, { embed: false }),
      embedUrl: buildGodsEyeUrl(matchedPreset.lat, matchedPreset.lon, matchedPreset.alt || 1800, { embed: true }),
    });
  }

  // 2. Query OpenStreetMap Nominatim
  try {
    const osmRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=json&addressdetails=1&limit=3`,
      {
        headers: { 'User-Agent': 'GodsEyeGeospatial/2.0 (Hermes Studio Engine)' },
        cache: 'no-store',
        signal: AbortSignal.timeout(4500),
      }
    );

    if (osmRes.ok) {
      const results = await osmRes.json();
      if (Array.isArray(results) && results.length > 0) {
        const item = results[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);

        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const type = (item.type || '').toLowerCase();
          const placeClass = (item.class || '').toLowerCase();
          const bbox = item.boundingbox; // [minLat, maxLat, minLon, maxLon]

          let alt = 1800;
          let pitch = -45;
          let category: GeoLocation['category'] = 'landmark';

          if (Array.isArray(bbox) && bbox.length === 4) {
            const minLat = parseFloat(bbox[0]);
            const maxLat = parseFloat(bbox[1]);
            const minLon = parseFloat(bbox[2]);
            const maxLon = parseFloat(bbox[3]);

            const latSpan = Math.abs(maxLat - minLat);
            const lonSpan = Math.abs(maxLon - minLon);
            const maxSpan = Math.max(latSpan, lonSpan);

            // Compute intelligent altitude & camera pitch based on geographic scale
            if (type === 'country' || (placeClass === 'boundary' && maxSpan > 7.0)) {
              alt = Math.min(5500000, Math.max(1200000, Math.round(maxSpan * 111000 * 1.5)));
              pitch = -85; // Top-down framing for countries
              category = 'country';
            } else if (maxSpan > 1.2 || type === 'state' || type === 'province') {
              alt = Math.min(1200000, Math.max(180000, Math.round(maxSpan * 111000 * 1.3)));
              pitch = -70; // High oblique for states/provinces
              category = 'custom';
            } else if (maxSpan > 0.08 || type === 'city' || type === 'administrative' || type === 'town') {
              alt = Math.min(75000, Math.max(16000, Math.round(maxSpan * 111000 * 1.1)));
              pitch = -55; // Oblique view revealing city skyline and geography
              category = 'capital';
            } else {
              alt = 1800;
              pitch = -45; // Landmark angle showing 3D photorealistic buildings and terrain
              category = 'landmark';
            }
          }

          // Format clean address
          let cleanAddress = item.display_name || cleanQuery;
          if (item.address) {
            const parts = [
              item.address.attraction || item.address.building || item.address.suburb || item.address.city || item.address.town,
              item.address.state || item.address.region,
              item.address.country,
            ].filter(Boolean);
            if (parts.length > 0) {
              cleanAddress = parts.join(', ');
            }
          }

          return NextResponse.json({
            success: true,
            query: cleanQuery,
            name: item.name || cleanQuery,
            lat,
            lon,
            alt,
            pitch,
            heading: 0,
            formattedAddress: cleanAddress,
            category,
            source: 'nominatim',
            godsEyeUrl: buildGodsEyeUrl(lat, lon, alt, { pitch, embed: false }),
            embedUrl: buildGodsEyeUrl(lat, lon, alt, { pitch, embed: true }),
          });
        }
      }
    }
  } catch (err: any) {
    console.warn('Nominatim geocoding error:', err.message);
  }

  // 3. Query Photon Geocoder as secondary fallback
  try {
    const photonRes = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=1`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(4500),
      }
    );

    if (photonRes.ok) {
      const data = await photonRes.json();
      const feature = data?.features?.[0];
      if (feature?.geometry?.coordinates) {
        const [lon, lat] = feature.geometry.coordinates;
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const props = feature.properties || {};
          const name = props.name || cleanQuery;
          const country = props.country || '';
          const state = props.state || '';
          const cleanAddress = [name, state, country].filter(Boolean).join(', ');

          return NextResponse.json({
            success: true,
            query: cleanQuery,
            name,
            lat,
            lon,
            alt: 2500,
            pitch: -50,
            heading: 0,
            formattedAddress: cleanAddress,
            category: 'custom',
            source: 'photon',
            godsEyeUrl: buildGodsEyeUrl(lat, lon, 2500, { embed: false }),
            embedUrl: buildGodsEyeUrl(lat, lon, 2500, { embed: true }),
          });
        }
      }
    }
  } catch (err: any) {
    console.warn('Photon geocoding error:', err.message);
  }

  // 4. If resolution fails: REPORT FAILURE (Do NOT fabricate or fallback to Area 51 / Pentagon!)
  return NextResponse.json(
    {
      success: false,
      error: `Geographic resolution failed: "${cleanQuery}" could not be located on the global map.`,
      query: cleanQuery,
    },
    { status: 404 }
  );
}
