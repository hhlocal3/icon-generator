/* ============================================================
   Service Worker — مولّد أيقونات التطبيقات
   يعمل دون اتصال كامل: يخزّن ملفات التطبيق + المكتبات الخارجية
   ⚠️ عند تحديث ملفات التطبيق: غيّر رقم VERSION أدناه
   ============================================================ */

const VERSION = "v1.0.5";
const CACHE = "icon-gen-" + VERSION;

// ملفات التطبيق الأساسية (تُخزَّن فور التثبيت)
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

// المكتبات والخطوط الخارجية اللازمة للعمل دون اتصال
const RUNTIME_URLS = [
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap"
];

/* ---------- التثبيت: تخزين مسبق لكل الموارد ---------- */
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // نستخدم catch لكل ملف على حدة حتى لا يفشل التثبيت عند غياب ملف
      await Promise.all(
        PRECACHE.map(url => cache.add(url).catch(err => console.warn("SW: تخطي", url, err)))
      );
      await Promise.all(
        RUNTIME_URLS.map(url => cache.add(url).catch(err => console.warn("SW: تعذر تخزين", url, err)))
      );
    }).then(() => self.skipWaiting())
  );
});

/* ---------- التفعيل: حذف النسخ القديمة ---------- */
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith("icon-gen-") && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---------- الاعتراض: استراتيجية «المخزون أولاً + تحديث بالخلفية» ---------- */
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // طلبات التنقل بين الصفحات: الشبكة أولاً، والعودة للمخزون عند انقطاعها
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // بقية الطلبات (صور، خطوط، مكتبات):
  // إجابة فورية من المخزون + تحديث صامت من الشبكة
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached); // الشبكة فشلت → المخزون
      return cached || network;
    })
  );
});