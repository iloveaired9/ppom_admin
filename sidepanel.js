document.addEventListener('DOMContentLoaded', async () => {
  console.log('Sidepanel loaded');
  
  // 1. DOM Elements
  const elements = {
    toggle: document.getElementById('inspectorToggle'),
    statusBadge: document.getElementById('statusBadge'),
    totalAds: document.getElementById('totalAds'),
    googleAds: document.getElementById('googleAds'),
    kakaoAds: document.getElementById('kakaoAds'),
    way2gAds: document.getElementById('way2gAds'),
    naverAds: document.getElementById('naverAds'),
    otherAds: document.getElementById('otherAds'),
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    defaultTabSelect: document.getElementById('defaultTabSelect'),
    adTagList: document.getElementById('adTagList'),
    linkCount: document.getElementById('linkCount'),
    linkList: document.getElementById('linkList'),
    linkListBox: document.getElementById('linkListBox'),
    linkEmptyState: document.getElementById('linkEmptyState'),
    linkScanningState: document.getElementById('linkScanningState'),
    scanLinksBtn: document.getElementById('scanLinksBtn'),
    autoScanLinksToggle: document.getElementById('autoScanLinksToggle'),
    refreshPpomBtn: document.getElementById('refreshPpomBtn'),
    ppomLinkCount: document.getElementById('ppomLinkCount'),
    ppomLinkList: document.getElementById('ppomLinkList'),
    ppomEmptyState: document.getElementById('ppomEmptyState'),
    ppomDebugLogs: document.getElementById('ppomDebugLogs')
  };

  // Connect to background
  const port = chrome.runtime.connect({ name: 'sidepanel' });

  // --- Utility Functions ---
  async function getActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab;
    } catch (e) {
      console.error('Failed to get active tab:', e);
      return null;
    }
  }

  async function sendMessageToActiveTab(message) {
    const tab = await getActiveTab();
    if (tab && tab.id) {
      addDebugLog(`Sending message: ${message.action || message.type}`);
      return chrome.tabs.sendMessage(tab.id, message).catch(err => {
        addDebugLog(`<span style="color:#ff4757;">Error: ${err.message}</span>`);
        console.warn('Message failed or content script not ready:', err);
      });
    } else {
      addDebugLog('<span style="color:#ff4757;">Error: No active tab found.</span>');
    }
  }

  // --- Debug Logic ---
  const debugBtn = document.getElementById('toggleDebugBtn');
  const debugContainer = document.getElementById('debugLogContainer');
  if (debugBtn && debugContainer) {
    debugBtn.onclick = () => {
      const isHidden = debugContainer.style.display === 'none';
      debugContainer.style.display = isHidden ? 'block' : 'none';
      debugBtn.textContent = isHidden ? '접기' : '열기';
    };
  }

  function addDebugLog(msg) {
    if (!elements.ppomDebugLogs) return;
    const div = document.createElement('div');
    const time = new Date().toLocaleTimeString();
    div.innerHTML = `<span style="color:#adb5bd;">[${time}]</span> ${msg}`;
    elements.ppomDebugLogs.appendChild(div);
    // Auto scroll
    if (debugContainer) {
      debugContainer.scrollTop = debugContainer.scrollHeight;
    }
  }

  function updateStatusUI(isActive, isPpomppu = true) {
    if (!elements.statusBadge) return;
    
    if (!isPpomppu) {
      elements.statusBadge.textContent = 'N/A';
      elements.statusBadge.classList.remove('active');
      return;
    }

    if (isActive) {
      elements.statusBadge.textContent = 'ON';
      elements.statusBadge.classList.add('active');
    } else {
      elements.statusBadge.textContent = 'OFF';
      elements.statusBadge.classList.remove('active');
    }
  }

  function setInspectorActive(active) {
    console.log('Setting inspector active:', active);
    chrome.storage.local.set({ inspectorActive: active }, () => {
      if (elements.toggle) elements.toggle.checked = active;
      updateStatusUI(active);
      sendMessageToActiveTab({ type: 'TOGGLE_INSPECTOR', active: active });
    });
  }

  function switchTab(targetId) {
    const tabBtn = document.querySelector(`.tab[data-tab="${targetId}"]`);
    if (tabBtn) tabBtn.click();
  }

  // --- Tab Logic ---
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const activeTabEl = document.querySelector('.tab.active');
      const prevTab = activeTabEl ? activeTabEl.getAttribute('data-tab') : null;
      const target = tab.getAttribute('data-tab');
      
      if (prevTab === target) return;

      // Update UI
      elements.tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === target);
      });

      // Feature specific logic
      handleTabChange(prevTab, target);
    });
  });

  async function handleTabChange(prevTab, target) {
    console.log('Tab changed from', prevTab, 'to', target);
    
    // Cleanup previous tab features
    if (prevTab === 'tab-ads' && target !== 'tab-ads') {
      setInspectorActive(false);
    } else if (prevTab === 'tab-links' && target !== 'tab-links') {
      sendMessageToActiveTab({ action: 'clear_link_highlights' });
    } else if (prevTab === 'tab-ppom' && target !== 'tab-ppom') {
      sendMessageToActiveTab({ action: 'clear_ppom_highlights' });
    }

    const tab = await getActiveTab();
    const isPpom = tab && tab.url && tab.url.includes('ppomppu.co.kr');

    // Activate target tab features
    if (target === 'tab-ads' && isPpom) {
      setInspectorActive(true);
    }

    if (target === 'tab-links' && isPpom) {
      chrome.storage.local.get(['autoScanLinks'], (res) => {
        if (res.autoScanLinks) requestLinkScan();
      });
    }

    if (target === 'tab-ppom' && isPpom) {
      sendMessageToActiveTab({ action: 'request_ppom_links' }).then(res => {
        updatePpomUI(res?.links || []);
      });
    }
  }

  // --- Sync Logic ---
  let isSyncing = false;
  async function sync() {
    if (isSyncing) return;
    isSyncing = true;
    
    try {
      const tab = await getActiveTab();
      if (!tab || !tab.url) {
        updateStatusUI(false, false);
        addDebugLog('Sync: Non-Ppomppu page.');
        return;
      }

      const isPpom = tab.url.includes('ppomppu.co.kr');
      addDebugLog(`Sync: ${isPpom ? 'Ppomppu detected' : 'Other page'}`);
      
      if (!isPpom) {
        console.log('Not a Ppomppu page');
        if (elements.toggle) elements.toggle.disabled = true;
        updateStatusUI(false, false);
        return;
      }

      console.log('Ppomppu page detected');
      if (elements.toggle) elements.toggle.disabled = false;

      chrome.storage.local.get(['defaultTab', 'inspectorActive', 'autoScanLinks'], (res) => {
        const activeTabEl = document.querySelector('.tab.active');
        const activeTabId = activeTabEl ? activeTabEl.getAttribute('data-tab') : 'tab-ads';

        if (!window.hasInitialized) {
          window.hasInitialized = true;
          const startTab = res.defaultTab || 'tab-ads';
          console.log('First init, switching to:', startTab);
          switchTab(startTab);
          if (startTab === 'tab-ads') {
            setInspectorActive(true);
          }
        } else {
          // If already initialized but we switched BACK to a Ppomppu page
          if (activeTabId === 'tab-ads') {
            console.log('Enforcing ON for Ads tab');
            setInspectorActive(true);
          }
        }
        
        sendMessageToActiveTab({ type: 'REQUEST_STATS' });
      });
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      isSyncing = false;
    }
  }

  // Listeners
  chrome.tabs.onActivated.addListener(() => sync());
  chrome.tabs.onUpdated.addListener((id, change, tab) => {
    if (change.status === 'complete' && tab.active) sync();
  });

  // --- Link Scan Logic ---
  const MIN_SCAN_TIME = 800;
  let lastScanStart = 0;

  function requestLinkScan() {
    lastScanStart = Date.now();
    if (elements.linkScanningState) elements.linkScanningState.style.display = 'flex';
    if (elements.linkListBox) elements.linkListBox.style.display = 'none';
    if (elements.linkEmptyState) elements.linkEmptyState.style.display = 'none';
    
    sendMessageToActiveTab({ action: 'scan_links' }).then(res => {
      const delay = Math.max(0, MIN_SCAN_TIME - (Date.now() - lastScanStart));
      setTimeout(() => {
        updateLinkUI(res?.links || []);
      }, delay);
    });
  }

  function updateLinkUI(links) {
    if (elements.linkScanningState) elements.linkScanningState.style.display = 'none';
    if (elements.linkCount) elements.linkCount.textContent = links.length;
    if (elements.linkList) {
      elements.linkList.innerHTML = '';
      if (links.length > 0) {
        if (elements.linkListBox) elements.linkListBox.style.display = 'block';
        links.forEach(l => {
          const li = document.createElement('li');
          li.className = 'tag-item';
          li.style.cursor = 'pointer';
          li.innerHTML = `<span class="tag-type-icon" style="background:#ff4757;"></span><span class="tag-label">${l.text}</span>`;
          li.onclick = () => sendMessageToActiveTab({ action: 'scroll_to_link', index: l.index });
          elements.linkList.appendChild(li);
        });
      } else if (elements.linkEmptyState) {
        elements.linkEmptyState.style.display = 'block';
      }
    }
  }

  // --- Event Bindings ---
  if (elements.toggle) {
    elements.toggle.addEventListener('change', () => setInspectorActive(elements.toggle.checked));
  }
  if (elements.scanLinksBtn) {
    elements.scanLinksBtn.onclick = requestLinkScan;
  }
  if (elements.autoScanLinksToggle) {
    elements.autoScanLinksToggle.onchange = () => chrome.storage.local.set({ autoScanLinks: elements.autoScanLinksToggle.checked });
  }
  if (elements.defaultTabSelect) {
    elements.defaultTabSelect.onchange = () => chrome.storage.local.set({ defaultTab: elements.defaultTabSelect.value });
  }
  if (elements.refreshPpomBtn) {
    elements.refreshPpomBtn.onclick = () => {
      sendMessageToActiveTab({ action: 'request_ppom_links' }).then(res => {
        updatePpomUI(res?.links || []);
      });
    };
  }

  // --- Message Listener ---
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'AD_STATS') {
      if (elements.totalAds) elements.totalAds.textContent = msg.total || 0;
      if (elements.googleAds) elements.googleAds.textContent = msg.google || 0;
      if (elements.kakaoAds) elements.kakaoAds.textContent = msg.kakao || 0;
      if (elements.way2gAds) elements.way2gAds.textContent = msg.way2g || 0;
      if (elements.naverAds) elements.naverAds.textContent = msg.naver || 0;
      if (elements.otherAds) elements.otherAds.textContent = msg.other || 0;
      renderTagList(msg.ads || []);
    } else if (msg.action === 'links_detected') {
      addDebugLog(`Links detected: ${msg.links?.length || 0}`);
      const delay = Math.max(0, MIN_SCAN_TIME - (Date.now() - lastScanStart));
      setTimeout(() => {
        updateLinkUI(msg.links || []);
      }, delay);
    } else if (msg.action === 'ppom_links_detected') {
      addDebugLog(`Ppom links detected: ${msg.links?.length || 0}`);
      updatePpomUI(msg.links || []);
    } else if (msg.action === 'scan_started') {
      addDebugLog('Scan started...');
      lastScanStart = Date.now();
      if (elements.linkScanningState) elements.linkScanningState.style.display = 'flex';
    }
  });

  function renderTagList(ads) {
    if (!elements.adTagList) return;
    elements.adTagList.innerHTML = ads.length ? '' : '<div style="font-size:11px;color:#adb5bd;padding:10px;text-align:center;">감지된 태그가 없습니다.</div>';
    ads.forEach(ad => {
      const li = document.createElement('li');
      li.className = 'tag-item';
      
      // Split label if it contains fallback info for better styling
      let labelHtml = `<span class="tag-label" title="${ad.label}">${ad.label}</span>`;
      if (ad.label.includes('[대체:')) {
        const parts = ad.label.split(' [대체:');
        const mainPart = parts[0];
        const fallbackPart = parts[1].replace(']', '');
        labelHtml = `
          <div class="tag-label-container">
            <span class="tag-label" title="${mainPart}">${mainPart}</span>
            <span class="fallback-badge">대체: ${fallbackPart}</span>
          </div>
        `;
      }

      li.innerHTML = `<span class="tag-type-icon tag-type-${ad.type}"></span>${labelHtml}`;
      li.onclick = () => sendMessageToActiveTab({ type: 'SCROLL_TO_AD', adId: ad.id });
      elements.adTagList.appendChild(li);
    });
  }

  function updatePpomUI(links) {
    if (elements.ppomLinkCount) elements.ppomLinkCount.textContent = links.length;
    if (elements.ppomLinkList) {
      elements.ppomLinkList.innerHTML = '';
      if (links.length === 0 && elements.ppomEmptyState) {
        elements.ppomEmptyState.style.display = 'block';
        return;
      }
      if (elements.ppomEmptyState) elements.ppomEmptyState.style.display = 'none';

      links.forEach(link => {
        const li = document.createElement('li');
        li.className = 'link-card';
        li.innerHTML = `
          <div class="link-header">
            <span class="link-index">${link.index + 1}</span>
            <span class="link-title">${link.text || '제목 없음'}</span>
          </div>
          <div class="link-url-container">
            <a href="${link.decodedUrl}" target="_blank" class="link-url" title="${link.decodedUrl}">${link.decodedUrl}</a>
            <div class="btn-group">
              <button class="btn-small btn-copy" data-url="${link.decodedUrl}">복사</button>
              <button class="btn-small btn-open" data-url="${link.decodedUrl}">열기</button>
            </div>
          </div>
        `;

        li.onmouseenter = () => sendMessageToActiveTab({ action: 'highlight_ppom_link', index: link.index });
        li.onmouseleave = () => sendMessageToActiveTab({ action: 'remove_ppom_highlight', index: link.index });

        // Copy button logic
        const copyBtn = li.querySelector('.btn-copy');
        copyBtn.onclick = async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(link.decodedUrl);
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✓';
            copyBtn.classList.add('success');
            setTimeout(() => {
              copyBtn.textContent = originalText;
              copyBtn.classList.remove('success');
            }, 1000);
          } catch (err) { console.error('Copy failed:', err); }
        };

        // Open button logic
        const openBtn = li.querySelector('.btn-open');
        openBtn.onclick = (e) => {
          e.stopPropagation();
          window.open(link.decodedUrl, '_blank');
        };

        elements.ppomLinkList.appendChild(li);
      });
    }
  }

  // Initial Sync
  sync();
  
  // Periodic Stats
  setInterval(() => {
    if (elements.toggle && elements.toggle.checked) {
      sendMessageToActiveTab({ type: 'REQUEST_STATS' });
    }
  }, 2000);
});
