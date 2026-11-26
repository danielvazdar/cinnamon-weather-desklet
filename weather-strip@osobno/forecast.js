// Turns an Open-Meteo forecast (and an IP location lookup) into what the weather strip draws.
// Pure JavaScript, no GJS imports, so Node can test it.

const HOURS_SHOWN = 12;
const DAYS_SHOWN = 5;
const RAIN_CHANCE_WORTH_SHOWING = 10;
const COORDINATE_DECIMALS = 2; // about 1 km: enough for weather, no more precise than needed

// WMO weather codes as used by Open-Meteo: words, the freedesktop icon and a tint for it.
const CONDITIONS = [
    {codes: [0], label: 'Clear', icon: 'clear', tint: 'sun'},
    {codes: [1], label: 'Mostly clear', icon: 'few-clouds', tint: 'sun'},
    {codes: [2], label: 'Partly cloudy', icon: 'few-clouds', tint: 'cloud'},
    {codes: [3], label: 'Overcast', icon: 'overcast', tint: 'cloud'},
    {codes: [45, 48], label: 'Fog', icon: 'fog', tint: 'fog'},
    {codes: [51, 53, 55], label: 'Drizzle', icon: 'showers-scattered', tint: 'rain'},
    {codes: [56, 57], label: 'Freezing drizzle', icon: 'showers-scattered', tint: 'ice'},
    {codes: [61], label: 'Light rain', icon: 'showers-scattered', tint: 'rain'},
    {codes: [63], label: 'Rain', icon: 'showers', tint: 'rain'},
    {codes: [65], label: 'Heavy rain', icon: 'showers', tint: 'rain'},
    {codes: [66, 67], label: 'Freezing rain', icon: 'showers', tint: 'ice'},
    {codes: [71], label: 'Light snow', icon: 'snow', tint: 'snow'},
    {codes: [73], label: 'Snow', icon: 'snow', tint: 'snow'},
    {codes: [75], label: 'Heavy snow', icon: 'snow', tint: 'snow'},
    {codes: [77], label: 'Snow grains', icon: 'snow', tint: 'snow'},
    {codes: [80], label: 'Showers', icon: 'showers-scattered', tint: 'rain'},
    {codes: [81, 82], label: 'Heavy showers', icon: 'showers', tint: 'rain'},
    {codes: [85, 86], label: 'Snow showers', icon: 'snow', tint: 'snow'},
    {codes: [95], label: 'Thunderstorm', icon: 'storm', tint: 'storm'},
    {codes: [96, 99], label: 'Thunderstorm with hail', icon: 'storm', tint: 'storm'},
];
const NIGHT_ICONS = {'clear': 'clear-night', 'few-clouds': 'few-clouds-night'};
const UNKNOWN_CONDITION = {label: 'Unknown', icon: 'severe-alert', tint: 'cloud'};

function condition(code, isDay = true) {
    const found = CONDITIONS.find(entry => entry.codes.includes(code)) || UNKNOWN_CONDITION;
    const nightIcon = isDay ? null : NIGHT_ICONS[found.icon];
    return {label: found.label, iconName: `weather-${nightIcon || found.icon}-symbolic`, tint: nightIcon ? 'moon' : found.tint};
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

// Typed-in location from the settings, or null when it is not usable.
function manualLocation(name, latitudeText, longitudeText) {
    const latitude = Number(String(latitudeText).replace(',', '.'));
    const longitude = Number(String(longitudeText).replace(',', '.'));
    const valid = String(latitudeText).trim() && String(longitudeText).trim()
        && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
    return valid ? {name: name || 'Here', latitude: round(latitude), longitude: round(longitude)} : null;
}

module.exports = {condition, rainLabel, forecastFrom, weatherUrl, locationFromIpLookup, manualLocation, HOURS_SHOWN, DAYS_SHOWN};
