(function() {
  // [공통] 메시지 전송 유틸리티
  function postToContentScript(type, data) {
    window.postMessage({
      type: type,
      ...data
    }, '*');
  }

  // 1. AD_CONFIG 및 FALLBACK_CONFIG 추출
  if (window.AD_CONFIG && window.AD_CONFIG.slotFallbackMap && window.FALLBACK_CONFIG) {
    postToContentScript('PPOM_ADMIN_CONFIG', {
      type: 'slotFallbackMap',
      slotMap: window.AD_CONFIG.slotFallbackMap,
      fallbackConfig: window.FALLBACK_CONFIG
    });
  } else if (window.displayFallbackAd && window.FALLBACK_CONFIG) {
    postToContentScript('PPOM_ADMIN_CONFIG', {
      type: 'fallbackSlots',
      fallbackConfig: window.FALLBACK_CONFIG
    });
  }

  // 2. console.log 인터셉트
  const originalLog = window.console.log;
  window.console.log = function() {
    originalLog.apply(window.console, arguments);
    
    const args = Array.from(arguments);
    const msg = args.join(' ');
    
    if (msg.includes('광고 미게재 (Empty)')) {
      // 1. 전체 메시지를 합쳐서 ID 추출 시도 (가장 일반적인 경우: 광고 미게재 (Empty): m_view_f_1)
      const parts = msg.split('광고 미게재 (Empty):');
      let slotId = '';
      if (parts.length > 1) {
        // 뒤에 오는 부분을 추출하되, 공백이나 특수문자(%c 등)가 오기 전까지만 사용
        slotId = parts[1].trim().split(' ')[0]; 
      }
      
      // 2. 만약 1번에서 못 찾았거나, 인자가 분리된 경우 (예: console.log('...Empty:', id))
      if (!slotId || slotId.includes('%')) {
        for (let i = 0; i < args.length; i++) {
          const arg = String(args[i]);
          if (arg.includes('광고 미게재 (Empty)')) {
            if (arg.includes(':') && arg.split(':')[1].trim()) {
              slotId = arg.split(':')[1].trim().split(' ')[0];
            } else if (i + 1 < args.length) {
              slotId = String(args[i+1]).trim().split(' ')[0];
            }
            break;
          }
        }
      }
      
      if (slotId) {
        postToContentScript('PPOM_ADMIN_SLOT_EMPTY', {
          slotId: slotId
        });
      }
    } else if (msg.includes('Ad Injected:')) {
      // 1. 공급자(Provider) 추출 시도
      let provider = '대체';
      if (msg.includes('Kakao Ad')) provider = 'Kakao';
      else if (msg.includes('WTG Ad')) provider = 'WTG';
      else if (msg.includes('Google Ad')) provider = 'Google';
      else if (msg.includes('string Ad')) provider = 'Iframe';

      const parts = msg.split('Ad Injected:');
      if (parts.length > 1) {
        const info = parts[1].trim();
        // ID[내용] 형태에서 ID와 내용 분리 시도
        const idMatch = info.match(/^([^\[]+)\[(.+)\]/);
        if (idMatch) {
          const slotId = idMatch[1].trim();
          const detail = idMatch[2].trim();
          
          // 핵심 정보만 추출 (예: iframe 크기 등)
          let coreInfo = provider;
          if (detail.includes('iframe') && detail.includes('320x100')) coreInfo += ' (320x100)';
          else if (detail.includes('iframe') && detail.includes('300x250')) coreInfo += ' (300x250)';
          else if (detail.includes('iframe') && detail.includes('728x90')) coreInfo += ' (728x90)';
          
          postToContentScript('PPOM_ADMIN_AD_INJECTED', {
            slotId: slotId,
            adDetail: coreInfo
          });
        } else {
          postToContentScript('PPOM_ADMIN_AD_INJECTED', {
            slotId: 'unknown',
            adDetail: provider
          });
        }
      }
    }
  };
})();
