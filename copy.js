console.log("This is a proof that the content script is running!");


// Listens for copy events
document.addEventListener("copy", async (event) => {
    const htmls = await getClipBoardHTML();
    // const plain = await getClipBoardPlainText();
    console.log("-------- the HTMLS Structural version -------");
    console.log(htmls);

    const htmlString = await getClipBoardHTMLString();
    console.log("-------- the HTMLS String version -------");
    console.log(htmlString);

    console.log("-------- the children of the HTML -------");
    console.log(removeAllKatex(htmls))

    // const latexes =  extractLaTex(htmls);
    // const formats = extractFormats(htmls);
    // const formattedLatex = latexFormatter(latexes, formats);
    // insertLatexIntoText(formattedLatex, plain);
    // latexPrinter(formattedLatex);
})


// This function extracts the nested HTML strucutre from the clipBoard
async function getClipBoardHTML() {

    let clipBoardItems = await navigator.clipboard.read();
    let htmlTexts = [];
    for (const item of clipBoardItems) {

        if (item.types.includes("text/html")) {
            const blob = await item.getType("text/html");
            const copiedText = await blob.text();
            // console.log("The copied text in HTML is ", copiedText);

            const parser = new DOMParser();
            const doc = parser.parseFromString(copiedText, "text/html");

            htmlTexts.push(doc.body);
        }
    }

    return htmlTexts[0]
}

// This function extracts the HTML structure in string from the clipboard
async function getClipBoardHTMLString() {
    let clipBoardItems = await navigator.clipboard.read();
    let htmlTexts = [];
    for (const item of clipBoardItems) {

        if (item.types.includes("text/html")) {
            const blob = await item.getType("text/html");
            const copiedText = await blob.text();
            // console.log("The copied text in HTML is ", copiedText);
            htmlTexts.push(copiedText);
        }
    }

    return htmlTexts[0]
}

// THis aims to extract the plain text from the clipboard, used as a helper function
async function getClipBoardPlainText() {
    let clipBoardPlainText = await navigator.clipboard.readText();
    console.log("The copied text in plain is ", clipBoardPlainText)
    return clipBoardPlainText;
}


function traverseHTML (htmlStructure) {
    let textContent = [];


    function dfs (root) {
        const nodes = root.childNodes;
        if (nodes.length === 0) {
            textContent = textContent + [root.textContent];
        }

        const fullTag = root.outerHTML;
        // If the tag contains Katex
        if (getTagKatexContentFromFullTag(fullTag) !== null) {
            for (const node of nodes) {
                dfs(node);
            }
        } else {  // case which it is of Katex tag

            // Need to extract the format 'block' or 'inline'
            // Need to extract the laTex from the textContent
            // Need to format the laTex based on format

        }
    

    }

}

// This matches the Katex Instance:
function getTagKatexContentFromFullTag(fullTag) {
    const regex = /<[^>]*class\s*=\s*"katex[^"]*"[^>]*>/s;
    const match = fullTag.match(regex);
    return match ? match[0] : null;
}


// Extract the latex from textContent
function extractLatex() {
    pass
}


// add $ $ or $$ $$ based on format block or inline
function formatLaTex(laTex, format) {
    if (format === "inline") {
        return "$" + laTex + "$";
    } else if  (format === "inline") {
        return "$$" + laTex + "$$";
    } else {
        throw new Error("Format is not recognized!"); 
    }
}


function retrieveFormatFromKatexTag(katexTag) {
    if (katexTag.includes("katex-display")) {
        return "block";
    } else if (katexTag.includes("katex")) {
        return "inline";
    }
    throw new Error("The tag does not include class 'Katex' or 'Katex-display', format unrecognized!")
}


function removeAllKatex (htmlBody) {
    
    
    for (const child of childNodes) {
        console.log(child.textContent)
    }

}


// This is a helper function that is used as a math separater
function generateUniqueString() {
    return 'xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


// !!!!  Functional Requirements (updated)
// 1. I need a function that loop through the HTML structure and effectively obtains all the textContent, 
// while also determine the positions of the katex, probably a recursive function

// 2. A function that recognizes the latex version from the katex math content

// 3. A function that recognizes the inline or block display and modify the katex textContent with $ $, or $$ $$

// 4. A function that modifies the clipBoard



// !!!! UI requirements:
// We need a top layer UI that pops up when the user first launch the chrome extension.
// Ideally we also need some kind of interactive UI on the side that is collapsible.

// !!!! Additional Considerations:
// auto-launch.
// Cache.
// Auto math equation detection from the page.