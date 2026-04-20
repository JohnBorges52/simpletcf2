// SimpleTCF Service Worker — no third-party ad scripts
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
