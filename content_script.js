// Selector definitions
const googleAdSelectors = [
  'ins.adsbygoogle',
  'iframe[id*="google_ads"]',
  'div[id*="google_ads"]',
  'div[data-google-query-id]',
  'ins[data-ad-client]',
  'div[data-gpt-slot]',
  'div[id^="google_ads_iframe"]',
  'div[id^="gpt_ad"]',
  'iframe[src*="google_ad.html"]'
];

const kakaoAdSelectors = [
  'iframe[src*="kakao_ad"]',
  'iframe[src*=".ppomppu.co.kr/banner/kakao_ad"]'
];

const naverAdSelectors = [
  'div[id*="powerlink"]',
  'div[class*="powerlink"]',
  '[id*="powerlink"]',
  '[class*="powerlink"]'
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
  .ppom-ad-kakao {
    outline-color: #ffcc00 !important;
  }
  .ppom-ad-kakao::after {
    background: rgba(255, 204, 0, 0.9);
    color: #333;
  }
  .ppom-ad-way2g {
    outline-color: #a55eea !important;
  }
  .ppom-ad-way2g::after {
    background: rgba(165, 94, 234, 0.9);
  }
  .ppom-ad-naver {
    outline-color: #2db400 !important;
  }
  .ppom-ad-naver::after {
    background: rgba(45, 180, 0, 0.9);
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

  kakaoAdSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => addTask(el, 'kakao'));
  });

  naverAdSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => addTask(el, 'naver'));
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
    } else if (item.type === 'kakao' && roots.get(highest).type !== 'google') {
      roots.get(highest).type = 'kakao';
    } else if (item.type === 'naver' && !['google', 'kakao'].includes(roots.get(highest).type)) {
      roots.get(highest).type = 'naver';
    }

    // Way2G check - highest priority if pattern matches
    const label = extractTagName(highest, roots.get(highest).type);
    if (label.includes('/26225854,65120695/PPomppu/ppomppu.co.kr/')) {
      roots.get(highest).type = 'way2g';
    }
  });

  // 3. Finalize names and apply highlights
  clearHighlights();
  let count = 0;
  roots.forEach((info, el) => {
    const dimensions = `${el.offsetWidth}x${el.offsetHeight}`;
    const name = `${extractTagName(el, info.type)} (${dimensions})`;
    const adId = `${info.type}-${count++}-${Date.now()}`;
    highlightElement(el, name, info.type, adId);
  });

  sendStats();
}

function extractTagName(el, type) {
  let name = "";
  const gptSlot = el.getAttribute('data-gpt-slot');
  const adClient = el.getAttribute('data-ad-client');
  const way2gPattern = '/26225854,65120695/PPomppu/ppomppu.co.kr/';

  // 1. Check for GPT slot or Ad Client
  if (gptSlot) {
    if (gptSlot.includes(way2gPattern)) name = `Way2G (${gptSlot})`;
    else name = gptSlot;
  } else if (adClient) {
    name = `AdSense (${adClient})`;
  }

  // 2. Check personal IDs, but filter out the technical google iframe IDs
  if (!name && el.id) {
    if (!el.id.includes('google_ads_iframe') && !el.id.includes('gpt_ad')) {
      name = el.id;
    } else if (el.id.includes('google_ads_iframe_/')) {
      const parts = el.id.split('google_ads_iframe_');
      if (parts.length > 1) {
        const slotName = parts[1].replace(/_\d+$/, '');
        if (slotName.includes(way2gPattern)) name = `Way2G (${slotName})`;
        else name = slotName;
      }
    }
  }

  // 3. Look for a better name in children (e.g. nested GPT slot info)
  if (!name) {
    const nestedGpt = el.querySelector('[data-gpt-slot]');
    if (nestedGpt) {
      const slot = nestedGpt.getAttribute('data-gpt-slot');
      if (slot.includes(way2gPattern)) name = `Way2G (${slot})`;
      else name = slot;
    }
  }

  if (!name) {
    const nestedIns = el.querySelector('ins[data-ad-slot]');
    if (nestedIns) name = `AdSense Slot: ${nestedIns.getAttribute('data-ad-slot')}`;
  }

  // 4. Check for Kakao AdFit
  if (!name && (type === 'kakao' || (el.tagName === 'IFRAME' && el.src.includes('kakao_ad')))) {
    const src = el.src || '';
    const match = src.match(/kakao_ad_(\d+x\d+)/);
    const sizeStr = match ? ` ${match[1]}` : '';
    name = `Kakao AdFit${sizeStr}`;
  }

  // 5. Google Ad Wrapper (iframes with google_ad.html)
  if (!name && el.tagName === 'IFRAME' && el.src.includes('google_ad.html')) {
    const src = el.src || '';
    const posMatch = src.match(/pos=([^&]+)/);
    const posStr = posMatch ? ` (pos: ${posMatch[1]})` : '';
    name = `Google Ad Wrapper${posStr}`;
  }

  // 6. Naver Powerlink
  if (!name && (type === 'naver' || (el.id && el.id.includes('powerlink')) || (el.className && typeof el.className === 'string' && el.className.includes('powerlink')))) {
    name = 'Naver Powerlink';
  }

  // 7. Default fallback
  const fallbackName = type === 'google' ? `Google Ad (${el.offsetWidth}x${el.offsetHeight})` : `Ad Slot (${el.offsetWidth}x${el.offsetHeight})`;
  const baseName = name || fallbackName;

  // 8. Add Google Defined Sizes
  if (type === 'google' || type === 'way2g') {
    const definedSizes = findGoogleDefinedSizes(el);
    if (definedSizes) {
      return `${baseName} [GPT: ${definedSizes}]`;
    }
  }

  return baseName;
}

function findGoogleDefinedSizes(el) {
  if (!el.id) return null;

  // 1. Look for scripts in the entire document (most robust for GPT)
  // Since defineSlot can be anywhere, we search scripts for the ID
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const code = script.textContent;
    if (code.includes('googletag.defineSlot') && code.includes(el.id)) {
      const size = parseDefineSlot(code, el.id);
      if (size) return size;
    }
  }
  return null;
}

function parseDefineSlot(code, targetId) {
  // Regex to match: googletag.defineSlot('/path', [[size], [size]], 'targetId')
  // We match the size part and verify the targetId
  const regex = /googletag\.defineSlot\s*\(\s*['"][^'"]+['"]\s*,\s*([[\]0-9\s,]+)\s*,\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    const sizePart = match[1].trim();
    const slotId = match[2];
    
    if (slotId === targetId) {
      return sizePart;
    }
  }
  return null;
}

function highlightElement(el, label, type, adId) {
  el.classList.add('ppom-ad-highlight');
  el.setAttribute('data-ppom-ad-id', adId);
  if (type === 'google') {
    el.classList.add('ppom-ad-google');
  } else if (type === 'kakao') {
    el.classList.add('ppom-ad-kakao');
  } else if (type === 'way2g') {
    el.classList.add('ppom-ad-way2g');
  } else if (type === 'naver') {
    el.classList.add('ppom-ad-naver');
  }
  el.setAttribute('data-ad-info', label);
}

function clearHighlights() {
  document.querySelectorAll('.ppom-ad-highlight').forEach(el => {
    el.classList.remove('ppom-ad-highlight', 'ppom-ad-google', 'ppom-ad-kakao', 'ppom-ad-way2g', 'ppom-ad-naver', 'pulse');
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
    let type = 'other';
    if (el.classList.contains('ppom-ad-google')) type = 'google';
    else if (el.classList.contains('ppom-ad-kakao')) type = 'kakao';
    else if (el.classList.contains('ppom-ad-way2g')) type = 'way2g';
    else if (el.classList.contains('ppom-ad-naver')) type = 'naver';

    adDetails.push({
      id: el.getAttribute('data-ppom-ad-id'),
      label: el.getAttribute('data-ad-info'),
      type: type
    });
  });

  chrome.runtime.sendMessage({
    type: 'AD_STATS',
    total: adDetails.length,
    google: adDetails.filter(a => a.type === 'google').length,
    kakao: adDetails.filter(a => a.type === 'kakao').length,
    way2g: adDetails.filter(a => a.type === 'way2g').length,
    naver: adDetails.filter(a => a.type === 'naver').length,
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
