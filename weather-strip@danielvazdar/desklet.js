// Weather strip desklet: now, the next 12 hours and the next 5 days from Open-Meteo (free, no key).
// The location is the city typed in the settings, or, when that is empty, an IP lookup (city level).
// Data shaping lives in forecast.js, drawing in views.js.

imports.gi.versions.Soup = '3.0';
const Main = imports.ui.main;
const Desklet = imports.ui.desklet;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;
const Forecast = require('./forecast');
const Views = require('./views');

const UUID = 'weather-strip@danielvazdar';
const IP_LOOKUP_URL = 'https://ipinfo.io/json';
const LOCATION_MAX_AGE_SECONDS = 6 * 3600;
const REQUEST_TIMEOUT_SECONDS = 10;
const OUTER_PADDING = 18;
const ROOT_BORDER = 1;
const GAP = 16;
const COLUMN_GAP = 2;
const NOW_SHARE = 0.21;
const DAY_TO_HOUR_WIDTH = 1.3;

function dateTimeOf(day) {
    const [year, month, date] = day.split('-').map(Number);
    return GLib.DateTime.new_local(year, month, date, 0, 0, 0);
}

// Cinnamon opens a desklet's menu beside the desklet; when the desklet fills the screen width the menu
// ends up off-screen. Open it where the user right-clicked instead, kept inside that monitor.
function openMenuAtPointer(menu) {
    menu._calculatePosition = function () {
        if (!this.actor.visible)
            this.box.show();
        const [pointerX, pointerY] = global.get_pointer();
        const [, , naturalWidth, naturalHeight] = this.actor.get_preferred_size();
        const monitor = Main.layoutManager.findMonitorForActor(this.sourceActor);
        const x = Math.min(Math.max(pointerX, monitor.x), monitor.x + monitor.width - naturalWidth);
        const y = Math.min(Math.max(pointerY, monitor.y), monitor.y + monitor.height - naturalHeight);
        return [Math.round(x), Math.round(y)];
    };
}

class WeatherStripDesklet extends Desklet.Desklet {
    constructor(metadata, deskletId) {
        super(metadata, deskletId);
        openMenuAtPointer(this._menu);
        this._session = new Soup.Session({timeout: REQUEST_TIMEOUT_SECONDS});
        this._cancellable = new Gio.Cancellable();
        this._timerId = 0;
        this._forecast = null;
        this._location = null;
        this._detected = null;
        this._typedPlace = null;
        this._problem = null;
        this._refreshing = false;

        this.settings = new Settings.DeskletSettings(this, UUID, deskletId);
        for (const [key, property] of [['width', 'widthPx'], ['height', 'heightPx'], ['font-size', 'fontSizePx'],
            ['glass-opacity', 'glassOpacity']])
            this.settings.bind(key, property, () => this._render());
        this.settings.bind('city', 'cityText', () => this._refresh());
        this.settings.bind('refresh-minutes', 'refreshMinutes', () => this._startTimer());

        this._root = new St.BoxLayout({style_class: 'weather-root'});
        this.setContent(this._root);
        this._render();
        this._refresh();
        this._startTimer();
    }

    _startTimer() {
        if (this._timerId)
            GLib.source_remove(this._timerId);
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, Math.max(5, this.refreshMinutes) * 60, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _getJson(url) {
        return new Promise((resolve, reject) => {
            const message = Soup.Message.new('GET', url);
            this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, this._cancellable, (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    if (message.get_status() !== Soup.Status.OK)
                        throw new Error(`HTTP ${message.get_status()} from ${GLib.Uri.parse(url, GLib.UriFlags.NONE).get_host()}`);
                    resolve(JSON.parse(new TextDecoder().decode(bytes.get_data())));
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    async _resolveLocation() {
        const city = (this.cityText || '').trim();
        if (city) {
            if (!this._typedPlace || this._typedPlace.city !== city) {
                const answer = await this._getJson(Forecast.placeSearchUrl(city));
                this._typedPlace = {city, location: Forecast.locationFromPlaceSearch(answer, city)};
            }
            return this._typedPlace.location;
        }
        const now = GLib.get_monotonic_time() / 1e6;
        if (this._detected && now - this._detected.at < LOCATION_MAX_AGE_SECONDS)
            return this._detected.location;
        const location = Forecast.locationFromIpLookup(await this._getJson(IP_LOOKUP_URL));
        this._detected = {location, at: now};
        return location;
    }

    // One refresh at a time; a failure keeps the last forecast on screen and says what went wrong.
    async _refresh() {
        if (this._refreshing)
            return;
        this._refreshing = true;
        try {
            const location = await this._resolveLocation();
            const forecast = Forecast.forecastFrom(await this._getJson(Forecast.weatherUrl(location)));
            this._location = location;
            this._forecast = forecast;
            this._problem = null;
        } catch (error) {
            this._problem = error.message;
            global.logWarning(`${UUID}: weather update failed: ${error.message}`);
        } finally {
            this._refreshing = false;
        }
        if (!this._removed)
            this._render();
    }

    _sizes() {
        const contentWidth = this.widthPx - 2 * (OUTER_PADDING + ROOT_BORDER);
        const nowWidth = Math.round(contentWidth * NOW_SHARE);
        const columnsWidth = contentWidth - nowWidth - 4 * GAP - 2
            - COLUMN_GAP * (Forecast.HOURS_SHOWN - 1) - COLUMN_GAP * (Forecast.DAYS_SHOWN - 1);
        const hourWidth = Math.floor(columnsWidth / (Forecast.HOURS_SHOWN + DAY_TO_HOUR_WIDTH * Forecast.DAYS_SHOWN));
        return {
            contentWidth, contentHeight: this.heightPx - 2 * (OUTER_PADDING + ROOT_BORDER), nowWidth, hourWidth,
            dayWidth: Math.floor((columnsWidth - hourWidth * Forecast.HOURS_SHOWN) / Forecast.DAYS_SHOWN),
            gap: GAP, columnGap: COLUMN_GAP,
            iconDirectory: `${this.metadata.path}/weather-icons`,
            nowIconSize: Math.round(this.fontSizePx * 3.8), columnIconSize: Math.min(hourWidth, Math.round(this.fontSizePx * 2.2)),
        };
    }

    _render() {
        const sizes = this._sizes();
        const alpha = this.glassOpacity;
        this._root.set_style(`width: ${sizes.contentWidth}px; height: ${sizes.contentHeight}px;`
            + ` font-size: ${this.fontSizePx}px; padding: ${OUTER_PADDING}px;`
            + ` background-gradient-start: rgba(34, 38, 52, ${alpha});`
            + ` background-gradient-end: rgba(12, 14, 20, ${Math.min(alpha + 0.12, 1)});`);
        this._root.destroy_all_children();
        this._root.add(Views.buildStrip({
            forecast: this._forecast, location: this._location, problem: this._problem, sizes,
            formatWeekday: day => dateTimeOf(day).format('%a'),
        }), {expand: true, y_fill: false, y_align: St.Align.MIDDLE});
    }

    on_desklet_removed() {
        this._removed = true;
        this._cancellable.cancel();
        if (this._timerId)
            GLib.source_remove(this._timerId);
        this._timerId = 0;
        this.settings.finalize();
    }
}

function main(metadata, deskletId) {
    return new WeatherStripDesklet(metadata, deskletId);
}
