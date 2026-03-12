# 뽐링크 탭 고도화 계획

`test/ppom_link`의 로직을 기반으로 기존 '뽐링크' 탭의 기능을 강화합니다. 감지된 뽐뿌 링크를 디코딩하여 리스트로 보여주고, 사용자가 쉽게 링크를 복사하거나 바로 열 수 있는 기능을 추가합니다.

## 주요 변경 사항

### [content_script.js](file:///c:/rnd/claude/chrome_extensions/ppom_admin/content_script.js)
- `scanPpomppuLinks` 함수를 최적화하여 `test/ppom_link/content.js`와 동일한 데이터 구조를 반환하도록 합니다.
- 하이라이트 기능의 시각적 효과를 `test/ppom_link`와 동기화합니다.

### [sidepanel.js](file:///c:/rnd/claude/chrome_extensions/ppom_admin/sidepanel.js)
- `updatePpomUI` 함수를 개선하여 뽐링크 카드마다 '복사' 및 '열기' 버튼을 추가합니다.
- 복사 성공 시 버튼 텍스트를 `✓`로 변경하는 등의 피드백 효과를 반영합니다.
- 링크 클릭 시 해당 위치로 스크롤하거나 새 탭에서 열 수 있도록 인터랙션을 보강합니다.

## 검증 계획

### 수동 검증
- 뽐뿌 게시글 페이지에 접속합니다.
- '뽐링크' 탭에서 감지된 링크 리스트가 정상적으로 표시되는지 확인합니다.
- 각 링크의 '복사' 버튼이 클립보드에 디코딩된 URL을 제대로 복사하는지 확인합니다.
- '열기' 버튼이 디코딩된 URL을 새 창에서 여는지 확인합니다.
- 목록 항목에 마우스를 올렸을 때 본문의 해당 링크가 하이라이트되는지 확인합니다.
