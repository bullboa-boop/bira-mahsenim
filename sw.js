// ============================================================
// Bira Mahzenim - Service Worker
// ============================================================
// AMAÇ 1: PWA kurulabilirlik sinyali. Service worker'ı olmayan
// siteler icin tarayici "gercekten kurulmaya deger mi" diye ek
// kontroller/gecikmeler uyguluyor - bu dosya o gecikmeyi ortadan
// kaldirmak icin var.
//
// AMAÇ 2: Gerçek çevrimdışı çalışma. Uygulamanin kendi tanitim
// metninde "İnternet olmadan da çalışır" yaziyor - bu vaadin
// gercekten dogru olmasi icin sayfanin bir onbellek kopyasi
// tutulur.
//
// ÖNEMLİ TASARIM KARARI: Bu uygulama COK SIK guncelleniyor (tek
// bir gelistirme oturumunda bile onlarca surum cikabiliyor). Bu
// yuzden BILEREK "agresif" bir onbellekleme (cache-first) DEGIL,
// "AG-ONCELIKLI" (network-first) strateji kullaniliyor:
//   - Internet varsa: her zaman EN GUNCEL surumu ag'dan getirir.
//   - Internet yoksa: en son basariyla yuklenmis kopyayi (onbellek)
//     sunar, sayfa tamamen bombos kalmaz.
// Cache-first kullanilsaydi, kullanicilar yeni bir surum
// yukledikten SONRA BILE eski surumde "sikisip" kalabilirdi -
// bu, kurulum/hata sonuclarini test ederken cok kafa karistirici
// olurdu. Network-first bu riski tamamen ortadan kaldirir.

const CACHE_NAME = 'biramahzenim-cache-v1';

self.addEventListener('install', function (event) {
    // Yeni surum yuklendiginde bekleyen sekmeleri beklemeden hemen
    // devreye gir - kullanici sayfayi kapatip acmasin diye.
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    // Eski cache adlari birikmesin diye temizle, ve acik sekmeleri
    // hemen bu service worker'in kontrolune al.
    event.waitUntil(
        caches.keys()
            .then(function (names) {
                return Promise.all(
                    names.filter(function (n) { return n !== CACHE_NAME; })
                         .map(function (n) { return caches.delete(n); })
                );
            })
            .then(function () { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function (event) {
    // Sadece bu siteye ait (same-origin) GET isteklerini ele al.
    // Firebase/Google CDN gibi disaridan gelen kaynaklara (auth,
    // firestore modulleri, font/kutuphane linkleri) hic dokunma -
    // onlarin kendi ag davranisi bozulmasin.
    if (event.request.method !== 'GET') return;

    var url;
    try { url = new URL(event.request.url); } catch (e) { return; }
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request)
            .then(function (response) {
                // Basarili ag yaniti: bir kopyasini onbellege al, kullaniciya
                // ag'dan gelen (en guncel) yaniti dondur.
                var kopya = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(event.request, kopya);
                });
                return response;
            })
            .catch(function () {
                // Ag basarisiz (cevrimdisi): varsa onbellekten sun.
                return caches.match(event.request).then(function (cached) {
                    return cached || Response.error();
                });
            })
    );
});
