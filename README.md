# Liar Game

Pass-and-play liar game MVP built with Next.js App Router.

## Development

```bash
npm install
npm run dev
```

## GitHub Pages Deployment

This project is configured for static export and GitHub Pages publishing.

```bash
npm run deploy
```

What this does:
- runs `next build` with static export (`out/`)
- publishes `out/` to the `gh-pages` branch via `gh-pages`
- includes `.nojekyll` to ensure `_next` assets are served on GitHub Pages

Default repository name fallback for production base path is `liar-game`.
In GitHub Actions, `GITHUB_REPOSITORY` is used automatically to resolve the repo name.
