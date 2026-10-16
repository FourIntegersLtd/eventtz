export function installVisibilityRefresh(onRefresh: () => void): () => void {
  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      onRefresh();
    }
  };
  const onFocus = () => {
    onRefresh();
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onFocus);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", onFocus);
  };
}

