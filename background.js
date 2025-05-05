let extensionEnabled = false;

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