console.log("This is a proof that the content script is running!");


// Listens for copy events
document.addEventListener("copy", async (event) => {
    getClipBoardHTML();
    // getClipBoardPlainText();
})

async function getClipBoardHTML() {

    let clipBoardItems = await navigator.clipboard.read();
    for (const item of clipBoardItems) {

        if (item.types.includes("text/html")) {
            const blob = await item.getType("text/html");
            const copiedText = await blob.text();
            console.log("The copied text in HTML is ", copiedText);
        }
    }
}

async function getClipBoardPlainText() {
    let clipBoardPlainText = await navigator.clipboard.readText();
    console.log("The copied text in plain is ", clipBoardPlainText)
}

// !!!!  Functional Requirements
// 1. A function that extracts the LaTex math from the annotation tags
// 2. A function that matches each latex to its plain text location
// 3. A function that processes the latex math
// 4. A function that concatenates the latex with the rest of the plain text


// !!!! UI requirements:
// We need a top layer UI that pops up when the user first launch the chrome extension.
// Ideally we also need some kind of interactive UI on the side that is collapsible

// !!!! Additional Considerations:
// auto-launch.
// Cache.
// Auto math equation detection from the page.