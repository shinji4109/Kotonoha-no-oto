// 言の葉の音：オフライン用サービスワーカー
const SHELL = "kn-shell-v2";
const IMAGES = "kn-images-v1";
const FONTS = "kn-fonts-v1";
const SONGS = "kn-songs-v1";
const SHELL_FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  const keep = [SHELL, IMAGES, FONTS, SONGS];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => keep.indexOf(k) < 0).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // ページ本体：新しい版を優先し、電波がなければ保存版
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./").then((r) => r || caches.match("index.html")))
    );
    return;
  }

  // 書体：一度読み込んだら保存
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(FONTS).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // 曲：「オフライン保存」したものだけ保存版を使う
  if (url.pathname.endsWith(".bin")) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }

  // ジャケット画像：保存版をすぐ出し、裏で新しい版に更新
  if (url.pathname.endsWith(".jpg")) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(IMAGES).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
