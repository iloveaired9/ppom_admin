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
    ppomEmptyState: document.getElementById('ppomEmptyState')
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
      return chrome.tabs.sendMessage(tab.id, message).catch(err => {
        console.warn('Message failed or content script not ready:', err);
      });
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
    
    const tab = await getActiveTab();
    const isPpom = tab && tab.url && tab.url.includes('ppomppu.co.kr');

    if (target === 'tab-ads' && isPpom) {
      setInspectorActive(true);
    } else if (prevTab === 'tab-ads' && target !== 'tab-ads') {
      setInspectorActive(false);
    }

    if (target === 'tab-links' && isPpom) {
      chrome.storage.local.get(['autoScanLinks'], (res) => {
        if (res.autoScanLinks) requestLinkScan();
      });
    }

    if (target === 'tab-ppom' && isPpom) {
      sendMessageToActiveTab({ action: 'request_ppom_links' });
    }
  }

  // --- Sync Logic ---
  let isSyncing = false;
  async function sync() {
    if (isSyncing) return;
    isSyncing = true;
    
    try {
      console.log('Syncing sidepanel with active tab...');
      const tab = await getActiveTab();
      const isPpom = tab && tab.url && tab.url.includes('ppomppu.co.kr');
      
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
    elements.refreshPpomBtn.onclick = () => sendMessageToActiveTab({ action: 'request_ppom_links' });
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
    } else if (msg.action === 'ppom_links_detected') {
      updatePpomUI(msg.links || []);
    }
  });

  function renderTagList(ads) {
    if (!elements.adTagList) return;
    elements.adTagList.innerHTML = ads.length ? '' : '<div style="font-size:11px;color:#adb5bd;padding:10px;text-align:center;">감지된 태그가 없습니다.</div>';
    ads.forEach(ad => {
      const li = document.createElement('li');
      li.className = 'tag-item';
      li.innerHTML = `<span class="tag-type-icon tag-type-${ad.type}"></span><span class="tag-label" title="${ad.label}">${ad.label}</span>`;
      li.onclick = () => sendMessageToActiveTab({ type: 'SCROLL_TO_AD', adId: ad.id });
      elements.adTagList.appendChild(li);
    });
  }

  function updatePpomUI(links) {
    if (elements.ppomLinkCount) elements.ppomLinkCount.textContent = links.length;
    if (elements.ppomLinkList) {
      elements.ppomLinkList.innerHTML = '';
      if (links.length === 0 && elements.ppomEmptyState) elements.ppomEmptyState.style.display = 'block';
      links.forEach(link => {
        const li = document.createElement('li');
        li.className = 'link-card';
        li.innerHTML = `
          <div class="link-header">
            <span class="link-index">${link.index + 1}</span>
            <span class="link-title">${link.text || '제목 없음'}</span>
          </div>
          <div class="link-url-container">
            <a href="${link.decodedUrl}" target="_blank" class="link-url">${link.decodedUrl}</a>
          </div>
        `;
        li.onmouseenter = () => sendMessageToActiveTab({ action: 'highlight_ppom_link', index: link.index });
        li.onmouseleave = () => sendMessageToActiveTab({ action: 'remove_ppom_highlight', index: link.index });
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
