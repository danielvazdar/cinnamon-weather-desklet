const test = require('node:test');
const assert = require('node:assert/strict');
const forecast = require('../weather-strip@osobno/forecast.js');

function hourlyFor(day, count) {
    const time = Array.from({length: count}, (_, hour) => `${day}T${String(hour).padStart(2, '0')}:00`);
    return {
        time,
        temperature_2m: time.map((_, hour) => hour / 2),
        weather_code: time.map(() => 61),
        precipitation_probability: time.map((_, hour) => (hour === 22 ? null : hour * 4)),
        is_day: time.map((_, hour) => (hour >= 7 && hour < 17 ? 1 : 0)),
    };
}

function joinHourly(...parts) {
    return Object.fromEntries(Object.keys(parts[0]).map(key => [key, parts.flatMap(part => part[key])]));
}

const RESPONSE = {
    current: {time: '2026-11-26T21:30', temperature_2m: 1.7, apparent_temperature: -0.4, weather_code: 1,
        is_day: 0, wind_speed_10m: 2.5},
    hourly: joinHourly(hourlyFor('2026-11-26', 24), hourlyFor('2026-11-27', 24)),
    daily: {
        time: ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02'],
        weather_code: [63, 61, 0, 3, 71, 95, 45],
        temperature_2m_max: [4.3, 3.8, 3.2, 5, 6, 7, 8],
        temperature_2m_min: [0.7, 0.7, 0.8, -1.2, -2, 0, 1],
        precipitation_probability_max: [100, 85, 5, 18, 60, 90, 0],
    },
};

test('now uses the current conditions and today\'s high and low', () => {
    const {now, updatedAt} = forecast.forecastFrom(RESPONSE);
    assert.deepEqual(now, {temperature: 2, feelsLike: 0, wind: 3, high: 4, low: 1,
        label: 'Mostly clear', iconName: 'weather-few-clouds-night-symbolic', tint: 'moon'});
    assert.equal(updatedAt, '21:30');
});

test('12 hours start at the current hour and run past midnight', () => {
    const {hours} = forecast.forecastFrom(RESPONSE);
    assert.equal(hours.length, 12);
    assert.deepEqual(hours.slice(0, 3).map(h => [h.hour, h.isNow]), [[21, true], [22, false], [23, false]]);
    assert.equal(hours[3].hour, 0);
    assert.deepEqual(hours.slice(0, 2).map(h => h.rain), ['84%', ''], 'a missing chance shows nothing');
});

test('5 days start tomorrow', () => {
    const {days} = forecast.forecastFrom(RESPONSE);
    assert.deepEqual(days.map(d => d.date), ['2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01']);
    assert.deepEqual(days[2], {date: '2026-11-29', high: 5, low: -1, rain: '18%', label: 'Overcast',
        iconName: 'weather-overcast-symbolic', tint: 'cloud'});
    assert.equal(days[1].rain, '', 'under 10% is not worth showing');
});

test('a forecast that does not cover now is an error, not a blank widget', () => {
    assert.throws(() => forecast.forecastFrom({...RESPONSE, current: {...RESPONSE.current, time: '2026-12-25T10:00'}}),
        /does not cover/);
});

test('weather codes map to words, icons and night variants', () => {
    assert.deepEqual(forecast.condition(0, true), {label: 'Clear', iconName: 'weather-clear-symbolic', tint: 'sun'});
    assert.equal(forecast.condition(0, false).iconName, 'weather-clear-night-symbolic');
    assert.equal(forecast.condition(65, false).iconName, 'weather-showers-symbolic', 'rain has no night icon');
    assert.equal(forecast.condition(99).label, 'Thunderstorm with hail');
    assert.equal(forecast.condition(42).label, 'Unknown');
});

test('location comes from the IP lookup, rounded to about 1 km', () => {
    assert.deepEqual(forecast.locationFromIpLookup({city: 'Zagreb', loc: '45.8144,15.9780'}),
        {name: 'Zagreb', latitude: 45.81, longitude: 15.98});
    assert.throws(() => forecast.locationFromIpLookup({city: 'Nowhere'}), /no coordinates/);
});

test('a typed-in city is looked up by name', () => {
    assert.equal(forecast.placeSearchUrl(' Slavonski Brod '),
        'https://geocoding-api.open-meteo.com/v1/search?name=Slavonski%20Brod&count=1&language=en&format=json');
    const answer = {results: [{name: 'Split', latitude: 43.50891, longitude: 16.43915, country: 'Croatia'}]};
    assert.deepEqual(forecast.locationFromPlaceSearch(answer, 'split'), {name: 'Split', latitude: 43.51, longitude: 16.44});
    assert.throws(() => forecast.locationFromPlaceSearch({generationtime_ms: 0.1}, 'Xqzzy '), /No place called "Xqzzy"/);
});

test('the request asks only for what is drawn, with rounded coordinates', () => {
    const url = forecast.weatherUrl({latitude: 45.81444, longitude: 15.97798});
    assert.match(url, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=45\.81&longitude=15\.98&/);
    assert.match(url, /timezone=auto/);
});
