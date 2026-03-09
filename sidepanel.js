document.addEventListener('DOMContentLoaded', () => {
  // Connect to background for closure detection
  const port = chrome.runtime.connect({ name: 'sidepanel' });
  
  const toggle = document.getElementById('inspectorToggle');
  const statusBadge = document.getElementById('statusBadge');
  const totalAds = document.getElementById('totalAds');
  const googleAds = document.getElementById('googleAds');
  const otherAds = document.getElementById('otherAds');

  // Auto-enable inspector on open
  chrome.storage.local.set({ inspectorActive: true }, () => {
    toggle.checked = true;
    updateStatusUI(true);
    
    // Notify active tab to enable visualization
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'TOGGLE_INSPECTOR', 
          active: true 
        }).catch(err => console.log('Content script not ready or error:', err));
      }
    });

    // Also notify other Ppomppu tabs for consistency
    chrome.tabs.query({ url: "*://*.ppomppu.co.kr/*" }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { 
          type: 'TOGGLE_INSPECTOR', 
          active: true 
        }).catch(() => {});
      });
    });
  });

  // Listen for changes from content script (detected ad counts)
  chrome.runtime.onMessage.addListener((message) => {
    console.log('Received message in sidepanel:', message);
    if (message.type === 'AD_STATS') {
      if (totalAds) totalAds.textContent = message.total || 0;
      if (googleAds) googleAds.textContent = message.google || 0;
      if (otherAds) otherAds.textContent = message.other || 0;
      renderTagList(message.ads || []);
    }
  });

  function renderTagList(ads) {
    const list = document.getElementById('adTagList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (ads.length === 0) {
      list.innerHTML = '<div style="font-size: 11px; color: #adb5bd; padding: 10px; text-align: center;">감지된 태그가 없습니다.</div>';
      return;
    }

    ads.forEach(ad => {
      const li = document.createElement('li');
      li.className = 'tag-item';
      li.innerHTML = `
        <span class="tag-type-icon tag-type-${ad.type}"></span>
        <span class="tag-label" title="${ad.label}">${ad.label}</span>
      `;
      li.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { 
              type: 'SCROLL_TO_AD', 
              adId: ad.id 
            }).catch(err => {
              console.error('Failed to send scroll message:', err);
            });
          }
        });
      });
      list.appendChild(li);
    });
  }

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
          }).catch(err => console.log('Content script not ready or error:', err));
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

  // Request stats once on sidepanel open
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      console.log('Requesting initial stats for tab:', tabs[0].id);
      chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_STATS' }).catch(err => {
        console.log('Content script not ready or error:', err);
      });
    }
  });

  // Periodically request stats to keep list in sync
  setInterval(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && toggle.checked) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_STATS' }).catch(() => {});
      }
    });
  }, 2000);
});
