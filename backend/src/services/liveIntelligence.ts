import axios from 'axios';

// API Keys from environment
const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY || '';
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';

// Round coordinates to 4 decimal places (~11 meters) to use as caching key
function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)}_${lng.toFixed(4)}`;
}

// In-memory caches to respect rate limits
const overpassCache = new Map<string, any>();
const osrmCache = new Map<string, any>();
const trafficCache = new Map<string, any>();
const weatherCache = new Map<string, any>();

// City Transport Hubs mapping for OSRM connectivity analysis
const CITY_HUBS: Record<string, { name: string; lat: number; lng: number }> = {
  Hyderabad: { name: 'Secunderabad Junction', lat: 17.4326, lng: 78.5023 },
  Bangalore: { name: 'Krantivira Sangolli Rayanna Central', lat: 12.9783, lng: 77.5694 },
  Chennai: { name: 'Chennai Central Railway Station', lat: 13.0822, lng: 80.2754 },
  Pune: { name: 'Pune Railway Station', lat: 18.5289, lng: 73.8744 },
  Mumbai: { name: 'Chhatrapati Shivaji Maharaj Terminus (CSTM)', lat: 18.9400, lng: 72.8353 },
};

// 1. Overpass API integration - Query nearby amenities
export async function fetchNearbyPlaces(lat: number, lng: number, radiusMeters: number = 1000): Promise<any[]> {
  const cacheKey = `${getCacheKey(lat, lng)}_${radiusMeters}`;
  if (overpassCache.has(cacheKey)) {
    console.log('[Cache] Returning cached Overpass data');
    return overpassCache.get(cacheKey);
  }

  const query = `
    [out:json][timeout:25];
    (
      node["amenity"~"restaurant|cafe|school|hospital|pharmacy|bank|bus_station"](around:${radiusMeters},${lat},${lng});
      way["amenity"~"restaurant|cafe|school|hospital|pharmacy|bank|bus_station"](around:${radiusMeters},${lat},${lng});
      node["shop"~"supermarket|mall|department_store|clothes|electronics"](around:${radiusMeters},${lat},${lng});
      way["shop"~"supermarket|mall|department_store|clothes|electronics"](around:${radiusMeters},${lat},${lng});
      node["office"~"company|government|financial"](around:${radiusMeters},${lat},${lng});
      way["office"~"company|government|financial"](around:${radiusMeters},${lat},${lng});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const res = await axios.post('https://overpass-api.de/api/interpreter', query, {
      headers: {
        'Content-Type': 'text/plain',
        'User-Agent': 'InsightForge-SaaS-ReportGenerator/1.0',
      },
      timeout: 10000,
    });

    const elements = res.data.elements || [];
    const formatted = elements
      .filter((el: any) => el.lat && el.lon)
      .map((el: any) => ({
        id: el.id,
        name: el.tags?.name || `${el.tags?.amenity || el.tags?.shop || 'Business'}`,
        category: el.tags?.shop === 'supermarket' || el.tags?.shop === 'mall' ? 'Grocery' : 
                  el.tags?.amenity === 'pharmacy' || el.tags?.amenity === 'hospital' ? 'Healthcare' :
                  el.tags?.amenity === 'restaurant' || el.tags?.amenity === 'cafe' ? 'Restaurants' :
                  el.tags?.shop === 'clothes' || el.tags?.shop === 'department_store' ? 'Fashion' :
                  el.tags?.shop === 'electronics' ? 'Electronics' : 'Other',
        osmType: el.tags?.amenity || el.tags?.shop || el.tags?.office || 'retail',
        rating: Number((3.5 + Math.random() * 1.5).toFixed(1)), // Simulated Rating since OSM doesn't have it
        latitude: el.lat,
        longitude: el.lon,
      }));

    overpassCache.set(cacheKey, formatted);
    return formatted;
  } catch (err) {
    console.error('Overpass API call failed, returning empty list:', err);
    return [];
  }
}

// 2. OSRM Routing integration - Travel times to city transit hub
export async function fetchAccessibilityInfo(lat: number, lng: number, city: string): Promise<{ distanceKm: number; durationMin: number; hubName: string; connectivityScore: number }> {
  const hub = CITY_HUBS[city] || CITY_HUBS['Hyderabad']; // fallback
  const cacheKey = `${getCacheKey(lat, lng)}_${hub.lat}_${hub.lng}`;

  if (osrmCache.has(cacheKey)) {
    return osrmCache.get(cacheKey);
  }

  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${lng},${lat};${hub.lng},${hub.lat}?overview=false`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'InsightForge-SaaS-ReportGenerator/1.0',
      },
      timeout: 5000,
    });

    if (res.data.routes && res.data.routes.length > 0) {
      const route = res.data.routes[0];
      const distanceKm = Number((route.distance / 1000).toFixed(2));
      const durationMin = Number((route.duration / 60).toFixed(1));
      
      // Accessibility connectivity score: higher score for shorter travel times
      let connectivityScore = Math.max(10, Math.min(100, Math.floor(100 - durationMin * 1.2)));

      const result = { distanceKm, durationMin, hubName: hub.name, connectivityScore };
      osrmCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.warn('OSRM routing failed, calculating geometric fallback:', err);
  }

  // Geometric Fallback: Haversine distance & average speed of 35 km/h
  const R = 6371; // km
  const dLat = ((hub.lat - lat) * Math.PI) / 180;
  const dLon = ((hub.lng - lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat * Math.PI) / 180) *
      Math.cos((hub.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Number((R * c).toFixed(2));
  const durationMin = Number(((distanceKm / 35) * 60).toFixed(1));
  const connectivityScore = Math.max(10, Math.min(100, Math.floor(100 - durationMin * 1.2)));

  const result = { distanceKm, durationMin, hubName: hub.name, connectivityScore };
  osrmCache.set(cacheKey, result);
  return result;
}

// 3. TomTom Traffic API Integration
export async function fetchLiveTraffic(lat: number, lng: number): Promise<{ speedRatio: number; congestionIndex: number; flowCondition: string }> {
  const cacheKey = getCacheKey(lat, lng);
  if (trafficCache.has(cacheKey)) {
    return trafficCache.get(cacheKey);
  }

  if (TOMTOM_API_KEY && TOMTOM_API_KEY !== 'your_tomtom_api_key') {
    try {
      const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${TOMTOM_API_KEY}&point=${lat},${lng}`;
      const res = await axios.get(url, { timeout: 5000 });
      const data = res.data?.flowSegmentData;
      if (data) {
        const currentSpeed = data.currentSpeed;
        const freeFlowSpeed = data.freeFlowSpeed;
        const speedRatio = Number((currentSpeed / freeFlowSpeed).toFixed(2));
        
        // 0.8+ is free flow, 0.5-0.8 is light congestion, <0.5 is heavy traffic
        const congestionIndex = Math.floor((1 - speedRatio) * 100);
        const flowCondition = speedRatio >= 0.85 ? 'Free Flow' : speedRatio >= 0.5 ? 'Moderate Congestion' : 'Heavy Congestion';

        const result = { speedRatio, congestionIndex, flowCondition };
        trafficCache.set(cacheKey, result);
        return result;
      }
    } catch (err) {
      console.warn('TomTom Traffic call failed, executing fallback:', err);
    }
  }

  // Fallback: Congestion modeling based on current hour
  const currentHour = new Date().getHours();
  let baseCongestion = 25; // 25% default
  let flowCondition = 'Free Flow';

  // Rush hours: 8am-10am, 5pm-8pm
  if ((currentHour >= 8 && currentHour <= 10) || (currentHour >= 17 && currentHour <= 20)) {
    baseCongestion = 60 + Math.floor(Math.random() * 25);
    flowCondition = 'Heavy Congestion';
  } else if (currentHour >= 11 && currentHour <= 16) {
    baseCongestion = 40 + Math.floor(Math.random() * 15);
    flowCondition = 'Moderate Congestion';
  }

  const speedRatio = Number(((100 - baseCongestion) / 100).toFixed(2));
  const result = { speedRatio, congestionIndex: baseCongestion, flowCondition };
  trafficCache.set(cacheKey, result);
  return result;
}

// 4. OpenWeather API Integration
export async function fetchCurrentWeather(lat: number, lng: number): Promise<{ temp: number; condition: string; impactFactor: number }> {
  const cacheKey = getCacheKey(lat, lng);
  if (weatherCache.has(cacheKey)) {
    return weatherCache.get(cacheKey);
  }

  if (OPENWEATHER_API_KEY && OPENWEATHER_API_KEY !== 'your-openai-api-key') {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=metric`;
      const res = await axios.get(url, { timeout: 5000 });
      const temp = Math.round(res.data?.main?.temp);
      const condition = res.data?.weather[0]?.main || 'Clear';
      
      // Calculate outdoor weather impact: rain or snow lowers mobility impact
      let impactFactor = 1.0;
      if (condition === 'Rain' || condition === 'Drizzle') impactFactor = 0.8;
      if (condition === 'Snow' || condition === 'Thunderstorm') impactFactor = 0.65;

      const result = { temp, condition, impactFactor };
      weatherCache.set(cacheKey, result);
      return result;
    } catch (err) {
      console.warn('OpenWeather call failed, executing fallback:', err);
    }
  }

  // Fallback: seasonal local temperature simulation (June weather: hot / monsoon in India)
  const temp = 28 + Math.floor(Math.random() * 8); // 28 to 36 degrees
  const conditions = ['Clear', 'Clouds', 'Rain', 'Haze'];
  const condition = conditions[Math.floor(Math.random() * conditions.length)];
  const impactFactor = condition === 'Rain' ? 0.8 : 1.0;

  const result = { temp, condition, impactFactor };
  weatherCache.set(cacheKey, result);
  return result;
}
