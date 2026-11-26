// Turns an Open-Meteo forecast (and an IP location lookup) into what the weather strip draws.
// Pure JavaScript, no GJS imports, so Node can test it.

const HOURS_SHOWN = 12;
const DAYS_SHOWN = 5;
const RAIN_CHANCE_WORTH_SHOWING = 10;
const COORDINATE_DECIMALS = 2; // about 1 km: enough for weather, no more precise than needed

// WMO weather codes as used by Open-Meteo -> words and a Meteocons icon (weather-icons/<name>.svg).
// `night` is the icon after dark, when the set has one.
const CONDITIONS = [
    {codes: [0], label: 'Clear', day: 'clear-day', night: 'clear-night'},
    {codes: [1], label: 'Mostly clear', day: 'partly-cloudy-day', night: 'partly-cloudy-night'},
    {codes: [2], label: 'Partly cloudy', day: 'partly-cloudy-day', night: 'partly-cloudy-night'},
    {codes: [3], label: 'Overcast', day: 'overcast-day', night: 'overcast-night'},
    {codes: [45, 48], label: 'Fog', day: 'fog-day', night: 'fog-night'},
    {codes: [51, 53, 55], label: 'Drizzle', day: 'drizzle'},
    {codes: [56, 57], label: 'Freezing drizzle', day: 'sleet'},
    {codes: [61], label: 'Light rain', day: 'partly-cloudy-day-rain', night: 'partly-cloudy-night-rain'},
    {codes: [63], label: 'Rain', day: 'rain'},
    {codes: [65], label: 'Heavy rain', day: 'rain'},
    {codes: [66, 67], label: 'Freezing rain', day: 'sleet'},
    {codes: [71], label: 'Light snow', day: 'partly-cloudy-day-snow', night: 'partly-cloudy-night-snow'},
    {codes: [73, 75, 77], label: 'Snow', day: 'snow'},
    {codes: [80], label: 'Showers', day: 'partly-cloudy-day-rain', night: 'partly-cloudy-night-rain'},
    {codes: [81, 82], label: 'Heavy showers', day: 'rain'},
    {codes: [85, 86], label: 'Snow showers', day: 'partly-cloudy-day-snow', night: 'partly-cloudy-night-snow'},
    {codes: [95], label: 'Thunderstorm', day: 'thunderstorms-rain'},
    {codes: [96, 99], label: 'Thunderstorm with hail', day: 'hail'},
];
const UNKNOWN_CONDITION = {label: 'Unknown', day: 'cloudy'};

function condition(code, isDay = true) {
    const found = CONDITIONS.find(entry => entry.codes.includes(code)) || UNKNOWN_CONDITION;
    return {label: found.label, icon: (!isDay && found.night) || found.day};
}

// "" below 10%, so only rain worth knowing about is shown.
function rainLabel(chance) {
    return chance !== null && chance >= RAIN_CHANCE_WORTH_SHOWING ? `${chance}%` : '';
}

function degrees(value) {
    return Math.round(value) || 0; // never "-0"
}

function hoursFrom(hourly, startIndex) {
    return hourly.time.slice(startIndex, startIndex + HOURS_SHOWN).map((time, offset) => {
        const index = startIndex + offset;
        return {
            hour: Number(time.slice(11, 13)), isNow: offset === 0,
            temperature: degrees(hourly.temperature_2m[index]),
            rain: rainLabel(hourly.precipitation_probability[index]),
            ...condition(hourly.weather_code[index], hourly.is_day[index] === 1),
        };
    });
}

function daysFrom(daily, firstIndex) {
    return daily.time.slice(firstIndex, firstIndex + DAYS_SHOWN).map((date, offset) => {
        const index = firstIndex + offset;
        return {
            date, high: degrees(daily.temperature_2m_max[index]), low: degrees(daily.temperature_2m_min[index]),
            rain: rainLabel(daily.precipitation_probability_max[index]),
            ...condition(daily.weather_code[index], true),
        };
    });
}

// response: Open-Meteo /v1/forecast with current, hourly and daily fields (see weatherUrl).
function forecastFrom(response) {
    const {current, hourly, daily} = response;
    const startIndex = hourly.time.indexOf(`${current.time.slice(0, 13)}:00`);
    const todayIndex = daily.time.indexOf(current.time.slice(0, 10));
    if (startIndex < 0 || todayIndex < 0)
        throw new Error('forecast does not cover the current time');
    return {
        updatedAt: current.time.slice(11, 16),
        now: {
            temperature: degrees(current.temperature_2m), feelsLike: degrees(current.apparent_temperature),
            wind: Math.round(current.wind_speed_10m),
            high: degrees(daily.temperature_2m_max[todayIndex]), low: degrees(daily.temperature_2m_min[todayIndex]),
            ...condition(current.weather_code, current.is_day === 1),
        },
        hours: hoursFrom(hourly, startIndex),
        days: daysFrom(daily, todayIndex + 1),
    };
}

function round(value) {
    return Number(Number(value).toFixed(COORDINATE_DECIMALS));
}

function weatherUrl({latitude, longitude}) {
    const query = [
        `latitude=${round(latitude)}`, `longitude=${round(longitude)}`,
        'current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m',
        'hourly=temperature_2m,weather_code,precipitation_probability,is_day',
        'daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        'timezone=auto', `forecast_days=${DAYS_SHOWN + 2}`,
    ].join('&');
    return `https://api.open-meteo.com/v1/forecast?${query}`;
}

// ipinfo.io answer ({city, loc: "45.81,15.97"}) -> {name, latitude, longitude}
function locationFromIpLookup(answer) {
    const [latitude, longitude] = String(answer.loc || '').split(',').map(Number);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
        throw new Error('location lookup gave no coordinates');
    return {name: answer.city || 'Here', latitude: round(latitude), longitude: round(longitude)};
}

// Open-Meteo's free place search for a typed-in city.
function placeSearchUrl(city) {
    return `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=1&language=en&format=json`;
}

// Place search answer -> {name, latitude, longitude}; no match is an error the widget shows.
function locationFromPlaceSearch(answer, city) {
    const place = (answer.results || [])[0];
    if (!place)
        throw new Error(`No place called "${city.trim()}"`);
    return {name: place.name, latitude: round(place.latitude), longitude: round(place.longitude)};
}

module.exports = {condition, rainLabel, forecastFrom, weatherUrl, locationFromIpLookup, placeSearchUrl,
    locationFromPlaceSearch, HOURS_SHOWN, DAYS_SHOWN};
