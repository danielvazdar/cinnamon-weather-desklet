# weather-desklet

Cinnamon desklet: weather strip (now, 12 hours, 5 days) from Open-Meteo; location by ipinfo.io or
settings. Public repo `danielvazdar/cinnamon-weather-desklet`. Nothing personal in git.

## Map
| Path | What |
|---|---|
| `weather-strip@osobno/desklet.js` | settings, location (typed city via Open-Meteo place search, else IP lookup cached 6 h), fetch via Soup 3, render |
| `weather-strip@osobno/forecast.js` | pure: WMO codes → label/icon/tint, Open-Meteo → now/hours/days, location parsing; Node-tested |
| `weather-strip@osobno/views.js` | St widgets for the strip |
| `install.sh` | symlinks the desklet into `~/.local/share/cinnamon/desklets/` |

## Commands
- Tests: `node --test tests/*.test.js && shellcheck install.sh`
- Reload: `gdbus call --session --dest org.Cinnamon --object-path /org/Cinnamon --method org.Cinnamon.ReloadXlet 'weather-strip@osobno' 'DESKLET'`
- After editing `stylesheet.css`: Eval `imports.ui.main.themeManager._changeTheme()` then reload (St caches sheets).

## Hard constraints
- Same St quirks as the sibling desklets (`gcal-desklet`, `hw-dashboard`): content-box sizes, no CSS opacity,
  `box.add(actor, props)` for alignment, never `style: ''`, markup `foreground` is overridden by CSS colour.
- Icons are the freedesktop `weather-*-symbolic` names (Adwaita), tinted with a style colour.
- Free services only; no API keys.
- Decisions → `DECISIONS.md`.
