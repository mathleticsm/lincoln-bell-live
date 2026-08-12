(() => {
  try {
    const saved = localStorage.getItem('theme');
    const theme = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }
})();
