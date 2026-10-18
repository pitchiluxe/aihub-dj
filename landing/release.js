(async function () {
  // Keep the permanent /latest/download link if GitHub is offline or the release is incomplete.
  try {
    const response = await fetch('https://api.github.com/repos/pitchiluxe/aihub-dj/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    if (!response.ok) return
    const release = await response.json()
    const installer = (release.assets || []).find(asset => asset.name === 'AIHub-DJ-Setup.exe')
    if (!installer || !installer.browser_download_url?.startsWith('https://github.com/pitchiluxe/aihub-dj/releases/download/')) return
    document.getElementById('dl-main').href = installer.browser_download_url
    if (release.tag_name) document.getElementById('dl-version').textContent = release.tag_name.replace(/^v/, '')
  } catch { /* The permanent download link remains usable. */ }
})()
