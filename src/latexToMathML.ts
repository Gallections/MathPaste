// ─── LaTeX → MathML ──────────────────────────────────────────────────────────
// Best-effort LaTeX → MathML converter, used as a fallback for the Word
// format when no pre-rendered MathML tree is available to reuse (see
// copy.ts's setUpWordPaste — the primary path reuses KaTeX's own MathML
// output directly, since that's more reliable than re-deriving it here).
// MathML embedded in pasted HTML is recognized by Word's clipboard paste
// handler and converted into a real, editable equation object automatically.
//
// Handles the constructs typical of chatbot-rendered math: fractions,
// sub/superscripts (including combined), roots, greek letters, common
// operators and relations, big operators with limits, accents, and \text.
// Anything unrecognized degrades gracefully (inlines a command's argument,
// or drops it) rather than failing outright — same philosophy as the
// existing LaTeX → AsciiMath converter in copy.ts.

type TokenType = "cmd" | "lbrace" | "rbrace" | "lbracket" | "rbracket" | "sup" | "sub" | "char";
interface Token { type: TokenType; value: string; }

function tokenize(src: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        if (c === "\\") {
            const m = /^\\([a-zA-Z]+|.)/.exec(src.slice(i));
            if (m) {
                tokens.push({ type: "cmd", value: m[1] });
                i += m[0].length;
                continue;
            }
        }
        if (c === "{") { tokens.push({ type: "lbrace", value: c }); i++; continue; }
        if (c === "}") { tokens.push({ type: "rbrace", value: c }); i++; continue; }
        if (c === "[") { tokens.push({ type: "lbracket", value: c }); i++; continue; }
        if (c === "]") { tokens.push({ type: "rbracket", value: c }); i++; continue; }
        if (c === "^") { tokens.push({ type: "sup", value: c }); i++; continue; }
        if (c === "_") { tokens.push({ type: "sub", value: c }); i++; continue; }
        tokens.push({ type: "char", value: c });
        i++;
    }
    return tokens;
}

const GREEK: Record<string, string> = {
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε",
    zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ",
    lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", varpi: "ϖ", rho: "ρ",
    varrho: "ϱ", sigma: "σ", varsigma: "ς", tau: "τ", upsilon: "υ", phi: "φ",
    varphi: "ϕ", chi: "χ", psi: "ψ", omega: "ω",
    Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
    Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

const SYMBOLS: Record<string, string> = {
    infty: "∞", partial: "∂", nabla: "∇", pm: "±", mp: "∓", times: "×",
    div: "÷", cdot: "⋅", cdots: "⋯", ldots: "…", leq: "≤", le: "≤",
    geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", sim: "∼",
    equiv: "≡", propto: "∝", in: "∈", notin: "∉", subset: "⊂", supset: "⊃",
    subseteq: "⊆", supseteq: "⊇", cup: "∪", cap: "∩", setminus: "∖",
    emptyset: "∅", wedge: "∧", land: "∧", vee: "∨", lor: "∨", neg: "¬",
    lnot: "¬", forall: "∀", exists: "∃", to: "→", rightarrow: "→",
    leftarrow: "←", Rightarrow: "⇒", implies: "⇒", Leftarrow: "⇐",
    Leftrightarrow: "⇔", iff: "⇔", langle: "⟨", rangle: "⟩",
    lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉",
};

const NARY_OPS: Record<string, string> = {
    sum: "∑", prod: "∏", coprod: "∐", int: "∫", oint: "∮", bigcup: "⋃", bigcap: "⋂",
};

const FUNCTION_NAMES = new Set([
    "sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "exp",
    "lim", "det", "max", "min", "sup", "inf", "arg", "gcd", "deg",
]);

const ACCENT_CHAR: Record<string, string> = {
    hat: "^", bar: "‾", overline: "‾", vec: "→", tilde: "~", dot: "˙", ddot: "¨",
};

const SPACING_COMMANDS = new Set(["quad", "qquad", ",", ";", ":", "!"]);

function escapeXml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface Atom { xml: string; naryChar?: string; }

class Parser {
    private tokens: Token[];
    private pos = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    private peek(): Token | undefined { return this.tokens[this.pos]; }
    private next(): Token | undefined { return this.tokens[this.pos++]; }

    /** A full sequence of atoms (with their scripts applied), until a closing brace/bracket or end of input. */
    parseSequence(): string {
        const parts: string[] = [];
        while (this.pos < this.tokens.length) {
            const tok = this.peek()!;
            if (tok.type === "rbrace" || tok.type === "rbracket") break;

            if (tok.type === "char" && /[0-9]/.test(tok.value)) {
                let digits = "";
                while (this.peek() && this.peek()!.type === "char" && /[0-9.]/.test(this.peek()!.value)) {
                    digits += this.next()!.value;
                }
                parts.push(this.applyScripts({ xml: `<mn>${digits}</mn>` }));
                continue;
            }
            if (tok.type === "char" && /\s/.test(tok.value)) {
                this.next(); // LaTeX ignores whitespace in math mode
                continue;
            }
            if (tok.type === "sup" || tok.type === "sub") {
                this.next(); // stray script with no preceding atom — drop to avoid looping
                continue;
            }

            parts.push(this.applyScripts(this.parseAtom()));
        }
        return parts.join("");
    }

    /** `{...}` group (full sequence) or a single atom — used for command arguments. */
    private parseArg(): string {
        if (this.peek()?.type === "lbrace") {
            this.next();
            const inner = this.parseSequence();
            if (this.peek()?.type === "rbrace") this.next();
            return inner;
        }
        return this.parseAtom().xml;
    }

    /** Consumes one balanced `{...}` group and returns its RAW text (no per-char <mi> wrapping) — for \text. */
    private readRawBraceText(): string {
        if (this.peek()?.type !== "lbrace") return "";
        this.next();
        let raw = "";
        let depth = 1;
        while (this.pos < this.tokens.length && depth > 0) {
            const t = this.next()!;
            if (t.type === "lbrace") { depth++; continue; }
            if (t.type === "rbrace") { depth--; if (depth === 0) break; continue; }
            raw += t.value;
        }
        return raw;
    }

    private applyScripts(atom: Atom): string {
        let sup: string | null = null;
        let sub: string | null = null;
        while (this.peek()?.type === "sup" || this.peek()?.type === "sub") {
            const t = this.next()!;
            if (t.type === "sup") sup = this.parseArg();
            else sub = this.parseArg();
        }
        if (sup === null && sub === null) return atom.xml;

        if (atom.naryChar) {
            if (sup !== null && sub !== null) {
                return `<munderover><mo>${atom.naryChar}</mo><mrow>${sub}</mrow><mrow>${sup}</mrow></munderover>`;
            }
            if (sup !== null) return `<mover><mo>${atom.naryChar}</mo><mrow>${sup}</mrow></mover>`;
            return `<munder><mo>${atom.naryChar}</mo><mrow>${sub}</mrow></munder>`;
        }

        if (sup !== null && sub !== null) {
            return `<msubsup><mrow>${atom.xml}</mrow><mrow>${sub}</mrow><mrow>${sup}</mrow></msubsup>`;
        }
        if (sup !== null) return `<msup><mrow>${atom.xml}</mrow><mrow>${sup}</mrow></msup>`;
        return `<msub><mrow>${atom.xml}</mrow><mrow>${sub}</mrow></msub>`;
    }

    private parseAtom(): Atom {
        const tok = this.peek();
        if (!tok) return { xml: "" };

        if (tok.type === "lbrace") {
            this.next();
            const inner = this.parseSequence();
            if (this.peek()?.type === "rbrace") this.next();
            return { xml: inner };
        }

        if (tok.type === "char") {
            this.next();
            const v = tok.value;
            if (/[a-zA-Z]/.test(v)) return { xml: `<mi>${escapeXml(v)}</mi>` };
            if (/[0-9]/.test(v)) return { xml: `<mn>${v}</mn>` };
            return { xml: `<mo>${escapeXml(v)}</mo>` };
        }

        // tok.type === "cmd"
        this.next();
        return this.parseCommand(tok.value);
    }

    private parseCommand(name: string): Atom {
        if (name === "frac") {
            const num = this.parseArg();
            const den = this.parseArg();
            return { xml: `<mfrac>${num}${den}</mfrac>` };
        }
        if (name === "sqrt") {
            if (this.peek()?.type === "lbracket") {
                this.next();
                let deg = "";
                while (this.pos < this.tokens.length && this.peek()!.type !== "rbracket") {
                    deg += this.parseAtom().xml;
                }
                if (this.peek()?.type === "rbracket") this.next();
                const content = this.parseArg();
                return { xml: `<mroot>${content}<mrow>${deg}</mrow></mroot>` };
            }
            const content = this.parseArg();
            return { xml: `<msqrt>${content}</msqrt>` };
        }
        if (name in GREEK) return { xml: `<mi>${GREEK[name]}</mi>` };
        if (name in SYMBOLS) return { xml: `<mo>${SYMBOLS[name]}</mo>` };
        if (name in NARY_OPS) return { xml: `<mo>${NARY_OPS[name]}</mo>`, naryChar: NARY_OPS[name] };
        if (FUNCTION_NAMES.has(name)) return { xml: `<mi>${escapeXml(name)}</mi>` };

        if (name === "text" || name === "mathrm" || name === "operatorname") {
            return { xml: `<mtext>${escapeXml(this.readRawBraceText())}</mtext>` };
        }
        // Font-styling commands: best-effort — keep the content, drop the styling.
        if (name === "mathbf" || name === "mathcal" || name === "mathbb" || name === "boldsymbol") {
            return { xml: this.parseArg() };
        }
        if (name in ACCENT_CHAR) {
            const content = this.parseArg();
            return { xml: `<mover accent="true"><mrow>${content}</mrow><mo>${ACCENT_CHAR[name]}</mo></mover>` };
        }
        if (name === "left" || name === "right") {
            const d = this.next();
            if (!d) return { xml: "" };
            const raw = d.type === "cmd" ? (SYMBOLS[d.value] ?? d.value) : d.value;
            if (raw === ".") return { xml: "" }; // invisible delimiter
            return { xml: `<mo>${escapeXml(raw)}</mo>` };
        }
        if (name === "begin" || name === "end") {
            // Environments (matrices, aligned, ...) aren't supported. Drop just
            // the environment-name argument so it isn't mangled into stray
            // symbols — content between \begin/\end still flows through as a
            // best-effort flat sequence.
            if (this.peek()?.type === "lbrace") {
                this.next();
                while (this.pos < this.tokens.length && this.peek()!.type !== "rbrace") this.next();
                if (this.peek()?.type === "rbrace") this.next();
            }
            return { xml: "" };
        }
        if (SPACING_COMMANDS.has(name)) return { xml: "" };
        if (name === "{" || name === "}") return { xml: `<mo>${name}</mo>` };

        // Unrecognized command: inline its argument if it has one, else drop it.
        if (this.peek()?.type === "lbrace") return { xml: this.parseArg() };
        return { xml: "" };
    }
}

/**
 * Converts LaTeX source to a MathML `<math>` element (as an XML string).
 * `isBlock` sets `display="block"`, matching LaTeX's own inline/display
 * distinction (`$…$` vs `$$…$$` etc.).
 */
export function latexToMathML(latex: string, isBlock: boolean): string {
    const body = new Parser(tokenize(latex.trim())).parseSequence();
    const display = isBlock ? ' display="block"' : "";
    return `<math xmlns="http://www.w3.org/1998/Math/MathML"${display}><mrow>${body}</mrow></math>`;
}
