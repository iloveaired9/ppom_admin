document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('inspectorToggle');
  const statusBadge = document.getElementById('statusBadge');
  const totalAds = document.getElementById('totalAds');
  const googleAds = document.getElementById('googleAds');
  const otherAds = document.getElementById('otherAds');

  // Load saved state
  chrome.storage.local.get(['inspectorActive'], (result) => {
    toggle.checked = !!result.inspectorActive;
    updateStatusUI(toggle.checked);
  });

  // Listen for changes from content script (detected ad counts)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'AD_STATS') {
      totalAds.textContent = message.total;
      googleAds.textContent = message.google;
      otherAds.textContent = message.other;
    }
  });

  // Handle toggle change
  toggle.addEventListener('change', () => {
    const isActive = toggle.checked;
    chrome.storage.local.set({ inspectorActive: isActive }, () => {
      updateStatusUI(isActive);
      // Notify active tab to enable/disable visualization
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            type: 'TOGGLE_INSPECTOR', 
            active: isActive 
          });
        }
      });
    });
  });

  function updateStatusUI(isActive) {
    if (isActive) {
      statusBadge.textContent = 'ON';
      statusBadge.classList.add('active');
    } else {
      statusBadge.textContent = 'OFF';
      statusBadge.classList.remove('active');
    }
  }

  // Request stats once on popup open
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_STATS' });
    }
  });
});
