/** Warm the browser cache for a landing background video (client-only). */
export function prefetchLandingVideo(src: string) {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-video-prefetch="${src}"]`)) return;

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "video";
  link.href = src;
  link.setAttribute("data-video-prefetch", src);
  document.head.appendChild(link);
}
