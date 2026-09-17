export function autoRefresh(callback: () => void, seconds = 25): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible') callback();
  };

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);

  const intervalId = window.setInterval(() => {
    if (document.visibilityState === 'visible') callback();
  }, seconds * 1000);

  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
    window.clearInterval(intervalId);
  };
}
