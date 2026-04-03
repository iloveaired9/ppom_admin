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
  'iframe[src*=".ppomppu.co.kr/banner/kakao_ad"]',
  'ins.kakao_ad_area'
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
    border-radius: 4px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  }
  .ppom-ad-label {
    position: absolute;
    top: 5px;
    left: 5px;
    background: rgba(33, 37, 41, 0.9);
    color: white;
    font-size: 11px;
    padding: 3px 10px;
    z-index: 2147483647;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-weight: 500;
    white-space: nowrap;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .actual-replacement-text {
    color: #ff4757;
    font-weight: 800;
    text-shadow: 0 0 2px rgba(255, 71, 87, 0.3);
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
  .http-link-highlight {
    outline: 3px solid #ff4757 !important;
    outline-offset: 2px !important;
    background-color: rgba(255, 71, 87, 0.2) !important;
    transition: all 0.3s ease;
    z-index: 10000;
  }
  .ppom-link-highlight {
    outline: 3px solid #f44336 !important;
    background-color: #ffeb3b80 !important;
    transition: all 0.3s ease;
    z-index: 10000;
  }
  .pulse {
    animation: ppom-pulse-active 0.5s ease-in-out 3;
    z-index: 2147483647 !important;
  }
  @keyframes ppom-pulse-active {
    0% { outline-width: 3px; outline-color: inherit; }
    50% { outline-width: 10px; outline-color: #fffa65 !important; transform: scale(1.02); }
    100% { outline-width: 3px; outline-color: inherit; }
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

// 동적 설정 로드 시작
initializeFallbackConfig();

// Primary Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_INSPECTOR') {
    inspectorActive = message.active;
    if (inspectorActive) {
      scanAndHighlight();
    } else {
      clearHighlights();
    }
    sendStats();
  } else if (message.type === 'REQUEST_STATS') {
    sendStats();
  } else if (message.type === 'SCROLL_TO_AD') {
    const el = document.querySelector(`[data-ppom-ad-id="${message.adId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 1500);
    }
  } else if (message.action === 'scan_links') {
    const data = scanAllLinks();
    sendResponse(data);
  } else if (message.action === 'scroll_to_link') {
    scrollToLink(message.index);
  } else if (message.action === 'request_ppom_links') {
    const links = scanPpomppuLinks();
    sendResponse({ links: links });
  } else if (message.action === 'highlight_ppom_link') {
    highlightPpomppuLink(message.index, true);
  } else if (message.action === 'remove_ppom_highlight') {
    highlightPpomppuLink(message.index, false);
  } else if (message.type === 'CLEAR_ALL_HIGHLIGHTS') {
    inspectorActive = false;
    clearHighlights();
    clearHttpLinkHighlights();
    clearPpomLinkHighlights();
  } else if (message.action === 'clear_link_highlights') {
    clearHttpLinkHighlights();
  } else if (message.action === 'clear_ppom_highlights') {
    clearPpomLinkHighlights();
  }
});

function clearHttpLinkHighlights() {
  document.querySelectorAll('.http-link-highlight').forEach(el => {
    el.classList.remove('http-link-highlight');
  });
}

function clearPpomLinkHighlights() {
  document.querySelectorAll('.ppom-link-highlight').forEach(el => {
    el.classList.remove('ppom-link-highlight');
  });
}

function scanAndHighlight() {
  if (!inspectorActive) return;

  // 1. Mark existing highlights as stale
  document.querySelectorAll('.ppom-ad-highlight').forEach(el => {
    el.setAttribute('data-ppom-stale', 'true');
  });

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

  const roots = new Map();
  const elementsArray = allAdElements.map(o => o.el);

  allAdElements.forEach(item => {
    const el = item.el;
    let highest = el;
    let curr = el.parentElement;
    while (curr && curr !== document.body) {
      if (elementsArray.includes(curr)) {
        highest = curr;
      }
      curr = curr.parentElement;
    }

    if (!roots.has(highest)) {
      roots.set(highest, { type: item.type });
    }
    
    if (item.type === 'google') roots.get(highest).type = 'google';
    else if (item.type === 'kakao' && roots.get(highest).type !== 'google') roots.get(highest).type = 'kakao';
    else if (item.type === 'naver' && !['google', 'kakao'].includes(roots.get(highest).type)) roots.get(highest).type = 'naver';

    const label = extractTagName(highest, roots.get(highest).type);
    if (label.includes('/26225854,65120695/PPomppu/ppomppu.co.kr/')) {
      roots.get(highest).type = 'way2g';
    }
  });

  // 2. Update found roots and mark as active (remove stale tag)
  let count = 0;
  roots.forEach((info, el) => {
    const dimensions = `${el.offsetWidth}x${el.offsetHeight}`;
    const name = `${extractTagName(el, info.type)} (${dimensions})`;
    const adId = `${info.type}-${count++}`;
    highlightElement(el, name, info.type, adId);
    el.removeAttribute('data-ppom-stale');
  });

  // 3. Remove highlights that are still stale
  document.querySelectorAll('.ppom-ad-highlight[data-ppom-stale="true"]').forEach(el => {
    el.classList.remove('ppom-ad-highlight', 'ppom-ad-google', 'ppom-ad-kakao', 'ppom-ad-way2g', 'ppom-ad-naver');
    el.removeAttribute('data-ppom-ad-id');
    el.removeAttribute('data-ppom-stale');
    const label = el.querySelector('.ppom-ad-label');
    if (label) label.remove();
  });

  sendStats();
}

function extractTagName(el, type) {
  let name = "";
  const gptSlot = el.getAttribute('data-gpt-slot');
  const adClient = el.getAttribute('data-ad-client');
  const way2gPattern = '/26225854,65120695/PPomppu/ppomppu.co.kr/';

  if (gptSlot) {
    if (gptSlot.includes(way2gPattern)) name = `Way2G (${gptSlot})`;
    else name = gptSlot;
  } else if (adClient) {
    name = `AdSense (${adClient})`;
  }

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

  if (!name && (type === 'kakao' || (el.tagName === 'IFRAME' && (el.src || '').includes('kakao_ad')) || el.classList.contains('kakao_ad_area'))) {
    const adUnit = el.getAttribute('data-ad-unit');
    const adWidth = el.getAttribute('data-ad-width');
    const adHeight = el.getAttribute('data-ad-height');
    
    let sizeStr = '';
    if (adWidth && adHeight) {
      sizeStr = ` ${adWidth}x${adHeight}`;
    } else {
      const src = el.src || '';
      const match = src.match(/kakao_ad_(\d+x\d+)/);
      sizeStr = match ? ` ${match[1]}` : '';
    }

    const unitStr = adUnit ? ` [Unit: ${adUnit}]` : '';
    name = `Kakao AdFit${unitStr}${sizeStr}`;
  }

  if (!name && el.tagName === 'IFRAME' && el.src.includes('google_ad.html')) {
    const src = el.src || '';
    const posMatch = src.match(/pos=([^&]+)/);
    const posStr = posMatch ? ` (pos: ${posMatch[1]})` : '';
    name = `Google Ad Wrapper${posStr}`;
  }

  if (!name && (type === 'naver' || (el.id && el.id.includes('powerlink')) || (el.className && typeof el.className === 'string' && el.className.includes('powerlink')))) {
    name = 'Naver Powerlink';
  }

  const fallbackName = type === 'google' ? `Google Ad (${el.offsetWidth}x${el.offsetHeight})` : `Ad Slot (${el.offsetWidth}x${el.offsetHeight})`;
  let baseName = name || fallbackName;

  // [추가] 미게재 상태 확인 (이벤트/로그로 감지된 경우)
  const slotId = el.id || gptSlot || "unknown_slot";
  const isEmptyConfirmed = emptySlots.has(slotId);

  // Add Fallback Ad Information
  const fallbackInfo = getFallbackInfo(slotId);
  
  if (isEmptyConfirmed) {
    baseName = `[미게재 (Empty)] ${baseName}`;
  }
  
  if (fallbackInfo) {
    baseName += ` [대체: ${fallbackInfo}]`;
  }

  const fullLabelHtml = baseName;
  
  if (type === 'google' || type === 'way2g') {
    const definedSizes = findGoogleDefinedSizes(el);
    if (definedSizes) {
      // GPT 정의 크기를 간결하게 변환 [[300,250],[320,150],[336,280]] → 300x250|320x150|336x280
      const formattedSizes = definedSizes
        .replace(/\[\s*/g, '').replace(/\s*\]/g, '') // 괄호 제거
        .split(',').map((v, i, arr) => {
          if (i % 2 === 0 && i + 1 < arr.length) return arr[i].trim() + 'x' + arr[i + 1].trim();
          return null;
        })
        .filter(v => v).join('|');

      const fullLabelWithSizes = `${fullLabelHtml} [정의: ${formattedSizes} → 실제: ${el.offsetWidth}x${el.offsetHeight}]`;
      return fullLabelWithSizes;
    }
  }

  // 광고가 아닌 요소는 실제 크기만 표시
  const actualSize = `(${el.offsetWidth}x${el.offsetHeight})`;
  return fullLabelHtml.includes('(') ? fullLabelHtml : `${fullLabelHtml} ${actualSize}`;
}

let FALLBACK_CONFIG_MAPPING = {
  'm_view_f': 'w2g-slot3 (WTG)',
  'm_main2_f': '320x100 (Kakao)',
  'm_comment2_f': '320x100 (Iframe)',
  'm_bottom': '300x250 (Kakao)',
  'm_view_bottom_f': '300x250 (Iframe)',
  'list_f': '728x90 (Iframe)',
  'list2_f': '728x90 (Iframe)',
  'view_f': '728x90 (Iframe)',
  'view_bottom_f': '728x90 (Iframe)',
  'main_f': '300x250 (Kakao)',
  'r_banner_f': 'w2g-slot6 (WTG)'
};

// [추가] 슬롯 미게재 상태 저장
const emptySlots = new Set();

// [동적 로드] 페이지의 window에서 실시간 설정 추출
function initializeFallbackConfig() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// 페이지에서 전송한 설정 수신
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.type === 'PPOM_ADMIN_CONFIG') {
    const { type, slotMap, fallbackConfig } = event.data.data;

    if (type === 'slotFallbackMap' && slotMap && fallbackConfig) {
      // 새로운 형식: AD_CONFIG.slotFallbackMap 사용
      FALLBACK_CONFIG_MAPPING = buildFallbackMapping(slotMap, fallbackConfig);
    } else if (type === 'fallbackSlots' && fallbackConfig) {
      // 레거시 형식: FALLBACK_CONFIG만 사용하여 기본 매핑 생성
      FALLBACK_CONFIG_MAPPING = buildDefaultMapping(fallbackConfig);
    }
  } else if (event.data.type === 'PPOM_ADMIN_SLOT_EMPTY') {
    // [추가] 슬롯 미게재 감지 처리
    const slotId = event.data.slotId;
    if (slotId) {
      emptySlots.add(slotId);
      throttledScan();
    }
  }
});

// [유틸] 슬롯 매핑을 기반으로 대체 광고 정보 생성
function buildFallbackMapping(slotMap, fallbackConfig) {
  const mapping = {};

  if (!slotMap || !fallbackConfig) return mapping;

  Object.entries(slotMap).forEach(([slotId, [provider, identifier]]) => {
    const providerConfig = fallbackConfig[provider];
    if (!providerConfig) return;

    const adData = providerConfig[identifier];
    if (!adData) return;

    const sizeInfo = adData.w && adData.h ? `${adData.w}x${adData.h}` : identifier;
    const typeLabel = provider === 'WTG' ? 'WTG' :
                     provider === 'KAKAO' ? 'Kakao' :
                     provider === 'IFRAME' ? 'Iframe' : provider;

    mapping[slotId] = `${sizeInfo} (${typeLabel})`;
  });

  return mapping;
}

// [유틸] 운영 서버 레거시 형식: 하드코딩된 기본 매핑 생성
function buildDefaultMapping(fallbackConfig) {
  // 운영 서버의 실제 슬롯 매핑 (WebFetch로 확인됨)
  const defaultSlotMap = {
    'm_view_f': ['WTG', 'w2g-slot3'],
    'm_main2_f': ['KAKAO', '320x100'],
    'm_comment2_f': ['IFRAME', '320x100'],
    'm_bottom': ['KAKAO', '300x250'],
    'm_view_bottom_f': ['IFRAME', '300x250'],
    'list2_f': ['IFRAME', '728x90'] // User mentioned list2_f_1
  };

  return buildFallbackMapping(defaultSlotMap, fallbackConfig);
}

function formatTimeMMSS() {
  const now = new Date();
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${mm}:${ss}`;
}

function getFallbackInfo(slotId) {
  if (!slotId) return null;
  const matchedKey = Object.keys(FALLBACK_CONFIG_MAPPING).find(key => slotId.includes(key));
  return matchedKey ? FALLBACK_CONFIG_MAPPING[matchedKey] : null;
}

function findGoogleDefinedSizes(el) {
  if (!el.id) return null;
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
  const regex = /googletag\.defineSlot\s*\(\s*['"][^'"]+['"]\s*,\s*([[\]0-9\s,]+)\s*,\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    if (match[2] === targetId) return match[1].trim();
  }
  return null;
}

function highlightElement(el, labelHtml, type, adId) {
  // Update classes only if needed
  if (!el.classList.contains('ppom-ad-highlight')) {
    el.classList.add('ppom-ad-highlight');
  }
  
  const typeClass = `ppom-ad-${type === 'way2g' ? 'way2g' : type}`;
  const currentAdId = el.getAttribute('data-ppom-ad-id');

  // Maintain attributes
  if (currentAdId !== adId) {
    el.setAttribute('data-ppom-ad-id', adId);
  }

  // Handle type specific classes (remove old ones, add new one)
  const providerClasses = ['ppom-ad-google', 'ppom-ad-kakao', 'ppom-ad-way2g', 'ppom-ad-naver'];
  providerClasses.forEach(cls => {
    if (cls === typeClass) {
      if (!el.classList.contains(cls)) el.classList.add(cls);
    } else {
      if (el.classList.contains(cls)) el.classList.remove(cls);
    }
  });
  
  // Create or reuse label element
  let labelEl = el.querySelector('.ppom-ad-label');
  if (!labelEl) {
    labelEl = document.createElement('div');
    labelEl.className = 'ppom-ad-label';
    el.appendChild(labelEl);
  }
  
  // CRITICAL: Update HTML only if content changed to prevent flicker
  if (labelEl.innerHTML !== labelHtml) {
    labelEl.innerHTML = labelHtml;
  }
}

function clearHighlights() {
  document.querySelectorAll('.ppom-ad-highlight').forEach(el => {
    el.classList.remove('ppom-ad-highlight', 'ppom-ad-google', 'ppom-ad-kakao', 'ppom-ad-way2g', 'ppom-ad-naver');
    el.removeAttribute('data-ppom-ad-id');
    const label = el.querySelector('.ppom-ad-label');
    if (label) label.remove();
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

    const labelEl = el.querySelector('.ppom-ad-label');
    const label = labelEl ? labelEl.textContent : '';

    adDetails.push({
      id: el.getAttribute('data-ppom-ad-id'),
      label: label,
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

// --- Abnormal Link Scanner Logic ---

let foundLinks = { abnormal: [], normal: [] };

function scanAllLinks() {
  foundLinks = { abnormal: [], normal: [] };
  const anchors = document.querySelectorAll('a[href]');
  let logicalIndex = 0;
  
  anchors.forEach((a) => {
    const href = a.getAttribute('href') || '';
    const trimmedHref = href.trim();
    
    // Permit absolute links (://) or protocol-relative/escaped absolute links (//, \/)
    const isExternal = trimmedHref.includes('://') || trimmedHref.startsWith('//') || trimmedHref.startsWith('\\/');
    const isInternal = trimmedHref.includes('ppomppu.co.kr');
    
    if (!isExternal || isInternal) return;

    const isAbnormal = /^\s/.test(href) || 
                       /^http:\/\//.test(trimmedHref) || 
                       (/^http:[^\/]/.test(trimmedHref) && !/^https:/.test(trimmedHref));

    const linkData = {
      index: logicalIndex++,
      href: href,
      text: a.innerText.trim() || a.textContent.trim() || '(텍스트 없음)',
      element: a
    };

    if (isAbnormal) {
      foundLinks.abnormal.push(linkData);
    } else {
      foundLinks.normal.push(linkData);
    }
  });
  
  return {
    abnormal: foundLinks.abnormal.map(l => ({ index: l.index, href: l.href, text: l.text })),
    normal: foundLinks.normal.map(l => ({ index: l.index, href: l.href, text: l.text }))
  };
}

function scrollToLink(index) {
  // Search in both groups
  const allLinks = [...foundLinks.abnormal, ...foundLinks.normal];
  const linkObj = allLinks.find(l => l.index === index);
  
  if (linkObj && linkObj.element) {
    const el = linkObj.element;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('http-link-highlight');
    setTimeout(() => {
      el.classList.remove('http-link-highlight');
    }, 3000);
  }
}

// --- Ppomppu Link Decoder Logic ---
let detectedPpomLinks = [];

function decodePpomUrl(url) {
  try {
    if (!url || !url.includes('s.ppomppu.co.kr')) return null;
    const queryString = url.split('?')[1];
    if (!queryString) return null;
    
    const urlParams = new URLSearchParams(queryString);
    let target = urlParams.get('target');
    const encode = urlParams.get('encode');

    if (!target) return null;

    if (encode === 'on') {
      target = target.replace(/ /g, '+');
      let decodedUrl = atob(target);
      decodedUrl = decodedUrl.replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ');
      return decodedUrl.trim();
    } else {
      // If not encoded, it might be a plain URL in target
      return target.trim();
    }
  } catch (e) {}
  return null;
}

function scanPpomppuLinks() {
  const links = document.querySelectorAll('a[href*="s.ppomppu.co.kr"]');
  detectedPpomLinks = [];
  links.forEach((link, index) => {
    const decodedUrl = decodePpomUrl(link.href);
    if (decodedUrl) {
      link.dataset.ppomIndex = index;
      detectedPpomLinks.push({
        index: index,
        text: link.textContent.trim() || '(텍스트 없음)',
        originalUrl: link.href,
        decodedUrl: decodedUrl
      });
    }
  });
  return detectedPpomLinks;
}

function highlightPpomppuLink(index, isHighlight) {
  const link = document.querySelector(`a[data-ppom-index="${index}"]`);
  if (link) {
    if (isHighlight) {
      link.dataset.originalBg = link.style.backgroundColor;
      link.dataset.originalOutline = link.style.outline;
      link.style.backgroundColor = '#ffeb3b80';
      link.style.outline = '2px solid #f44336';
      link.style.borderRadius = '2px';
      link.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      link.style.backgroundColor = link.dataset.originalBg || '';
      link.style.outline = link.dataset.originalOutline || '';
    }
  }
}

// Throttled scan
let scanTimeout = null;
function throttledScan() {
  if (scanTimeout) clearTimeout(scanTimeout);
  scanTimeout = setTimeout(() => {
    // Notify sidepanel that scan is starting
    chrome.runtime.sendMessage({ action: 'scan_started' }).catch(() => {});
    
    // 1. Scan for Ads
    chrome.storage.local.get(['inspectorActive'], (result) => {
      if (result.inspectorActive) scanAndHighlight();
    });
    // 2. Scan for Links (if auto-scan enabled)
    chrome.storage.local.get(['autoScanLinks'], (result) => {
      if (result.autoScanLinks) {
        const data = scanAllLinks();
        chrome.runtime.sendMessage({ action: 'links_detected', ...data }).catch(() => {});
      }
    });
    // 3. Scan for Ppomppu Links (always scan or handle via sidepanel)
    const ppomLinks = scanPpomppuLinks();
    chrome.runtime.sendMessage({ action: 'ppom_links_detected', links: ppomLinks }).catch(() => {});
  }, 500);
}

// Initialization and Observation
// Trigger scan as soon as possible and on multiple events to ensure coverage
throttledScan();
window.addEventListener('load', throttledScan);

const observer = new MutationObserver(throttledScan);
observer.observe(document.body, { childList: true, subtree: true });
