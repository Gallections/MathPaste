const options = {"Obsidian": "icons/obsidian.png", 
    "Notion": "icons/notion.png", 
    "LaTex": "icons/latex.svg", 
    "None": "icons/none.png"}
console.log("style injected!")

const observer = new MutationObserver(() => {
    inject();
});
observer.observe(document.body, { childList: true, subtree: true });
inject();


function inject() {
    if (document.getElementById("toggle")) return
    const toggle = createMainToggle();
    const optionElements = createOptions(options);
    // positionOptions(optionElements);

    createToggleContainer(toggle, optionElements);
}

// ---------- Toggle and Options container -----------
function createToggleContainer (toggle, options) {
    const container = document.createElement("div");
    container.id = "toggle-options-container";
    container.appendChild(toggle);
    for (const option of options) {
        container.appendChild(option);
    }
    document.body.appendChild(container);
}


// -------- Toggle Section --------------------
function createMainToggle() {
    const toggle = document.createElement("div");
    toggle.id = "toggle";
    return toggle;
}

function onHoverShowOptions() {
    

}



// --------- Options section -------------
function createOptions(optionObject) {
    const options = []
    for (const [option, src] of Object.entries(optionObject)) {
        const optionElement = createOption(option, src);
        options.push(optionElement);
    }
    return options;
}

function createOption(option, src) {
    const optElement = document.createElement("div");
    optElement.className ="option";
    const imgSrc = document.createElement("img");
    imgSrc.src = chrome.runtime.getURL(src);
    imgSrc.alt = option;
    imgSrc.id = option;
    optElement.appendChild(imgSrc);
    return optElement;
}

function positionOptions(options) {
    let position = 150;
    for (const option of options) {
        option.style.top = position.toString() + "px"; 
        position += 50;
    }
}

function hideOptionsOneByOne(options) {
    for (const option of options) {
        setTimeout(() => {
            option.display = "none";
        }, 300)
    }
}

function showOptionsOneByOne(options) {
    for (const option of options) {
        setTimeout(() => {
            option.display = "flex";
        }, 300)
    }
}


// Functional Requirements:
// 1. make the toggle draggable
// 2. make the toggle collapssible, that goes to the side of the panel and can be revisited by clicking an arrow on the side.
// 3. make the three different options.
// 4. Finish up the logic
// 5. Make sure peak UX