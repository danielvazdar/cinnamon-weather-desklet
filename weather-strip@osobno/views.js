// Draws the weather strip: now on the left, then the next hours, then the next days.
// Drawing only; fetching and state live in desklet.js. Cinnamon's St.BoxLayout ignores Clutter
// alignment, so alignment goes through box.add(actor, {...}).

const St = imports.gi.St;
const Pango = imports.gi.Pango;

// Soft tints: symbolic weather icons are solid shapes, so full-strength colour reads too heavy.
const TINTS = {sun: 'rgba(253, 214, 99, 0.85)', moon: 'rgba(198, 202, 209, 0.75)', cloud: 'rgba(232, 234, 237, 0.70)',
    fog: 'rgba(189, 193, 198, 0.70)', rain: 'rgba(138, 180, 248, 0.80)', ice: 'rgba(168, 218, 220, 0.80)',
    snow: 'rgba(255, 255, 255, 0.80)', storm: 'rgba(197, 138, 249, 0.85)'};
const PROBLEM_COLOR = '#fdd663';
const CENTERED = {y_fill: false, y_align: St.Align.MIDDLE};
const CENTERED_X = {x_fill: false, x_align: St.Align.MIDDLE};

function label(text, styleClass, style = '') {
    const actor = new St.Label({text, style_class: styleClass});
    if (style) // never pass an empty style: St logs a parser error for it
        actor.set_style(style);
    actor.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
    return actor;
}

function weatherIcon(item, size) {
    return new St.Icon({icon_name: item.iconName, icon_size: size, style: `color: ${TINTS[item.tint]};`});
}

function row(spacing, children) {
    const box = new St.BoxLayout({style: `spacing: ${spacing}px;`});
    for (const [child, props] of children)
        box.add(child, props || CENTERED);
    return box;
}

function divider() {
    return new St.Widget({style_class: 'weather-divider'});
}

// "Zagreb · 21:30", or the problem in amber when the last update failed.
function statusLine(location, forecast, problem) {
    if (problem)
        return label(`⚠ ${problem}`, 'weather-status', `color: ${PROBLEM_COLOR};`);
    const place = location ? location.name : 'Finding your location…';
    return label(forecast ? `${place} · ${forecast.updatedAt}` : place, 'weather-status');
}

function nowBlock({forecast, location, problem, sizes}) {
    const block = new St.BoxLayout({vertical: true, style: `width: ${sizes.nowWidth}px; spacing: 2px;`});
    block.add_actor(statusLine(location, forecast, problem));
    if (!forecast)
        return block;
    const {now} = forecast;
    block.add_actor(row(10, [[weatherIcon(now, sizes.nowIconSize)], [label(`${now.temperature}°`, 'weather-now-temperature')]]));
    block.add_actor(label(now.label, 'weather-now-label'));
    block.add_actor(label(`Feels ${now.feelsLike}° · Wind ${now.wind} km/h`, 'weather-detail'));
    block.add_actor(label(`H ${now.high}°  L ${now.low}°`, 'weather-detail'));
    return block;
}

function cell(text, styleClass, width) {
    return label(text, styleClass, `width: ${width}px; text-align: center;`);
}

function hourColumn(hour, sizes) {
    const column = new St.BoxLayout({vertical: true, style_class: `weather-column${hour.isNow ? ' is-now' : ''}`,
        style: `width: ${sizes.hourWidth}px; spacing: 4px;`});
    column.add_actor(cell(hour.isNow ? 'Now' : `${hour.hour}h`, 'weather-column-title', sizes.hourWidth));
    column.add(weatherIcon(hour, sizes.columnIconSize), CENTERED_X);
    column.add_actor(cell(`${hour.temperature}°`, 'weather-column-temperature', sizes.hourWidth));
    column.add_actor(cell(hour.rain || ' ', 'weather-rain', sizes.hourWidth));
    return column;
}

function dayColumn(day, sizes, formatWeekday) {
    const column = new St.BoxLayout({vertical: true, style_class: 'weather-column', style: `width: ${sizes.dayWidth}px; spacing: 4px;`});
    column.add_actor(cell(formatWeekday(day.date).toUpperCase(), 'weather-column-title', sizes.dayWidth));
    column.add(weatherIcon(day, sizes.columnIconSize), CENTERED_X);
    column.add_actor(cell(`${day.high}°`, 'weather-column-temperature', sizes.dayWidth));
    column.add_actor(cell(`${day.low}°`, 'weather-low', sizes.dayWidth));
    column.add_actor(cell(day.rain || ' ', 'weather-rain', sizes.dayWidth));
    return column;
}

// context: {forecast, location, problem, sizes, formatWeekday}
function buildStrip(context) {
    const {forecast, sizes} = context;
    const strip = new St.BoxLayout({style: `spacing: ${sizes.gap}px;`});
    strip.add(nowBlock(context), CENTERED);
    if (!forecast)
        return strip;
    strip.add(divider(), {y_fill: true});
    strip.add(row(sizes.columnGap, forecast.hours.map(hour => [hourColumn(hour, sizes)])), CENTERED);
    strip.add(divider(), {y_fill: true});
    strip.add(row(sizes.columnGap, forecast.days.map(day => [dayColumn(day, sizes, context.formatWeekday)])), CENTERED);
    return strip;
}

module.exports = {buildStrip};
