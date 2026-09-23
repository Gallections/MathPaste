import { describe, it, expect } from 'vitest';
import { latexToMathML } from './latexToMathML';

// Unwraps the outer <math ...><mrow>...</mrow></math> wrapper for terser
// assertions on the interesting inner content.
function inner(latex: string, isBlock = false): string {
    const xml = latexToMathML(latex, isBlock);
    const m = /^<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML"( display="block")?><mrow>([\s\S]*)<\/mrow><\/math>$/.exec(xml);
    expect(m, `unexpected wrapper shape: ${xml}`).not.toBeNull();
    return m![2];
}

describe('latexToMathML — wrapper', () => {
    it('wraps inline math without a display attribute', () => {
        const xml = latexToMathML('x', false);
        expect(xml).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>');
        expect(xml).not.toContain('display=');
    });

    it('wraps block math with display="block"', () => {
        const xml = latexToMathML('x', true);
        expect(xml).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow>');
    });
});

describe('latexToMathML — basics', () => {
    it('converts a single letter to <mi>', () => {
        expect(inner('x')).toBe('<mi>x</mi>');
    });

    it('converts a digit to <mn>', () => {
        expect(inner('5')).toBe('<mn>5</mn>');
    });

    it('batches consecutive digits (and a decimal point) into one <mn>', () => {
        expect(inner('3.14')).toBe('<mn>3.14</mn>');
    });

    it('converts a bare operator character to <mo>', () => {
        expect(inner('+')).toBe('<mo>+</mo>');
    });

    it('concatenates a simple expression left to right', () => {
        expect(inner('x+1')).toBe('<mi>x</mi><mo>+</mo><mn>1</mn>');
    });

    it('skips literal whitespace', () => {
        expect(inner('x + 1')).toBe('<mi>x</mi><mo>+</mo><mn>1</mn>');
    });

    it('strips a group\'s braces but keeps its content', () => {
        expect(inner('{x+1}')).toBe('<mi>x</mi><mo>+</mo><mn>1</mn>');
    });
});

describe('latexToMathML — scripts', () => {
    it('converts a superscript', () => {
        expect(inner('x^2')).toBe('<msup><mrow><mi>x</mi></mrow><mrow><mn>2</mn></mrow></msup>');
    });

    it('converts a subscript', () => {
        expect(inner('x_i')).toBe('<msub><mrow><mi>x</mi></mrow><mrow><mi>i</mi></mrow></msub>');
    });

    it('converts a braced superscript group', () => {
        expect(inner('x^{2n}')).toBe('<msup><mrow><mi>x</mi></mrow><mrow><mn>2</mn><mi>n</mi></mrow></msup>');
    });

    it('combines a subscript and superscript on the same base, sup-then-sub order', () => {
        expect(inner('x^2_3')).toBe('<msubsup><mrow><mi>x</mi></mrow><mrow><mn>3</mn></mrow><mrow><mn>2</mn></mrow></msubsup>');
    });

    it('combines a subscript and superscript on the same base, sub-then-sup order', () => {
        expect(inner('x_3^2')).toBe('<msubsup><mrow><mi>x</mi></mrow><mrow><mn>3</mn></mrow><mrow><mn>2</mn></mrow></msubsup>');
    });
});

describe('latexToMathML — fractions and roots', () => {
    it('converts \\frac', () => {
        expect(inner('\\frac{a}{b}')).toBe('<mfrac><mi>a</mi><mi>b</mi></mfrac>');
    });

    it('converts a nested fraction inside a superscript', () => {
        expect(inner('x^{\\frac{1}{2}}')).toBe(
            '<msup><mrow><mi>x</mi></mrow><mrow><mfrac><mn>1</mn><mn>2</mn></mfrac></mrow></msup>'
        );
    });

    it('converts \\sqrt', () => {
        expect(inner('\\sqrt{x}')).toBe('<msqrt><mi>x</mi></msqrt>');
    });

    it('converts \\sqrt with an explicit degree', () => {
        expect(inner('\\sqrt[3]{x}')).toBe('<mroot><mi>x</mi><mrow><mn>3</mn></mrow></mroot>');
    });
});

describe('latexToMathML — greek letters and symbols', () => {
    it('converts a greek letter to its unicode character', () => {
        expect(inner('\\alpha')).toBe('<mi>α</mi>');
    });

    it('converts an uppercase greek letter', () => {
        expect(inner('\\Omega')).toBe('<mi>Ω</mi>');
    });

    it('converts common relation/operator symbols', () => {
        expect(inner('\\leq')).toBe('<mo>≤</mo>');
        expect(inner('\\times')).toBe('<mo>×</mo>');
        expect(inner('\\infty')).toBe('<mo>∞</mo>');
    });

    it('converts a recognized function name to an upright <mi>', () => {
        expect(inner('\\sin')).toBe('<mi>sin</mi>');
    });
});

describe('latexToMathML — big operators with limits', () => {
    it('converts \\sum with both bounds to munderover', () => {
        expect(inner('\\sum_{i=1}^{n}')).toBe(
            '<munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mrow><mi>n</mi></mrow></munderover>'
        );
    });

    it('converts \\int with only a lower bound to munder', () => {
        expect(inner('\\int_0')).toBe('<munder><mo>∫</mo><mrow><mn>0</mn></mrow></munder>');
    });

    it('leaves a bare nary operator (no limits) as a plain <mo>', () => {
        expect(inner('\\sum')).toBe('<mo>∑</mo>');
    });
});

describe('latexToMathML — accents', () => {
    it('converts \\hat to an accented mover', () => {
        expect(inner('\\hat{x}')).toBe('<mover accent="true"><mrow><mi>x</mi></mrow><mo>^</mo></mover>');
    });

    it('converts \\vec', () => {
        expect(inner('\\vec{v}')).toBe('<mover accent="true"><mrow><mi>v</mi></mrow><mo>→</mo></mover>');
    });
});

describe('latexToMathML — text and delimiters', () => {
    it('converts \\text to a literal <mtext> run, not per-letter <mi>', () => {
        expect(inner('\\text{if}')).toBe('<mtext>if</mtext>');
    });

    it('converts \\left( and \\right) to plain delimiter operators', () => {
        expect(inner('\\left(x\\right)')).toBe('<mo>(</mo><mi>x</mi><mo>)</mo>');
    });

    it('drops an invisible \\right. delimiter', () => {
        expect(inner('\\left(x\\right.')).toBe('<mo>(</mo><mi>x</mi>');
    });
});

describe('latexToMathML — graceful degradation', () => {
    it('drops an unknown no-argument command', () => {
        expect(inner('\\totallyMadeUpCommand')).toBe('');
    });

    it('inlines the argument of an unknown command with one', () => {
        expect(inner('\\madeUpWrapper{x}')).toBe('<mi>x</mi>');
    });

    it('drops \\begin/\\end environment names without leaking them as symbols', () => {
        const xml = inner('\\begin{matrix}x\\end{matrix}');
        expect(xml).not.toContain('matrix');
        expect(xml).toContain('<mi>x</mi>');
    });

    it('drops spacing commands', () => {
        expect(inner('a\\,b')).toBe('<mi>a</mi><mi>b</mi>');
    });

    it('does not loop forever on a stray, argument-less script token', () => {
        expect(() => inner('^')).not.toThrow();
    });
});
