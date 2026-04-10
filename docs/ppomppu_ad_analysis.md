# 뽐뿌(ppomppu.co.kr) 배너광고 처리 흐름 분석

**작성일**: 2026-04-10  
**목적**: 크롬 익스텐션 개발을 위한 광고 처리 메커니즘 분석 문서

---

## 1. 배너광고 구조 분석

### 1.1 주요 광고 슬롯 (Ad Slots)

#### 우측 배너 (r_banner_f)
```html
<div class="ad-banner" id="pp_ban_right">
  <script>
    googletag.cmd.push(function() {
      googletag.defineSlot('/65120695/r_banner_f', [[200, 600], [160, 600]], 'r_banner_f_1')
        .addService(googletag.pubads());
    });
  </script>
</div>

<!-- GPT 광고 렌더링 영역 -->
<div class="JS-div_gpt_ad js-ad_slot" id="r_banner_f_1"></div>

<!-- Google SafeFrame 컨테이너 -->
<div id="google_ads_iframe_/65120695/r_banner_f_0__container__">
  <iframe frameborder="0" src="https://28295e4734e232e5b71aa4fb6c1364a7.safeframe.googlesyndication.com/...">
  </iframe>
</div>
```

**슬롯 정보:**
- **경로**: `/65120695/r_banner_f`
- **크기**: 200x600px, 160x600px (반응형)
- **타입**: 우측 레일 배너
- **ID**: `r_banner_f_1`
- **컨테이너**: `google_ads_iframe_/65120695/r_banner_f_0__container__`

---

#### 메인 광고 (main_f)
```html
<div class="ad-banner middle-banner">
  <script>
    googletag.cmd.push(function() {
      googletag.defineSlot('/65120695/main_f', [336, 280], 'main_f_1')
        .addService(googletag.pubads());
    });
  </script>
</div>

<!-- GPT 광고 렌더링 영역 -->
<div class="JS-div_gpt_ad js-ad_slot ad-flex-center" id="main_f_1"></div>

<!-- Google SafeFrame 컨테이너 -->
<div id="google_ads_iframe_/65120695/main_f_0__container__">
  <iframe frameborder="0" src="https://28295e4734e232e5b71aa4fb6c1364a7.safeframe.googlesyndication.com/...">
  </iframe>
</div>
```

**슬롯 정보:**
- **경로**: `/65120695/main_f`
- **크기**: 336x280px
- **타입**: 메인 컨텐츠 영역 광고
- **ID**: `main_f_1`
- **컨테이너**: `google_ads_iframe_/65120695/main_f_0__container__`

---

### 1.2 CSS 클래스 분류

| 클래스명 | 용도 | 설명 |
|---------|------|------|
| `ad-banner` | 광고 컨테이너 | 광고 섹션 래퍼 |
| `JS-div_gpt_ad` | Google GPT 마커 | Google 광고 렌더링 대상 |
| `js-ad_slot` | JavaScript 선택자 | ad_slot 처리용 클래스 |
| `ad-flex-center` | 레이아웃 | Flexbox 중앙 정렬 |
| `floating-banner` | 플로팅 광고 | 화면 고정 배너 |
| `w2g-slot` | 대체광고 | 카카오 W2G 광고 슬롯 |

---

## 2. 광고 로드 흐름 분석

### 2.1 Google GPT (Google Publisher Tag) 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                  페이지 로드 (load)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
    ┌─────────────────────────────────┐
    │  gpt.js (Google 라이브러리)      │
    │  로드 완료                       │
    └─────────────────┬───────────────┘
                      │
                      ▼
      ┌──────────────────────────────────────┐
      │  googletag.defineSlot()              │
      │  - /65120695/r_banner_f              │
      │  - /65120695/main_f 정의             │
      └──────────────────┬───────────────────┘
                         │
                         ▼
         ┌─────────────────────────────────────┐
         │  googletag.pubads()                 │
         │  퍼블리셔 광고 서비스 활성화         │
         └──────────────────┬──────────────────┘
                            │
                            ▼
            ┌─────────────────────────────────┐
            │  googletag.enableServices()      │
            │  (자동 또는 명시적 호출)         │
            └──────────────────┬──────────────┘
                               │
                               ▼
              ┌──────────────────────────────┐
              │  Google Ads 서버 요청         │
              │  /ads/gpt.js → 광고 데이터   │
              └──────────────────┬───────────┘
                                 │
                                 ▼
                  ┌────────────────────────────┐
                  │  SafeFrame 렌더링           │
                  │  (iFrame 기반 격리)        │
                  └────────────────────────────┘
```

---

### 2.2 Javascript 로드 시퀀스

| 순서 | 스크립트 파일 | URL | 역할 |
|------|--------------|-----|------|
| 1 | gpt.js | `https://securepubads.g.doubleclick.net/tag/js/gpt.js` | Google Publisher Tag 라이브러리 |
| 2 | pubads_impl.js | `https://securepubads.g.doubleclick.net/pagead/.../pubads_impl.js` | GPT 퍼블리셔 구현 |
| 3 | adsbygoogle.js | `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js` | Google AdSense 초기화 |
| 4 | default3.js | `https://cdn2.ppomppu.co.kr/js/default3.js` | 사이트 기본 설정 |
| 5 | **slot_handler.js** | `https://www.ppomppu.co.kr/js/slot_handler.js` | **광고 슬롯 처리 & 대체광고** |
| 6 | **wtg_ads.js** | `https://cdn2.ppomppu.co.kr/js/wtg_ads.js` | **카카오 W2G 광고 처리** |
| 7 | main.js | `https://www.ppomppu.co.kr/js/main.js` | 메인 사이트 로직 |
| 8 | common.js | `https://www.ppomppu.co.kr/js/common.js` | 공통 유틸리티 |

---

## 3. 대체광고 처리 메커니즘 (slot_handler.js 분석)

### 3.1 광고 처리 흐름도

```
┌──────────────────────────────────────────────────────────────┐
│            Google AdSense/GPT 광고 로드 시작                  │
└──────────────────────┬───────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
   ┌─────────────┐          ┌─────────────────┐
   │  성공 (✓)   │          │  실패/차단 (✗)  │
   │             │          │  또는 광고 없음  │
   └──────┬──────┘          └────────┬────────┘
          │                          │
          │                          ▼
          │              ┌──────────────────────────┐
          │              │  slot_handler.js 감지    │
          │              │  광고 로드 실패           │
          │              └────────────┬─────────────┘
          │                           │
          │              ┌────────────▼─────────────┐
          │              │  w2g-slot 찾기           │
          │              │  (카카오 대체광고 슬롯)  │
          │              └────────────┬─────────────┘
          │                           │
          │              ┌────────────▼─────────────┐
          │              │  wtg_ads.js 실행         │
          │              │  카카오 광고 로드         │
          │              └────────────┬─────────────┘
          │                           │
          └───────────────┬───────────┘
                          │
                          ▼
                ┌─────────────────────┐
                │  광고 렌더링 완료    │
                └─────────────────────┘
```

---

### 3.2 대체광고 슬롯 정보

#### Way2Grow (W2G) 슬롯
```html
<div class="ad-flex-center">
  <div class="w2g-slot" 
       data-domain="ppomppu.co.kr" 
       data-slot="w2g-slot4">
  </div>
</div>
```

**Way2Grow (W2G) 슬롯 특징:**
- **슬롯ID**: `w2g-slot4`
- **도메인**: `ppomppu.co.kr`
- **클래스**: `w2g-slot`
- **부모**: `ad-flex-center`
- **처리 스크립트**: `wtg_ads.js`
- **플랫폼**: **카카오 Way2Grow 광고 플랫폼**
- **용도**: Google 광고 로드 실패 시 자동 대체광고

**Way2Grow (W2G) 정보:**
- **회사**: 카카오 (Kakao Corporation)
- **설명**: 카카오의 네이티브 광고 솔루션
- **특징**: 구글 광고 실패 시 백업 광고로 사용
- **로드 메커니즘**: wtg_ads.js 스크립트로 동적 광고 주입

---

### 3.3 slot_handler.js 주요 기능 (추정)

**역할**: Google GPT 광고 로드 상태 모니터링 및 Way2Grow 대체광고 자동 로드

```javascript
// 예상되는 slot_handler.js 로직 구조

// 1. Google GPT 슬롯 정의
window.googletag.cmd.push(function() {
  // Google AdManager 광고 슬롯 등록
  googletag.defineSlot('/65120695/r_banner_f', [[200, 600], [160, 600]], 'r_banner_f_1')
    .addService(googletag.pubads());
  
  googletag.defineSlot('/65120695/main_f', [336, 280], 'main_f_1')
    .addService(googletag.pubads());
});

// 2. Google 광고 렌더링 완료 이벤트 감시
googletag.pubads().addEventListener('slotRenderEnded', function(event) {
  const isEmpty = event.isEmpty;           // 광고 없음 여부
  const slotPath = event.slot.getAdUnitPath(); // 슬롯 경로
  
  console.log('Google 광고 렌더링:', {
    isEmpty: isEmpty,
    slotPath: slotPath
  });
  
  if (isEmpty || !event.size) {
    // 3. Google 광고 실패 → Way2Grow 대체광고 로드
    triggerWay2GrowAd(slotPath);
  }
});

// 3. Way2Grow (카카오) 대체광고 로드 함수
function triggerWay2GrowAd(googleSlotPath) {
  // 해당하는 w2g-slot 찾기
  const w2gSlots = document.querySelectorAll('.w2g-slot');
  
  w2gSlots.forEach(slot => {
    // 4. wtg_ads.js 실행 (Way2Grow 광고 주입)
    if (window.wtg_ads && window.wtg_ads.load) {
      window.wtg_ads.load(slot);
    }
  });
}

// 5. Way2Grow 광고 로드 완료 콜백
if (window.way2GrowCallback) {
  window.way2GrowCallback = function(adData) {
    console.log('Way2Grow 광고 로드 완료:', adData);
  };
}
```

**slot_handler.js 처리 흐름:**
1. Google GPT 슬롯 정의 및 등록
2. `slotRenderEnded` 이벤트 감시
3. 광고 비어있음(isEmpty) 감지 시 Way2Grow 호출
4. wtg_ads.js 스크립트 실행
5. Way2Grow 광고 렌더링

---

## 4. 크롬 익스텐션 개발 가이드

### 4.1 광고 탐지 포인트

#### 1️⃣ HTML DOM 기반 탐지
```javascript
// 배너광고 div 탐지 (옵션 1: 클래스명)
document.querySelectorAll('.JS-div_gpt_ad')     // Google GPT 광고
document.querySelectorAll('.w2g-slot')          // 카카오 대체광고
document.querySelectorAll('[id*="google_ads"]') // Google 광고 iframe

// 배너광고 div 탐지 (옵션 2: ID)
document.getElementById('r_banner_f_1')   // 우측 배너
document.getElementById('main_f_1')       // 메인 광고
document.querySelector('[data-slot^="w2g"]') // 카카오 슬롯
```

#### 2️⃣ 광고 경로 탐지
```javascript
// Google AdManager 경로 패턴
'/65120695/r_banner_f'     // 우측 배너
'/65120695/main_f'        // 메인 광고

// SafeFrame iframe 탐지
document.querySelectorAll('iframe[src*="safeframe.googlesyndication.com"]')
```

#### 3️⃣ 광고 이벤트 감시
```javascript
// Google GPT 슬롯 렌더링 이벤트
if (window.googletag && window.googletag.pubads) {
  googletag.pubads().addEventListener('slotRenderEnded', (event) => {
    console.log('광고 렌더링:', {
      slot: event.slot.getAdUnitPath(),
      isEmpty: event.isEmpty,
      size: event.size
    });
  });
}
```

---

### 4.2 블로킹 전략 (Chrome Extension Content Script)

```javascript
// manifest.json
{
  "content_scripts": [
    {
      "matches": ["https://www.ppomppu.co.kr/*"],
      "js": ["content.js"],
      "run_at": "document_start"  // HTML 파싱 전 실행
    }
  ]
}

// content.js - 광고 블로킹 로직 (Way2Grow 포함)
(function() {
  // 1. slot_handler.js의 Way2Grow 트리거 차단
  const blockWay2GrowTrigger = () => {
    // googletag.pubads() 이벤트 리스너 오버라이드
    if (window.googletag && window.googletag.pubads) {
      const origAddEventListener = window.googletag.pubads().addEventListener;
      window.googletag.pubads().addEventListener = function(event, callback) {
        // slotRenderEnded 이벤트 차단 (Way2Grow 트리거 방지)
        if (event === 'slotRenderEnded') {
          console.log('[Ad Blocker] Google slotRenderEnded 이벤트 차단');
          return;
        }
        return origAddEventListener.call(this, event, callback);
      };
    }
  };

  // 2. Google GPT 광고 제거
  const removeGoogleAds = () => {
    // Google 광고 div 제거
    document.querySelectorAll('.JS-div_gpt_ad').forEach(ad => {
      ad.style.display = 'none';
      ad.remove();
    });
    
    // SafeFrame iframe 제거
    document.querySelectorAll('iframe[src*="safeframe.googlesyndication.com"]').forEach(iframe => {
      iframe.remove();
    });
    
    // Google 광고 컨테이너 제거
    document.querySelectorAll('[id*="google_ads_iframe"]').forEach(container => {
      container.remove();
    });
  };

  // 3. Way2Grow (카카오) 대체광고 제거
  const removeWay2GrowAds = () => {
    // w2g-slot 제거
    document.querySelectorAll('.w2g-slot').forEach(ad => {
      ad.remove();
    });
    
    // Way2Grow 스크립트 차단
    if (window.wtg_ads) {
      window.wtg_ads = null;
    }
  };

  // 4. 플로팅 배너 제거
  const removeFloatingBanners = () => {
    document.querySelectorAll('.floating-banner, .floating-banner-sm').forEach(ad => {
      ad.remove();
    });
  };

  // 5. 초기 실행
  if (document.readyState === 'loading') {
    // HTML 파싱 전에 실행
    blockWay2GrowTrigger();
    document.addEventListener('DOMContentLoaded', () => {
      removeGoogleAds();
      removeWay2GrowAds();
      removeFloatingBanners();
    });
  } else {
    // 이미 로드된 경우
    blockWay2GrowTrigger();
    removeGoogleAds();
    removeWay2GrowAds();
    removeFloatingBanners();
  }

  // 6. 동적 로드된 광고 감시 (MutationObserver)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // 새로 추가된 노드 확인
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            // Google 광고 확인
            if (node.classList.contains('JS-div_gpt_ad') || 
                node.id.includes('google_ads')) {
              node.remove();
            }
            // Way2Grow 광고 확인
            if (node.classList.contains('w2g-slot')) {
              node.remove();
            }
            // 플로팅 배너 확인
            if (node.classList.contains('floating-banner')) {
              node.remove();
            }
            // 재귀적으로 자식 노드 확인
            node.querySelectorAll('.JS-div_gpt_ad, .w2g-slot, .floating-banner').forEach(ad => {
              ad.remove();
            });
          }
        });
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();
```

---

### 4.3 광고 처리 우선순위

```
1단계: Google GPT 광고 탐지 및 제거 (즉시)
   └─ 대상: #r_banner_f_1, #main_f_1, [id*="google_ads"]
   └─ 메커니즘: DOM 제거, SafeFrame iframe 제거
   └─ 중요도: ⭐⭐⭐ (Primary Ads)

2단계: slot_handler.js 이벤트 리스너 차단 (옵션)
   └─ 대상: googletag.pubads().addEventListener() 오버라이드
   └─ 메커니즘: Way2Grow 트리거 방지
   └─ 중요도: ⭐⭐ (선택사항)

3단계: Way2Grow 대체광고 탐지 및 제거 (동적)
   └─ 대상: .w2g-slot, [data-slot^="w2g"]
   └─ 메커니즘: DOM 제거, wtg_ads.js 스크립트 차단
   └─ 중요도: ⭐⭐⭐ (Fallback Ads)

4단계: 플로팅 배너 제거
   └─ 대상: .floating-banner, .floating-banner-sm
   └─ 메커니즘: DOM 제거
   └─ 중요도: ⭐⭐

5단계: 동적 광고 감시 (MutationObserver)
   └─ 메커니즘: 실시간 DOM 변경 감시 및 제거
   └─ 중요도: ⭐⭐⭐ (필수)
```

**처리 순서 설명:**
- **1단계**: Google 광고 먼저 제거 (DOM 파싱 단계)
- **2단계** (선택): slot_handler.js의 이벤트 리스너를 오버라이드하여 Way2Grow 자동 로드 방지
- **3단계**: Way2Grow 광고도 제거 (Google 광고 실패 대비)
- **4-5단계**: 동적 로드된 광고 감시

---

## 5. 주요 파일 요약

### 5.1 외부 라이브러리

| 파일 | 출처 | 기능 |
|------|------|------|
| `gpt.js` | Google DoubleClick | Google Publisher Tag 라이브러리 |
| `adsbygoogle.js` | Google | AdSense 초기화 |
| `pubads_impl.js` | Google DoubleClick | GPT 퍼블리셔 구현 |

### 5.2 사이트 자체 스크립트

| 파일 | 용도 | 중요도 |
|------|------|--------|
| `default3.js` | 기본 설정 | ⭐ |
| `slot_handler.js` | **Google GPT 광고 모니터링 & Way2Grow 대체광고 트리거** | ⭐⭐⭐ |
| `wtg_ads.js` | **Way2Grow 광고 로드 및 렌더링** | ⭐⭐⭐ |
| `main.js` | 메인 로직 | ⭐⭐ |
| `common.js` | 공통 유틸리티 | ⭐ |

---

## 6. 광고 차단 감지 메커니즘

### 6.1 사이트가 광고 차단을 감지하는 방법

```javascript
// 예상: slot_handler.js 내부 로직
const checkAdBlocker = () => {
  // 방법 1: 광고 div가 숨겨졌는지 확인
  const r_banner = document.getElementById('r_banner_f_1');
  if (r_banner && r_banner.offsetHeight === 0) {
    console.log('광고 차단 감지됨');
  }

  // 방법 2: Google 광고 요청 차단 여부
  if (!window.googletag || !window.googletag.pubads) {
    console.log('Google 광고 로드 실패');
  }

  // 방법 3: SafeFrame iframe이 로드되지 않음
  const iframes = document.querySelectorAll('iframe[src*="safeframe"]');
  if (iframes.length === 0) {
    console.log('광고 iframe 로드 실패');
  }
};
```

### 6.2 권장사항

✅ **피해야 할 것:**
- `display: none` 설정 (감지됨)
- `visibility: hidden` 설정 (감지됨)
- 직접 DOM 제거 후 CSS 수정 (감지 가능)

✅ **추천하는 방법:**
- Content Script에서 초기 로드 전 제거 (`run_at: "document_start"`)
- MutationObserver로 실시간 감시
- 광고 요청 자체를 차단 (Network Request 차단)

---

## 7. 테스트 체크리스트

```
✓ Google GPT 광고 (r_banner_f, main_f) 제거 확인
✓ 카카오 W2G 대체광고 제거 확인
✓ SafeFrame iframe 제거 확인
✓ 플로팅 배너 제거 확인
✓ 동적 로드 광고 제거 (새로고침 후 확인)
✓ 콘솔 에러 없음 확인
✓ 페이지 기능 정상 작동 확인
✓ 다크모드 등 사이트 기능 작동 확인
```

---

## 8. 참고사항

### 8.1 광고 식별자 정규식

```javascript
// Google 광고 경로
const googleAdPattern = /\/65120695\/(r_banner_f|main_f)/;

// Google SafeFrame iframe
const safeframePattern = /safeframe\.googlesyndication\.com/;

// 카카오 W2G 슬롯
const w2gPattern = /w2g-slot/;

// 테스트
const adPath = '/65120695/r_banner_f';
console.log(googleAdPattern.test(adPath)); // true
```

### 8.2 개발 팁

```javascript
// 콘솔에서 광고 상태 확인
console.log('Google 광고:', document.querySelectorAll('.JS-div_gpt_ad'));
console.log('Way2Grow 광고:', document.querySelectorAll('.w2g-slot'));
console.log('SafeFrame:', document.querySelectorAll('iframe[src*="safeframe"]'));

// Google 광고 상태 확인
console.log('GoogleTag 상태:', window.googletag ? '로드됨' : '미로드');
console.log('Way2Grow 상태:', window.wtg_ads ? '로드됨' : '미로드');

// 광고 크기 확인
document.querySelectorAll('.JS-div_gpt_ad').forEach(ad => {
  console.log(ad.id, ':', ad.offsetWidth, 'x', ad.offsetHeight);
});

// slot_handler.js 이벤트 감시
if (window.googletag && window.googletag.pubads) {
  googletag.pubads().addEventListener('slotRenderEnded', (event) => {
    console.log('Google 슬롯 렌더링:', {
      slotPath: event.slot.getAdUnitPath(),
      isEmpty: event.isEmpty,
      size: event.size,
      creativeId: event.creativeId
    });
  });
}

// Way2Grow 로드 감시
console.log('wtg_ads.js 로드:', !!window.wtg_ads);
if (window.wtg_ads) {
  console.log('Way2Grow 함수들:', Object.keys(window.wtg_ads));
}
```

### 8.3 Way2Grow (카카오) 정보

**Way2Grow란:**
- Kakao의 광고 플랫폼
- Google AdSense 광고 로드 실패 시 백업 광고로 작동
- Native Ad 형태의 광고 제공
- w2g-slot 클래스로 식별
- wtg_ads.js 스크립트로 동작

**주의사항:**
- slot_handler.js가 `slotRenderEnded` 이벤트를 감시하여 자동으로 Way2Grow 로드
- Google 광고를 제거하면 자동으로 Way2Grow가 로드될 수 있음
- Content Script의 `run_at: "document_start"` 설정으로 먼저 실행 필요
- slot_handler.js의 이벤트 리스너를 오버라이드하면 Way2Grow 자동 로드 방지 가능

---

**마지막 업데이트**: 2026-04-10 (Way2Grow 정보 추가)  
**작성자**: Claude AI  
**상태**: Way2Grow 정보 포함 완료  
**특이사항**: 
- Google GPT → Way2Grow 자동 대체광고 시스템 확인됨
- slot_handler.js가 slotRenderEnded 이벤트로 Way2Grow 자동 로드
- wtg_ads.js (Way2Grow 전용 스크립트) 확인됨