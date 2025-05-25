let extensionEnabled = false;

chrome.runtime.onInstalled.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
});


// Outdated Code: Rather than performing checks on active tabs, we inject script every time user changes active tabs
// chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
//     if (tabs.length === 0) {
//         console.warn('No active tab found.');
//         return;
//     }

//     const tabId = tabs[0].id;

//     chrome.tabs.sendMessage(tabId, { type: 'ping' }, response => {
//         if (chrome.runtime.lastError) {
//             console.warn('Content script missing, injecting.');
//             injectContentScript(tabId);
//         } else {
//             console.log('Content script alive, proceeding.');
//             // chrome.tabs.sendMessage(tabId, { type: 'setup' });
//         }
//     });
// });


chrome.tabs.onActivated.addListener((activeTab)=> {
    chrome.tabs.get(activeTab.tabId, tab => {
        if (isInjectableUrl(tab.url)) {
            injectContentScript(tab.id);
            console.log("Injection Successful on new active Tab!")
        }
    });
})

chrome.webNavigation.onCompleted.addListener(details => {
    chrome.tabs.get(details.tabId, tab => {
        if (isInjectableUrl(tab.url)) {
            injectContentScript(tab.id);
            console.log("Injection Successful on a newly navigated page")
        }
    });
});

function isInjectableUrl(url) {
    if (!url) return false;
    return url.startsWith('http://') || url.startsWith('https://');
} 


function injectContentScript(tabId) {
    chrome.scripting.executeScript({
        target: { tabId },
        files: ['copy.js']
    }).then(() => {
        console.log('Injected content script into tab', tabId);
        // chrome.tabs.sendMessage(tabId, { type: 'setup' });
    }).catch(err => {
        console.error('Failed to inject content script:', err);
    });
}
  

chrome.commands.onCommand.addListener((command)=> {
    if (command === "toggle-math-paste") {
        extensionEnabled = !extensionEnabled;
        console.log("Math paste is " + extensionEnabled ? "enabled" : "disabled");

        chrome.tabs.query({active:true, currentWindow:true}, (tabs)=>{
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {toggle: extensionEnabled});
            }
        });
    }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "functionChange") {
        chrome.tabs.query({active:true, currentWindow:true}, (tabs)=>{
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {imgId: message.imgId});
            }
        });
    }
})