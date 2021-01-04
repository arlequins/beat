import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { setCacheNameDetails } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'

const VERSION = process.env.VERSION ? process.env.VERSION : '1.0.0'
const MODE = process.env.MODE ? process.env.MODE : 'production'

setCacheNameDetails({
	prefix: `${MODE}-beat`,
	suffix: VERSION,
	precache: 'precache',
	runtime: 'runtime',
})

cleanupOutdatedCaches()

// (self as any).skipWaiting();
;(self as any).__WB_DISABLE_DEV_LOGS = true

const precacheList: any[] = (self as any).__WB_MANIFEST

precacheAndRoute([...precacheList], {
	// Ignore all URL parameters.
	// ignoreURLParametersMatching: [/.*/],
})

registerRoute(
	(routeData: any) => {
		const headers = routeData.event.request.headers
		const method = routeData.event.request.method
		return headers.get('accept').includes('text/html') && method === 'GET'
	},
	new NetworkFirst({
		cacheName: `beat-${VERSION}`,
		matchOptions: {
			ignoreVary: true,
		},
		plugins: [
			new ExpirationPlugin({
				maxEntries: 250,
				maxAgeSeconds: 60 * 60 * 24 * 2, // 2 days
			}),
			new CacheableResponsePlugin({
				statuses: [0, 200],
			}),
		],
	})
)

registerRoute(
	/\.(?:png|gif|jpg|jpeg|svg)$/,
	new StaleWhileRevalidate({
		cacheName: `beat-images-${VERSION}`,
		plugins: [
			new ExpirationPlugin({
				maxEntries: 500,
				maxAgeSeconds: 60 * 60 * 24 * 2, // 2 days
				purgeOnQuotaError: true,
			}),
			new CacheableResponsePlugin({
				statuses: [0, 200],
			}),
		],
	})
)
;(self as any).addEventListener('message', (event: any) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		;(self as any).skipWaiting()
	}

	// if (event.data && event.data.type === 'INIT_PORT') {
	//   getVersionPort = event.ports[0];
	// }

	// if (event.data && event.data.type === 'INCREASE_COUNT') {
	//   getVersionPort.postMessage({ payload: ++count });
	// }
	// if (event.data && event.data.type === 'INCREASE_COUNT') {
	//   console.log('event:', event)
	//   // Select who we want to respond to
	//   (self as any).clients.matchAll({
	//     includeUncontrolled: true,
	//     type: 'window',
	//   }).then((clients) => {
	//     if (clients && clients.length) {
	//       // Send a response - the clients
	//       // array is ordered by last focused
	//       clients[0].postMessage({
	//         type: 'REPLY_COUNT',
	//         count: ++count,
	//       });
	//     }
	//   });
	// }
})
;(self as any).addEventListener('activate', (event: any) => {
	event.waitUntil((self as any).clients.claim())
})

// const broadcast = new BroadcastChannel('count-channel');
// broadcast.onmessage = (event) => {
//   if (event.data && event.data.type === 'INCREASE_COUNT') {
//     broadcast.postMessage({ payload: ++count });
//   }
// };
