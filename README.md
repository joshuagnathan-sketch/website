# joshuagnathan.com + jgnphotography.com

Two websites from one repository, hosted on Cloudflare Pages.

- **joshuagnathan.com**: personal site (home, trips, projects, about)
- **jgnphotography.com**: photography portfolio (`photography.html`)

## Editing content

Go to **joshuagnathan.com/admin** and sign in with GitHub. Everything you change
there is saved into `/content`, and both sites update about a minute later.

- **Photos**: add a photo batch, select many photos at once, add one caption per
  line, and give the batch a category (each category becomes a filter button).
- **Fix a sideways photo**: pick the photo and which way to turn it.
- **Trips**, **Projects**, **About and site info**: text, photos, cover photos.

## What happens automatically

- Photos are shrunk in the browser before upload (`admin/config.yml`).
- A GitHub Action (`.github/workflows/watermark.yml`) turns, resizes and stamps
  "© JGN Photography" on every photo in `/images`. Clean copies are kept in
  `/originals`, which the website never serves.
- `functions/_middleware.js` decides which site a visitor sees based on the
  domain, and sends the old /photos page to jgnphotography.com.

## Code

- `assets/style.css`: all styles for both sites
- `assets/site.js`: builds every page from the files in `/content`
