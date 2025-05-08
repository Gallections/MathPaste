// ------------ global declarations --------------
const OPTIONS = {"Obsidian": "icons/obsidian.png", 
    "Notion": "icons/notion.png", 
    "LaTex": "icons/latex.svg", 
    "None": "icons/none.png"}

let showUI = false;
let isActiveContent = false;
let observer = null;

// inject();
// toggleUI();

// -------------- communication ------------------------
chrome.runtime.onMessage.addListener((message) => {
    if (message.toggle !== undefined) {
        isActiveContent = message.toggle;

        if (isActiveContent) {
            observer = new MutationObserver(() => {
                inject();
            });
            observer.observe(document.body, { childList: true, subtree: true });
            inject();
            toggleUI();
        } else {
           destroyUI();
           observer.disconnect(); // <- this stops the observer;
           observer = null;
        }
    }
})


// --------------- Content Injections -------------------
async function inject() {
    if (document.getElementById("toggle-math-paste")) return
    const toggle = createMainToggle();
    styleToggleOnOptions(toggle);

    const optionElements = createOptions(OPTIONS, toggle);
    // positionOptions(optionElements);

    createToggleContainer(toggle, optionElements);
    addHoverListenerToToggleContainer();
}

function toggleUI() {
    document.addEventListener("keydown", altMListener);
}

function removeAltMListener() {
    document.removeEventListener("keydown", altMListener);
}

function altMListener(event) {
    if (event.altKey && event.key.toLowerCase() === "m") {
        if (showUI) {
            const toggleContainer = document.getElementById("toggle-options-container");
            toggleContainer.style.display = "none";
        } else {
            const toggleContainer = document.getElementById("toggle-options-container");
            toggleContainer.style.display = "flex";
        }
        showUI = !showUI;
    }
}

function destroyUI() {
    document.getElementById("toggle-options-container").remove();
    removeAltMListener();
}

// ---------- Toggle and Options container -----------
function createToggleContainer (toggle, options) {
    const container = document.createElement("div");
    container.id = "toggle-options-container";
    container.appendChild(toggle);
    for (const option of options) {
        container.appendChild(option);
    }
    const cancelButton = createCancelButton();
    container.appendChild(cancelButton);
    makeDraggable(container);
    document.body.appendChild(container);
}

function addHoverListenerToToggleContainer() {
    const toggle = document.getElementById("toggle-options-container");
    const options = document.querySelectorAll(".option-math-paste");
    if (!toggle) {
        throw new Error("Toggle has not been created yet!");
    }
    toggle.addEventListener("mouseenter", () => {
        for (const option of options) {
            option.style.display = "flex";
        }
    })
    toggle.addEventListener("mouseleave", () => {
        for (const option of options) {
            option.style.display = "none";
        }
    })
}

// --------- Cancel Button ---------------------
function createCancelButton() {
    const cancelButton = document.createElement("div");
    cancelButton.id = "cancel-button-math-paste";
    const cancelImage = document.createElement("img");
    cancelImage.src = chrome.runtime.getURL("icons/cancel.png");
    cancelImage.alt = "cancel";
    cancelImage.id = "cancel-math-paste";
    cancelButton.appendChild(cancelImage);

    addOnClickListenerForCancelButton(cancelButton);

    return cancelButton;
}

function addOnClickListenerForCancelButton(button) {
    button.addEventListener("click", ()=> {
        const toggleContainer = document.getElementById("toggle-options-container");
        toggleContainer.style.display = "none";
    })
}

// ------------- make Draggabel -------------------

function makeDraggable(toggleContainer) {

    toggleContainer.addEventListener("mouseenter", ()=> {
        toggleContainer.style.cursor = `url(${chrome.runtime.getURL("icons/drag.png")}), auto`;
    })

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    toggleContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - toggleContainer.offsetLeft;
    offsetY = e.clientY - toggleContainer.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        toggleContainer.style.left = `${e.clientX - offsetX}px`;
        toggleContainer.style.top = `${e.clientY - offsetY}px`;
    }
    });

    document.addEventListener('mouseup', () => {
    isDragging = false;
    });
}


// -------- Toggle Section --------------------
function createMainToggle() {
    const toggle = document.createElement("div");
    toggle.id = "toggle-math-paste";
    return toggle;
}


function removeHoverListenerToToggle() {
    const toggle = document.getElementById("toggle-math-paste");
    if (!toggle) {
        throw new Error("Toggle has not been created yet!");
    }
}

function styleToggleOnOptions(toggle) {
    const toggleClassName = toggle.className;
    if (toggleClassName) {
        while (toggle.firstChild) {
            toggle.removeChild(toggle.firstChild);
        }

        const imgId = helperImageNameExtraction(toggleClassName);
        const imgInsertion = document.createElement('img');
        imgInsertion.id = imgId;
        imgInsertion.src = chrome.runtime.getURL(OPTIONS[imgId]);
        toggle.appendChild(imgInsertion);
    } 
    // else {
    //     console.log("toggle don't exist!");
    // }
}

function helperImageNameExtraction(classname) {
    // Note: this is a helper only to the styltToggleOnOptions function
    // It assumes a valid Classname has the style of toggled-{imgId}-math-paste

    const firstIndex = classname.indexOf('-') + 1;
    const slicedClassname = classname.slice(firstIndex, );
    const secondIndex = slicedClassname.indexOf('-');
    const res = classname.slice(firstIndex, firstIndex + secondIndex);
    return res;
}


// --------- Options section -------------
function createOptions(optionObject, toggle) {
    const options = []
    for (const [option, src] of Object.entries(optionObject)) {
        const optionElement = createOption(option, src);
        options.push(optionElement);
        addOnClickListenerForOption(optionElement, toggle);
    }
    return options;
}

function createOption(option, src) {
    const optElement = document.createElement("div");
    optElement.className ="option-math-paste";
    const imgSrc = document.createElement("img");
    imgSrc.src = chrome.runtime.getURL(src);
    imgSrc.alt = option;
    imgSrc.id = option;
    optElement.appendChild(imgSrc);
    return optElement;
}


// Bug resolved
function addOnClickListenerForOption(option, toggle) {
    if (toggle) {
        option.addEventListener("click", () => {
            const imgId = option.children[0].id;
            toggle.className =`toggled-${imgId}-math-paste`;
            styleToggleOnOptions(toggle);
            sendMessageForFunctionChange(imgId);
        })
    } else {
        console.log("Toggle is not found!");
    }   
}


function sendMessageForFunctionChange(imgId) {
    chrome.runtime.sendMessage({action: "functionChange", imgId: imgId})
}

function positionOptions(options) {
    let position = 150;
    for (const option of options) {
        option.style.top = position.toString() + "px"; 
        position += 50;
    }
}

// Functional Requirements:
// 1. need to make functions to remove all event listeners in UI
// 2. need to set up switching logic
// 3. Testing