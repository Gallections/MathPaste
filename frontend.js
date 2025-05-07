const OPTIONS = {"Obsidian": "icons/obsidian.png", 
    "Notion": "icons/notion.png", 
    "LaTex": "icons/latex.svg", 
    "None": "icons/none.png"}
console.log("style injected!")

const observer = new MutationObserver(() => {
    inject();
});
observer.observe(document.body, { childList: true, subtree: true });
inject();


async function inject() {
    if (document.getElementById("toggle-math-paste")) return
    const toggle = createMainToggle();
    styleToggleOnOptions(toggle);

    const optionElements = createOptions(OPTIONS, toggle);
    // positionOptions(optionElements);

    createToggleContainer(toggle, optionElements);
    addHoverListenerToToggleContainer();
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

function addHoverListenerToToggleContainer() {
    const toggle = document.getElementById("toggle-options-container");
    const options = document.querySelectorAll(".option-math-paste");
    console.log(options)
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
    } else {
        console.log("toggle don't exist!");
    }
}

function helperImageNameExtraction(classname) {
    // Note: this is a helper only to the styltToggleOnOptions function
    // It assumes a valid Classname has the style of toggled-{imgId}-math-paste

    const firstIndex = classname.indexOf('-') + 1;
    const slicedClassname = classname.slice(firstIndex, );
    const secondIndex = slicedClassname.indexOf('-');
    const res = classname.slice(firstIndex, firstIndex + secondIndex);
    console.log(res);
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
            console.log(imgId)
            toggle.className =`toggled-${imgId}-math-paste`;
            styleToggleOnOptions(toggle);
        })
    } else {
        console.log("Toggle is not found!");
    }   
}

function positionOptions(options) {
    let position = 150;
    for (const option of options) {
        option.style.top = position.toString() + "px"; 
        position += 50;
    }
}


// Functional Requirements:
// 1. make the toggle draggable (not started)
// 2. make the toggle collapssible, that goes to the side of the panel and can be revisited by clicking an arrow on the side. (not started).
// 3. make the three different options. (done)
// 4. Finish up the logic
// 5. Make sure peak UX