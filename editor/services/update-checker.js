export async function checkForUpdates() {
  try {
    const res = await fetch('latest.json');
    const data = await res.json();
    console.log('Latest version', data.version);
  } catch (err) {
    console.warn('Update check failed', err);
  }
}
