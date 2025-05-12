// console.log("This is a proof that the content script is running!");

const optionToFunction = {
    "math_paste_Obsidian": traverseHTMLWrapped,
    "math_paste_Notion": traverseHTMLWrapped,
    "math_paste_LaTex": traverseHTMLLatex,
    "math_paste_None": null
}

let isActive = false;
let listener = null;
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.imgId !== undefined) {
        // console.log("imagId listner gets triggered")
        if (isActive) {
            document.removeEventListener("copy", listener)
            // console.log("----------- imgID------------", message.imgId)
            listener = (event)=> setUpMathPaste(message.imgId);
            document.addEventListener("copy", listener);
        }
    }

    // console.log("Copy.js is listening");
    if (message.toggle !== undefined) {
        // console.log("toggle message received")
        isActive = message.toggle;
        listener = () => setUpMathPaste(null);
        if (isActive) {
            document.addEventListener("copy", listener);
        } else {
            document.removeEventListener("copy", listener);
        }
    }

})

async function setUpMathPaste(imgId) {
    const htmls = await getClipBoardHTML();
        // console.log("-------- the HTMLS Structural version -------");
        // console.log(htmls);

        const plain = await getClipBoardPlainText();

        const func = optionToFunction[imgId];
        if (func) {
            const newClipboardContent = func(htmls);
            await modifyClipboard(newClipboardContent);
        }        
}



// This function extracts the nested HTML strucutre from the clipBoard
async function getClipBoardHTML() {

    let clipBoardItems = await navigator.clipboard.read();
    let htmlTexts = [];
    for (const item of clipBoardItems) {

        if (item.types.includes("text/html")) {
            const blob = await item.getType("text/html");
            const copiedText = await blob.text();

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
            htmlTexts.push(copiedText);
        }
    }

    return htmlTexts[0]
}

// THis aims to extract the plain text from the clipboard, used as a helper function
async function getClipBoardPlainText() {
    let clipBoardPlainText = await navigator.clipboard.readText();
    // console.log("The copied text in plain is ", clipBoardPlainText)
    return clipBoardPlainText;
}


// This wrapped version ensures auto-render compatibility with Obsidian and Notion
function traverseHTMLWrapped (htmlStructure) {
    const startTime = Date.now();

    let textContent = [];

    function dfs (root) {
        if (Date.now() - startTime > 3000) {
            throw new Error("The nested HTML strucutre is infinite!");
        }
        if (!root) {
            return;
        }

        const nodes = root.childNodes;
        if (nodes.length === 0) {
            textContent = textContent + [root.textContent];
            return;
        }

        const fullTag = extractFullTag(root.outerHTML);
        const kaTexTag = getTagKatexContentFromFullTag(fullTag);
        if (kaTexTag === null) {
            for (const node of nodes) {
                dfs(node);
            }
        } else {  
            // Approach: leverage annotation tags (succeed)
            const mathTextContent = root.outerHTML;
            const latexMathContent = extractLatexFromAnnotations(mathTextContent);
            const displayFormat = retrieveFormatFromKatexTag(kaTexTag);
            const formattedLatex = formatLaTex(latexMathContent, displayFormat);

            textContent = textContent + [formattedLatex];
        }    

        return textContent
    }
    return dfs(htmlStructure)

}


// This provides a way to retreive the latex form from the rendered math equation.
function traverseHTMLLatex (htmlStructure) {
    const startTime = Date.now();

    let textContent = [];

    function dfs (root) {
        if (Date.now() - startTime > 3000) {
            throw new Error("The nested HTML strucutre is infinite!");
        }
        if (!root) {
            return;
        }

        const nodes = root.childNodes;
        if (nodes.length === 0) {
            textContent = textContent + [root.textContent];
            return;
        }

        const fullTag = extractFullTag(root.outerHTML);
        const kaTexTag = getTagKatexContentFromFullTag(fullTag);
        if (kaTexTag === null) {
            for (const node of nodes) {
                dfs(node);
            }
        } else {  
            // Approach: leverage annotation tags (succeed)
            const mathTextContent = root.outerHTML;
            const latexMathContent = extractLatexFromAnnotations(mathTextContent);

            textContent = textContent + [latexMathContent];
        }    

        return textContent
    }
    return dfs(htmlStructure)

}

// This matches the Katex Instance:
function getTagKatexContentFromFullTag(fullTag) {
    if (fullTag === null) {
        return null;
    }
    const regex = /<[^>]*class\s*=\s*"katex[^"]*"[^>]*>/s;
    const match = fullTag.match(regex);
    return match ? match[0] : null;
}

// This finds the tag from the html strucutre
function extractFullTag(outerHTML) {
    const regex = /^<[^>]+?>/;
    const firstTag = outerHTML.match(regex);
    if (firstTag) {
        return firstTag[0];
    } else {
        throw new Error("There are no tags in the outerHTML!");
    }
}

// Working function that extracts the latex from annotation tags
// Premise: the rendered math equation must meet global accessibility condition and includes a 
// pair of <annotaiton> tags.
function extractLatexFromAnnotations(katexOuterHTML) {
    const regex = /<annotation\b[^>]*>(.*?)<\/annotation>/gs;
    const matches = katexOuterHTML.match(regex);
    if (matches) {
        return matches.map(match => match.replace(/<\/?annotation[^>]*>/g, ''))[0];
    }
    window.alert("This platform currenlty is not supproted by Math Paste!");
    throw new Error("There is no annotation tags in the content.");
}


// Extract the latex from textContent, attempting the fallback == plain approach.
// Temporary not being adopted due to pattern inconsistency.
function extractKatexLatex(mathTextContent) {
    // The core of this function is to realize that the textContent property, when applied onto 
    // rendered math equations, its fallback and plain text is exactly the same, one at the end and one 
    // at the start. So what we need to do is to figure out when the fallback starts and when the plain 
    // text ends. 
    // This limits the scope to only GPT like copy use cases.
    // console.log(mathTextContent);
    let l = 1;
    const len = mathTextContent.length;
    // console.log("start of finding the latex ---------");

    let longest = ""
    while (l <= len/2) {
        const prefix = mathTextContent.slice(0, l);
        const suffix = mathTextContent.slice(len - l,);

        if (prefix === suffix) {
            longest = mathTextContent.slice(l, len-l);
            console.log("longest: ", longest);
        }
        l ++;
    }
    return longest;
}


// add $ $ or $$ $$ based on format block or inline
function formatLaTex(laTex, format) {
    if (format === "inline") {
        return "$" + laTex + "$";
    } else if  (format === "block") {
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

// !!!! You can try to add a new message to the screen about successful copy?
async function modifyClipboard(modifedText) {
    try {
        await navigator.clipboard.writeText(modifedText);
        // console.log("Clipboard successfully updated with new content!");
        // console.log("new clipboard content: ", modifedText);
    } catch (err) {
        console.error("Failed to modify clipboard: ", err);
    }
}


// This is a helper function that is used as a math separater
function generateUniqueString() {
    return 'xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}