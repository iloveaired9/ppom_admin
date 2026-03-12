chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Detect side panel closure using port connection
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    console.log('Side panel connected');
    
    port.onDisconnect.addListener(() => {
      console.log('Side panel closed, turning off inspector');
      
      // 1. Update storage state
      chrome.storage.local.set({ inspectorActive: false });

      // 2. Notify all Ppomppu tabs to clear highlights
      chrome.tabs.query({ url: "*://*.ppomppu.co.kr/*" }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { 
            type: 'CLEAR_ALL_HIGHLIGHTS'
          }).catch(() => {});
        });
      });
    });
  }
});
