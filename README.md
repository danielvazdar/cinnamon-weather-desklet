# Weather strip desklet for Cinnamon

A wide desktop widget for Linux Mint (Cinnamon): the weather now, the next 12 hours and the next
5 days in one strip. Rain chance shows when it's 10% or more. Weather icons come from your icon
theme, tinted by condition.

- Weather from [Open-Meteo](https://open-meteo.com/): free, no account or key.
- Location: type a city in the settings, or leave it empty and the widget finds it from your internet
  connection via [ipinfo.io](https://ipinfo.io/) (city level).
- Refreshes every 15 minutes. If an update fails, the last forecast stays up with a note saying what
  went wrong.

Tested on Cinnamon 6.6.

## Install

```sh
git clone https://github.com/danielvazdar/cinnamon-weather-desklet.git
cd cinnamon-weather-desklet
./install.sh
```

Then right-click the desktop → **Add Desklets** → **Weather Strip**.

## Privacy

With the city field empty, ipinfo.io sees your IP address once every 6 hours. Type a city instead
and only Open-Meteo is used: it gets the city name once, then coordinates rounded to two decimals
(about 1 km).

## Development

```sh
node --test tests/*.test.js
gdbus call --session --dest org.Cinnamon --object-path /org/Cinnamon \
  --method org.Cinnamon.ReloadXlet 'weather-strip@osobno' 'DESKLET'
```

`forecast.js` (weather codes, hours and days, location parsing) is plain JavaScript, tested with Node.

## License

MIT
