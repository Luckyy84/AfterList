import * as search from '../server/api/search.js'
import * as details from '../server/api/details.js'
import * as discover from '../server/api/discover.js'
import * as anilist from '../server/api/anilist.js'
import * as catalog from '../server/api/catalog.js'
import * as avatar from '../server/api/account/avatar.js'
import * as accountDelete from '../server/api/account/delete.js'
import * as refresh from '../server/api/cron/refresh-watchlist.js'
import * as profile from '../server/api/public/profile.js'
import * as library from '../server/api/public/library.js'
import * as list from '../server/api/public/list.js'
import * as tokens from '../server/api/v1/tokens.js'
import * as watchlist from '../server/api/v1/watchlist.js'
import * as resolve from '../server/api/v1/resolve.js'
import { json } from '../server/api/_lib/afterlistApi.js'

// Only these routes and methods are public; helpers and other exports stay private.
const routes: Record<string, Record<string, (request: Request) => Promise<Response>>> = {
  search: { GET: search.GET },
  details: { GET: details.GET },
  discover: { GET: discover.GET },
  anilist: { GET: anilist.GET },
  catalog: { GET: catalog.GET },
  'account/avatar': { POST: avatar.POST, DELETE: avatar.DELETE },
  'account/delete': { DELETE: accountDelete.DELETE },
  'cron/refresh-watchlist': { GET: refresh.GET },
  'public/profile': { GET: profile.GET },
  'public/library': { GET: library.GET },
  'public/list': { GET: list.GET },
  'v1/tokens': { GET: tokens.GET, POST: tokens.POST, DELETE: tokens.DELETE },
  'v1/watchlist': { GET: watchlist.GET, PUT: watchlist.PUT },
  'v1/resolve': { GET: resolve.GET },
}

export default {
  async fetch(request: Request) {
    const url = new URL(request.url)
    const routeNames = url.searchParams.getAll('__afterlist_route')
    const name = routeNames[0] ?? ''
    if (routeNames.length !== 1 || !Object.hasOwn(routes, name)) return json({ error: 'Not found.' }, 404)
    const methods = routes[name]
    if (!Object.hasOwn(methods, request.method)) {
      const response = json({ error: 'Method not allowed.' }, 405)
      response.headers.set('allow', Object.keys(methods).join(', '))
      return response
    }
    // Dispatch data is untrusted routing input, never authorization. Handlers still authenticate.
    url.pathname = `/api/${name}`
    url.searchParams.delete('__afterlist_route')
    return methods[request.method](new Request(url, request))
  },
}
