// Serves two sites from this one project:
//   jgnphotography.com -> the photo portfolio (photography.html)
//   joshuagnathan.com  -> the personal site, whose Photos page now points to the portfolio
// Photos, styles and content files are shared, so one upload in /admin updates both.
const PHOTO_SITE = 'https://jgnphotography.com';
const MAIN_SITE = 'https://joshuagnathan.com';
const SHARED = /^\/(assets|images|content)\//;

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  const path = url.pathname;
  const host = url.hostname;

  // Clean, unwatermarked copies of photos are kept for the watermark robot only.
  if (path.startsWith('/originals/') || path.startsWith('/.github/')) {
    return new Response('Not found', { status: 404 });
  }

  if (host === 'jgnphotography.com' || host === 'www.jgnphotography.com') {
    if (host.startsWith('www.')) return Response.redirect(PHOTO_SITE + path + url.search, 301);
    if (path === '/' || path === '/index.html') {
      return env.ASSETS.fetch(new Request(new URL('/photography', url), request));
    }
    if (SHARED.test(path) || path === '/favicon.ico' || path === '/robots.txt') return next();
    if (path === '/photography' || path === '/photography.html') return Response.redirect(PHOTO_SITE + '/', 302);
    // Every other page (trips, projects, admin...) lives on the personal site.
    return Response.redirect(MAIN_SITE + path + url.search, 302);
  }

  if (host === 'joshuagnathan.com' || host === 'www.joshuagnathan.com') {
    if (/^\/(photos|photography)(\.html)?$/.test(path)) return Response.redirect(PHOTO_SITE + '/', 302);
  }
  return next();
}
