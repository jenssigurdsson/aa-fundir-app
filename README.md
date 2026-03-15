# AA fundir app

Monorepo fyrir þrjú verkefni:

- `apps/api`: JSON vefþjónusta sem sækir og normaliserar fundi af `https://aa.is/aa-fundir/allir-fundir`.
- `apps/mobile`: Expo React Native app fyrir native áminningar.
- `apps/web`: React web app með korti, síum, uppáhaldsfundum og dagatalstengingu.

## Af hverju þessi aðferð

- `aa.is` er með HTML töflu, ekki opinbert API, svo við eigum okkar eigið JSON lag ofan á síðuna.
- Gögnin eru uppfærð vikulega með GitHub Actions og einnig hægt að keyra handvirkt.
- React Native með Expo einfaldar push/local áminningar miðað við hreint vefapp.

## Vörustefna

- Web útgáfan er auðveldust í deployment og deilingu.
- Native Expo útgáfan er betri fyrir raunverulegar local notifications.
- API-ið auðgar fundi með borg, landi, svæði, taggum og hnitum þar sem þau eru þekkt.

## Keyrsla

### 1. Setja upp pakka

```bash
npm install
```

### 2. Sækja fundagögn

```bash
npm run refresh:data
```

Þetta býr til eða uppfærir `apps/api/data/meetings.json`.

### 3. Keyra JSON API

```bash
npm run dev:api
```

API endapunktar:

- `GET /api/health`
- `GET /api/meetings`
- `POST /api/refresh`

Ef `REFRESH_TOKEN` er skilgreint þarf að senda `Authorization: Bearer <token>` á refresh-endapunktinn.

### 4. Keyra Expo app

```bash
cd apps/mobile
cp .env.example .env
EXPO_PUBLIC_API_URL=http://localhost:4000/api npm start
```

### 5. Keyra React web app

```bash
cd apps/web
cp .env.example .env
npm run dev
```

## Deployment

Nákvæm deployment skref eru í `DEPLOYMENT.md`.

### Render

Skráin `render.yaml` skilgreinir:

- `aa-fundir-api`: Docker-based API service
- `aa-fundir-web`: static React web site

Settu að minnsta kosti þessi env:

- `REFRESH_TOKEN` á API þjónustuna
- `VITE_API_URL` á web þjónustuna, t.d. `https://aa-fundir-api.onrender.com/api`

### Expo EAS

Root skráin `eas.json` skilgreinir `preview` og `production` build profile.

Mobile env:

- `EXPO_PUBLIC_API_URL` þarf að benda á lifandi API, t.d. `https://aa-fundir-api.onrender.com/api`

### Vikuleg uppfærsla

Skráin `.github/workflows/refresh-meetings.yml` keyrir scraperinn á hverjum mánudegi kl. 06:00 UTC og commit-ar breyttu JSON skrána aftur inn í repo.

## Hvað er nýtt

- Réttur scraper fyrir raunverulega töfluuppbyggingu AA-síðunnar
- Borg/svæði/hnit fyrir kort og staðsetningarsíur
- React web framendi með Leaflet korti, leitarboxi og dagatalsskrá (`.ics`)
- Render deployment stillingar fyrir API og web
