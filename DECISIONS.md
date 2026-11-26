# Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-11-26 | Open-Meteo for weather | Free, no account or key, hourly + daily in one request |
| 2026-11-26 | Location from ipinfo.io (city level, cached 6 h) by default; manual coordinates in settings | Owner picked automatic; manual covers privacy or a wrong guess |
| 2026-11-26 | One "City" field replaces the switch + latitude/longitude: empty = automatic, typed = Open-Meteo place search | Owner couldn't find manual input; hidden fields and raw coordinates were the wrong control |
| 2026-11-26 | Coordinates rounded to 2 decimals before leaving the machine | ~1 km is enough for weather |
| 2026-11-26 | Content: now + 12 hours + 5 days in one 1000 × 170 strip; calendar glass look | Owner's picks; sits between the calendar and the hardware dashboard |
| 2026-11-26 | ~~Symbolic freedesktop weather icons, tinted per condition~~ superseded below | Present in every Cinnamon setup; the Mint-Y theme has no colour weather icons |
| 2026-11-26 | Meteocons "fill" icons (MIT) shipped in the repo, margins trimmed, day/night variants | Owner found the symbolic icons flat; 24 files from @meteocons/svg-static 0.1.0 via jsDelivr (the README's CDN 404s) |
| 2026-11-26 | Rain chance shown only at 10% or more | Fewer numbers to read; low chances are noise |
| 2026-11-26 | Public repo, MIT | Owner asked for public with nothing personal |
| 2026-11-26 | Desklet ID `weather-strip@danielvazdar` (was `@osobno`) | The suffix is the author by Cinnamon convention; "osobno" meant nothing outside the owner's folder names |
| 2026-11-26 | Right-click menu opens at the mouse, clamped to the monitor (overrides the menu's `_calculatePosition`) | Cinnamon only checks for room on the right, then flips left without clamping: a full-width desklet pushed its menu off-screen |
