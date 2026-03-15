# Deployment guide

Þessi uppsetning mælir með:

- Render fyrir `apps/api`
- Vercel eða Render Static fyrir `apps/web`
- Expo EAS fyrir `apps/mobile`

## 1. API á Render

### Búa til þjónustu

1. Tengdu Git repo við Render.
2. Veldu `Blueprint` deployment og notaðu `render.yaml`.
3. Settu `REFRESH_TOKEN` sem secret environment variable.

### Nauðsynleg env

- `PORT=4000`
- `REFRESH_TOKEN=<sterkt-leyndarmál>`

### Eftir deploy

- Health check: `https://<api-domain>/api/health`
- Fundagögn: `https://<api-domain>/api/meetings`

## 2. Web á Vercel

### Búa til verkefni

1. Tengdu repo við Vercel.
2. Veldu `apps/web` sem Root Directory.
3. Settu environment variable:
   - `VITE_API_URL=https://<api-domain>/api`

### Build stillingar

- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

## 3. Web á Render Static

Ef þú vilt hafa allt á Render í stað Vercel er það líka tilbúið í `render.yaml`.

Stilltu:

- `VITE_API_URL=https://<api-domain>/api`

## 4. Expo app release

### Fyrsta setup

```bash
npm install
npx expo login
npx eas login
```

### Tengja API við appið

Í keyrslu og build:

```bash
EXPO_PUBLIC_API_URL=https://<api-domain>/api
```

### Android preview build

```bash
npx eas build --platform android --profile preview
```

### Production builds

```bash
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

## 5. Vikuleg gagnauppfærsla

GitHub Actions workflow keyrir vikulega og uppfærir `apps/api/data/meetings.json`.

Ef þú vilt keyra handvirkt:

```bash
npm run refresh:data
```

## 6. Röð sem ég mæli með

1. Deploy API
2. Setja `VITE_API_URL` og deploy web
3. Setja `EXPO_PUBLIC_API_URL` og build Expo app
4. Staðfesta `api/health`, web leit og notification flow í appi

