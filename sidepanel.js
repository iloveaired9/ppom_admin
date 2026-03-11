document.addEventListener('DOMContentLoaded', () => {
  // Connect to background for closure detection
  const port = chrome.runtime.connect({ name: 'sidepanel' });
  
  const toggle = document.getElementById('inspectorToggle');
  const statusBadge = document.getElementById('statusBadge');
  const totalAds = document.getElementById('totalAds');
  const googleAds = document.getElementById('googleAds');
  const kakaoAds = document.getElementById('kakaoAds');
  const way2gAds = document.getElementById('way2gAds');
  const naverAds = document.getElementById('naverAds');
  const otherAds = document.getElementById('otherAds');

  // Tab Switching
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const prevTab = document.querySelector('.tab.active').getAttribute('data-tab');
      const target = tab.getAttribute('data-tab');
      
      if (prevTab === target) return;

      // Update Tab UI
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update Content UI
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === target) {
          content.classList.add('active');
        }
      });

      // Disable features from the previous tab
      if (prevTab === 'tab-ads' && target !== 'tab-ads') {
        // Switching away from Ads, turn off inspector
        setInspectorActive(false);
      } else if (prevTab === 'tab-links' && target !== 'tab-links') {
        // Switching away from Links, clear highlights if any
        sendMessageToActiveTab({ action: 'removePpomHighlight', index: -1 });
      }

      // Special handling for Ppom Link tab activation
      if (target === 'tab-links') {
        sendMessageToActiveTab({ action: 'requestPpomLinks' });
      }
    });
  });

  function switchTab(targetId) {
    const tabBtn = document.querySelector(`.tab[data-tab="${targetId}"]`);
    if (tabBtn) tabBtn.click();
  }

  function setInspectorActive(active) {
    chrome.storage.local.set({ inspectorActive: active }, () => {
      if (toggle) toggle.checked = active;
      updateStatusUI(active);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            type: 'TOGGLE_INSPECTOR', 
            active: active 
          }).catch(() => {});
        }
      });
    });
  }

  // --- Link Scanner Logic ---
  const scanLinksBtn = document.getElementById('scanLinksBtn');
  const autoScanLinksToggle = document.getElementById('autoScanLinksToggle');
  const linkCount = document.getElementById('linkCount');
  const linkList = document.getElementById('linkList');
  const linkListBox = document.getElementById('linkListBox');
  const linkEmptyState = document.getElementById('linkEmptyState');
  const linkScanningState = document.getElementById('linkScanningState');

  // Load Auto Scan setting
  chrome.storage.local.get(['autoScanLinks'], (result) => {
    autoScanLinksToggle.checked = !!result.autoScanLinks;
    updateScanBtnVisibility(autoScanLinksToggle.checked);
    if (autoScanLinksToggle.checked) {
      requestLinkScan();
    }
  });

  autoScanLinksToggle.addEventListener('change', () => {
    const isAuto = autoScanLinksToggle.checked;
    chrome.storage.local.set({ autoScanLinks: isAuto });
    updateScanBtnVisibility(isAuto);
    if (isAuto) {
      requestLinkScan();
    }
  });

  scanLinksBtn.addEventListener('click', () => {
    requestLinkScan();
  });

  function updateScanBtnVisibility(isAuto) {
    scanLinksBtn.style.display = isAuto ? 'none' : 'block';
  }

  function showLinkScanningState() {
    if (linkScanningState) linkScanningState.style.display = 'flex';
    if (linkListBox) linkListBox.style.display = 'none';
    if (linkEmptyState) linkEmptyState.style.display = 'none';
  }

  let lastScanStartTime = 0;
  const MIN_SCAN_TIME = 1000;

  function requestLinkScan() {
    lastScanStartTime = Date.now();
    showLinkScanningState();
    sendMessageToActiveTab({ action: 'scan_links' }).then(response => {
      const elapsed = Date.now() - lastScanStartTime;
      const remaining = Math.max(0, MIN_SCAN_TIME - elapsed);
      
      setTimeout(() => {
        if (response && response.links) {
          updateLinkUI(response.links);
        } else {
          updateLinkUI([]);
        }
      }, remaining);
    });
  }

  function updateLinkUI(links) {
    if (linkScanningState) linkScanningState.style.display = 'none';
    if (linkCount) linkCount.textContent = links.length;
    if (linkList) {
      linkList.innerHTML = '';
      if (links.length > 0) {
        if (linkListBox) linkListBox.style.display = 'block';
        if (linkEmptyState) linkEmptyState.style.display = 'none';
        
        links.forEach(link => {
          const li = document.createElement('li');
          li.className = 'tag-item';
          li.style.cursor = 'pointer';
          li.innerHTML = `
            <span class="tag-type-icon" style="background: #ff4757;"></span>
            <span class="tag-label" style="font-size: 11px;">${link.text}</span>
            <span style="font-size: 10px; color: #adb5bd; margin-left: auto;">${link.href.substring(0, 20)}...</span>
          `;
          li.addEventListener('click', () => {
            sendMessageToActiveTab({ action: 'scroll_to_link', index: link.index });
          });
          linkList.appendChild(li);
        });
      } else {
        if (linkListBox) linkListBox.style.display = 'none';
        if (linkEmptyState) linkEmptyState.style.display = 'block';
      }
    }
  }

  // Settings Logic
  const defaultTabSelect = document.getElementById('defaultTabSelect');
  chrome.storage.local.get(['defaultTab'], (result) => {
    if (result.defaultTab) {
      defaultTabSelect.value = result.defaultTab;
      // If it's not the default tab, switch to it
      if (result.defaultTab !== 'tab-ads') {
        switchTab(result.defaultTab);
      }
    }
  });

  defaultTabSelect.addEventListener('change', () => {
    chrome.storage.local.set({ defaultTab: defaultTabSelect.value });
  });

  async function sendMessageToActiveTab(message) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      return chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
  }

  // Auto-enable inspector on open (only if on ads tab)
  chrome.storage.local.get(['inspectorActive'], (result) => {
    const activeTabId = document.querySelector('.tab.active').getAttribute('data-tab');
    if (activeTabId === 'tab-ads') {
      setInspectorActive(true);
    }
  });

  // Also request initial states anyway to be safe
  setTimeout(() => {
    // Check if the links tab is active and auto-scan is enabled
    const activeTabId = document.querySelector('.tab.active').getAttribute('data-tab');
    if (activeTabId === 'tab-links') {
      chrome.storage.local.get(['autoScanLinks'], (result) => {
        if (result.autoScanLinks) {
          requestLinkScan();
        }
      });
    }
    sendMessageToActiveTab({ type: 'REQUEST_STATS' });
  }, 500);

  // Listen for changes from content script (detected ad counts)
  chrome.runtime.onMessage.addListener((message) => {
    console.log('Received message in sidepanel:', message);
    if (message.type === 'AD_STATS') {
      if (totalAds) totalAds.textContent = message.total || 0;
      if (googleAds) googleAds.textContent = message.google || 0;
      if (kakaoAds) kakaoAds.textContent = message.kakao || 0;
      if (way2gAds) way2gAds.textContent = message.way2g || 0;
      if (naverAds) naverAds.textContent = message.naver || 0;
      if (otherAds) otherAds.textContent = message.other || 0;
      renderTagList(message.ads || []);
    } else if (message.action === 'scan_started') {
      lastScanStartTime = Date.now();
      showLinkScanningState();
    } else if (message.action === 'links_detected') {
      const elapsed = Date.now() - lastScanStartTime;
      const remaining = Math.max(0, MIN_SCAN_TIME - elapsed);
      setTimeout(() => {
        updateLinkUI(message.links || []);
      }, remaining);
    }
  });

  // Listen for tab updates/navigation to ensure sync on page load
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      chrome.storage.local.get(['autoScanLinks'], (result) => {
        const activeTabEl = document.querySelector('.tab.active');
        const activeTabId = activeTabEl ? activeTabEl.getAttribute('data-tab') : null;
        if (result.autoScanLinks && activeTabId === 'tab-links') {
          requestLinkScan();
        }
      });
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
    setInspectorActive(toggle.checked);
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
