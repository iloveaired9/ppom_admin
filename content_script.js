// Selector definitions
const googleAdSelectors = [
  'ins.adsbygoogle',
  'iframe[id*="google_ads"]',
  'div[id*="google_ads"]',
  'div[data-google-query-id]',
  'ins[data-ad-client]',
  'div[data-gpt-slot]',
  'div[id^="google_ads_iframe"]',
  'div[id^="gpt_ad"]'
];

const otherAdSelectors = [
  'div[id*="_f_"]',
  'div[class*="_f_"]',
  '.ad-container',
  'div[id*="ad_area"]',
  'div[id*="ad-"]'
];

let inspectorActive = false;

// Apply CSS for highlights
const style = document.createElement('style');
style.id = 'ad-inspector-styles';
style.innerHTML = `
  .ppom-ad-highlight {
    position: relative !important;
    outline: 3px solid #ff4757 !important;
    outline-offset: -3px !important;
    transition: all 0.3s ease;
  }
  .ppom-ad-highlight::after {
    content: attr(data-ad-info);
    position: absolute;
    top: 5px;
    left: 5px;
    background: rgba(255, 71, 87, 0.9);
    color: white;
    font-size: 11px;
    padding: 2px 8px;
    z-index: 100000;
    pointer-events: none;
    font-family: sans-serif;
    font-weight: bold;
    white-space: nowrap;
    border-radius: 4px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  }
  .ppom-ad-google {
    outline-color: #4285f4 !important;
  }
  .ppom-ad-google::after {
    background: rgba(66, 133, 244, 0.9);
  }
  .ppom-ad-highlight.pulse {
    animation: ppom-pulse 1s ease-out;
  }
  @keyframes ppom-pulse {
    0% { transform: scale(1); outline-width: 3px; }
    50% { transform: scale(1.02); outline-width: 10px; outline-color: #fffa65 !important; }
    100% { transform: scale(1); outline-width: 3px; }
  }
`;
document.head.appendChild(style);

// Initialize inspector state
chrome.storage.local.get(['inspectorActive'], (result) => {
  inspectorActive = !!result.inspectorActive;
  if (inspectorActive) {
    scanAndHighlight();
  }
});

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_INSPECTOR') {
    inspectorActive = message.active;
    if (inspectorActive) {
      scanAndHighlight();
    } else {
      clearHighlights();
    }
  } else if (message.type === 'REQUEST_STATS') {
    sendStats();
  } else if (message.type === 'SCROLL_TO_AD') {
    const el = document.querySelector(`[data-ppom-ad-id="${message.adId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 1000);
    }
  }
});

function scanAndHighlight() {
  if (!inspectorActive) return;

  // 1. Gather ALL ad elements
  const allAdElements = [];
  
  const addTask = (el, type) => {
    if (el.offsetWidth > 10 && el.offsetHeight > 10) {
      allAdElements.push({ el, type });
    }
  };

  googleAdSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => addTask(el, 'google'));
  });

  otherAdSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => addTask(el, 'other'));
  });

  // 2. Identify "Roots" - outermost elements that are part of an ad
  const roots = new Map(); // Element -> { type, name }
  const elementsArray = allAdElements.map(o => o.el);

  allAdElements.forEach(item => {
    const el = item.el;
    
    // Find highest ancestor that is ALSO in allAdElements
    let highest = el;
    let curr = el.parentElement;
    while (curr && curr !== document.body) {
      if (elementsArray.includes(curr)) {
        highest = curr;
      }
      curr = curr.parentElement;
    }

    // Initialize or update root info
    if (!roots.has(highest)) {
      roots.set(highest, { type: item.type, name: '' });
    }
    
    // If any element in this hierarchy is 'google', the whole root is 'google'
    if (item.type === 'google') {
      roots.get(highest).type = 'google';
    }
  });

  // 3. Finalize names and apply highlights
  clearHighlights();
  let count = 0;
  roots.forEach((info, el) => {
    const name = extractTagName(el, info.type);
    const adId = `${info.type}-${count++}-${Date.now()}`;
    highlightElement(el, name, info.type, adId);
  });

  sendStats();
}

function extractTagName(el, type) {
  // 1. Check for GPT slot or Ad Client
  const gptSlot = el.getAttribute('data-gpt-slot');
  if (gptSlot) return gptSlot;
  
  const adClient = el.getAttribute('data-ad-client');
  if (adClient) return `AdSense (${adClient})`;

  // 2. Check personal IDs, but filter out the technical google iframe IDs
  if (el.id) {
    if (!el.id.includes('google_ads_iframe') && !el.id.includes('gpt_ad')) {
      return el.id;
    }
    
    // If it DOES contain google_ads_iframe, try to extract the slot name from it
    // Example: google_ads_iframe_/26225854,65120695/PPomppu/..._0
    if (el.id.includes('google_ads_iframe_/')) {
      const parts = el.id.split('google_ads_iframe_');
      if (parts.length > 1) {
        // Strip the trailing index like _0
        return parts[1].replace(/_\d+$/, '');
      }
    }
  }

  // 3. Look for a better name in children (e.g. nested GPT slot info)
  const nestedGpt = el.querySelector('[data-gpt-slot]');
  if (nestedGpt) return nestedGpt.getAttribute('data-gpt-slot');

  const nestedIns = el.querySelector('ins[data-ad-slot]');
  if (nestedIns) return `AdSense Slot: ${nestedIns.getAttribute('data-ad-slot')}`;

  // 4. Default fallback
  return type === 'google' ? `Google Ad (${el.offsetWidth}x${el.offsetHeight})` : `Ad Slot (${el.offsetWidth}x${el.offsetHeight})`;
}

function highlightElement(el, label, type, adId) {
  el.classList.add('ppom-ad-highlight');
  el.setAttribute('data-ppom-ad-id', adId);
  if (type === 'google') el.classList.add('ppom-ad-google');
  el.setAttribute('data-ad-info', label);
}

function clearHighlights() {
  document.querySelectorAll('.ppom-ad-highlight').forEach(el => {
    el.classList.remove('ppom-ad-highlight', 'ppom-ad-google', 'pulse');
    el.removeAttribute('data-ad-info');
    el.removeAttribute('data-ppom-ad-id');
  });
}

function sendStats() {
  if (!inspectorActive) {
    chrome.runtime.sendMessage({ type: 'AD_STATS', total: 0, google: 0, other: 0, ads: [] }).catch(() => {});
    return;
  }
  
  const adDetails = [];
  document.querySelectorAll('.ppom-ad-highlight').forEach(el => {
    adDetails.push({
      id: el.getAttribute('data-ppom-ad-id'),
      label: el.getAttribute('data-ad-info'),
      type: el.classList.contains('ppom-ad-google') ? 'google' : 'other'
    });
  });

  chrome.runtime.sendMessage({
    type: 'AD_STATS',
    total: adDetails.length,
    google: adDetails.filter(a => a.type === 'google').length,
    other: adDetails.filter(a => a.type === 'other').length,
    ads: adDetails
  }).catch(() => {});
}

// Throttled scan
let scanTimeout = null;
function throttledScan() {
  if (scanTimeout) clearTimeout(scanTimeout);
  scanTimeout = setTimeout(scanAndHighlight, 500);
}

const observer = new MutationObserver((mutations) => {
  if (inspectorActive) throttledScan();
});

observer.observe(document.body, { childList: true, subtree: true });
