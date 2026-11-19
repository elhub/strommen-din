# Strømmen din

**[elhub.github.io/strommen-din](https://elhub.github.io/strommen-din/)**

Norwegian household electricity explained with real data. Pick your region and see when power is cheapest, how cold weather drives consumption, which regions supply the rest of the country, and whether Norgespris changed people's habits.

Built at Strømstad by group 6.

## Data

- [Elhub Energy Data API](https://api.elhub.no): hourly consumption, production, exchange and Norgespris data (CC BY 4.0)
- [MET Norway / yr](https://api.met.no): weather forecast, plus historical weather via [Open-Meteo](https://open-meteo.com)
- Nord Pool spot prices via [hvakosterstrommen.no](https://www.hvakosterstrommen.no)
- Price-area boundaries from [entsoe-py](https://github.com/EnergieID/entsoe-py)

The data is stored in `src/data/`, so the site makes no API calls at runtime.

## Development

```sh
npm install
npm run dev          # local dev server
npm run fetch-data   # refresh Elhub, weather and spot price data
npm run build        # single-file build in dist/
```

Built with React, Vite, Tailwind, shadcn/ui and Recharts. Pushes to `main` are deployed to GitHub Pages by a GitHub Actions workflow.
