import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface DayForecast {
  date: string;
  temp: number;
  apparentTemp: number;
  condition: "sunny" | "snow" | "rain" | "cloudy";
  description: string;
  uvIndex: number;
  cloudCover: number;
  windSpeed: number;
  snowfall?: number; // Snowfall in cm
}

export interface WeatherData {
  resortName: string;
  current: DayForecast;
  forecast: DayForecast[];
}

export async function resolveResort(query: string): Promise<{ name: string; lat: number; lon: number; location?: string }[]> {
  if (!query || query.length < 2) return [];
  
  let normalizedQuery = query.trim();
  const searchTerms = normalizedQuery.toLowerCase();
  
  // Specific check for "Mt" prefix
  if (searchTerms.startsWith('mt ')) {
    normalizedQuery = 'Mount ' + normalizedQuery.slice(3);
  }
  
  const isMountainQuery = searchTerms.includes('ski') || 
                         searchTerms.includes('resort') || 
                         searchTerms.includes('pass') || 
                         searchTerms.includes('mt') || 
                         searchTerms.includes('mountain') || 
                         searchTerms.includes('valley') ||
                         searchTerms.includes('peak') ||
                         searchTerms.includes('summit') ||
                         searchTerms.includes('winter');

  try {
    const seen = new Set();
    const finalResults: { name: string; lat: number; lon: number; location?: string }[] = [];
    const genericResults: { name: string; lat: number; lon: number; location?: string }[] = [];

    const addResult = (res: any, source: 'geo' | 'ai') => {
      const lat = typeof res.lat === 'number' ? res.lat : parseFloat(res.latitude || res.lat);
      const lon = typeof res.lon === 'number' ? res.lon : parseFloat(res.longitude || res.lon);
      
      if (isNaN(lat) || isNaN(lon)) return;

      const name = res.name || 'Unknown Resort';
      const isLikelyResort = name.toLowerCase().includes('ski') || 
                            name.toLowerCase().includes('resort') || 
                            name.toLowerCase().includes('mountain') || 
                            name.toLowerCase().includes('pass') ||
                            name.toLowerCase().includes('peak') ||
                            source === 'ai';

      // Deduplicate by grid
      const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
      if (!seen.has(key)) {
        seen.add(key);
        const item = {
          lat,
          lon,
          name: name,
          location: source === 'ai' ? `✨ ${res.location}` : `${res.admin1 ? `${res.admin1}` : ''}${res.country ? ` · ${res.country}` : ''}`
        };
        
        // Prioritize AI results and names that explicitly include resort keywords
        if (source === 'ai' || isLikelyResort) {
          if (source === 'ai') finalResults.unshift(item);
          else finalResults.push(item);
        } else {
          genericResults.push(item);
        }
      }
    };

    // Strategy 1: Standard Geocoding
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalizedQuery)}&count=10&language=en&format=json`;
    const geoResponse = await fetch(geoUrl);
    const geoData = await geoResponse.json();
    if (geoData.results) {
      geoData.results.forEach((r: any) => addResult(r, 'geo'));
    }
    
    // Strategy 2: Targeted Geocoding for Mountains
    if (finalResults.length < 5 && isMountainQuery) {
      const skiUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalizedQuery + " ski resort")}&count=5&language=en&format=json`;
      const skiResponse = await fetch(skiUrl);
      const skiData = await skiResponse.json();
      if (skiData.results) {
        skiData.results.forEach((r: any) => addResult(r, 'geo'));
      }
    }

    // Strategy 3: AI-Powered Search - structured for reliability
    try {
      const modelName = "gemini-3-flash-preview";
      const prompt = `Search for the official ski resort or mountain: "${query}". 
      Return ONLY the top 3 most relevant results. 
      Ensure the 'name' is the full official resort name (e.g., "Stevens Pass Ski Resort"). 
      Exclude generic regions or cities unless they are directly the name of the resort. 
      Provide accurate latitude and longitude for the base area.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                location: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lon: { type: Type.NUMBER }
              },
              required: ["name", "location", "lat", "lon"]
            }
          }
        }
      });

      if (response.text) {
        const aiResults = JSON.parse(response.text);
        if (Array.isArray(aiResults)) {
          aiResults.forEach((r: any) => addResult(r, 'ai'));
        }
      }
    } catch (e) {
      console.error("AI Search failed:", e);
    }
    
    const combined = [...finalResults, ...genericResults];
    return combined.slice(0, 10);
  } catch (error) {
    console.error("Geocoding failed:", error);
    return [];
  }
}

export async function fetchWeatherData(lat: number, lon: number, resortName: string): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,apparent_temperature_max,weathercode,uv_index_max,cloudcover_max,snowfall_sum&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  const weatherCodes: Record<number, { condition: "sunny" | "snow" | "rain" | "cloudy"; description: string }> = {
    0: { condition: 'sunny', description: 'Clear sky' },
    1: { condition: 'sunny', description: 'Mainly clear' },
    2: { condition: 'cloudy', description: 'Partly cloudy' },
    3: { condition: 'cloudy', description: 'Overcast' },
    45: { condition: 'cloudy', description: 'Fog' },
    48: { condition: 'cloudy', description: 'Depositing rime fog' },
    51: { condition: 'rain', description: 'Light drizzle' },
    53: { condition: 'rain', description: 'Moderate drizzle' },
    55: { condition: 'rain', description: 'Dense drizzle' },
    61: { condition: 'rain', description: 'Slight rain' },
    63: { condition: 'rain', description: 'Moderate rain' },
    65: { condition: 'rain', description: 'Heavy rain' },
    71: { condition: 'snow', description: 'Slight snow fall' },
    73: { condition: 'snow', description: 'Moderate snow fall' },
    74: { condition: 'snow', description: 'Heavy snow fall' }, // Some variants use 74/75 same way
    75: { condition: 'snow', description: 'Heavy snow fall' },
    77: { condition: 'snow', description: 'Snow grains' },
    80: { condition: 'rain', description: 'Slight rain showers' },
    81: { condition: 'rain', description: 'Moderate rain showers' },
    82: { condition: 'rain', description: 'Violent rain showers' },
    85: { condition: 'snow', description: 'Slight snow showers' },
    86: { condition: 'snow', description: 'Heavy snow showers' },
    95: { condition: 'rain', description: 'Thunderstorm' },
  };

  const getDayInfo = (code: number) => {
    return weatherCodes[code] || { condition: 'cloudy', description: 'Mixed conditions' };
  };

  const forecast: DayForecast[] = data.daily.time.map((date: string, i: number) => ({
    date,
    temp: data.daily.temperature_2m_max[i],
    apparentTemp: data.daily.apparent_temperature_max[i],
    ...getDayInfo(data.daily.weathercode[i]),
    uvIndex: data.daily.uv_index_max[i],
    cloudCover: data.daily.cloudcover_max[i],
    windSpeed: data.current.wind_speed_10m,
    snowfall: data.daily.snowfall_sum[i],
  }));

  // Create a precise 'current' object from current parameters
  const currentCode = data.current.weather_code;
  const currentInfo = getDayInfo(currentCode);
  
  const current: DayForecast = {
    date: 'Now',
    temp: data.current.temperature_2m,
    apparentTemp: data.current.apparent_temperature,
    ...currentInfo,
    uvIndex: data.daily.uv_index_max[0],
    cloudCover: data.daily.cloudcover_max[0],
    windSpeed: data.current.wind_speed_10m,
    snowfall: data.daily.snowfall_sum[0],
  };

  return {
    resortName,
    current,
    forecast: [current, ...forecast.slice(1, 5)],
  };
}

export async function fetchAIVerdict(weather: DayForecast, resort: string): Promise<string> {
  try {
    const snowInfo = weather.snowfall && weather.snowfall > 0 
      ? `Estimated ${weather.snowfall}cm fresh accumulation.` 
      : "No significant new accumulation.";

    const prompt = `Alpine expert report for ${resort}: Temperature ${weather.temp}°C, feels like ${weather.apparentTemp}°C, Condition: ${weather.description}. ${snowInfo}
    Provide 3 punchy gear/condition bullet points with emojis. Be professional and high-octane.`;
    
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });
    return result.text || "Protocol scan complete. Recommendation: High-performance layering mandatory.";
  } catch (error) {
    return "Protocol scan complete. Recommendation: Technical layering system mandatory for high-alpine deployment.";
  }
}
