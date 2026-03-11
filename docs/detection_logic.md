# Ppomppu Ad Detection Logic (기술 명세)

본 문서는 익스텐션에서 지원하는 각 광고 플랫폼별 감지 로직 및 시각화 규칙을 상세히 기술합니다.

## 1. 광고 플랫폼별 감지 규칙

| 플랫폼 | 감지 조건 (Selectors/Patterns) | 하이라이트 색상 |
| :--- | :--- | :--- |
| **Google Ads** | GPT (`div[data-gpt-slot]`, `ins.adsbygoogle`), AdSense 등 | 파란색 (#4285f4) |
| **Kakao AdFit** | `iframe[src*="kakao_ad"]`, `*.ppomppu.co.kr/banner/kakao_ad` | 노란색 (#ffcc00) |
| **Way2G** | GPT 패턴 `/26225854,65120695/PPomppu/ppomppu.co.kr/` 매칭 시 | 보라색 (#a55eea) |
| **Naver Powerlink**| ID/Class에 `powerlink` 키워드 포함 요소 | 초록색 (#2db400) |
| **Google Wrapper**| `iframe[src*="google_ad.html"]` | 파란색 (#4285f4) |
| **기타 (Other)** | `_f_`, `ad-container`, `ad_area` 등 일반 광고 슬롯 | 빨간색 (#ff4757) |

## 2. 상세 데이터 추출 로직

### 2.1. Kakao AdFit 사이즈 추출
카카오 광고 iframe의 `src` 주소에서 정규식을 통해 사이즈 정보를 추출합니다.
- **패턴**: `kakao_ad_(\d+x\d+)`
- **결과**: `Kakao AdFit 320x100` 등

### 2.2. Way2G 분류 우선순위
GPT(Google Publisher Tag)를 사용하더라도 특정 경로가 포함된 경우 Way2G로 우선 분류합니다.
- **우선순위 경로**: `/26225854,65120695/PPomppu/ppomppu.co.kr/`

### 2.3. Google Ad Wrapper 포지션 추출
`google_ad.html` 래퍼 내의 `pos` 파라미터를 파싱하여 광고 위치 식별자를 노출합니다.
- **파라미터**: `pos=([^&]+)`
- **결과**: `Google Ad Wrapper (pos: 2005)` 등

## 3. 시각화 및 상호작용
- **하이라이트**: 각 요소에 `outline`과 플랫폼별 배경색이 적용된 라벨(`::after`)을 삽입합니다.
- **실시간 감시**: `MutationObserver`를 통해 DOM의 변화를 실시간으로 추적하여 새로운 광고가 로드될 때 즉시 반영합니다.
- **사이드바 동기화**: `chrome.runtime.sendMessage`를 통해 감지된 통계 정보를 사이드바 대시보드와 리스트에 전송합니다.
