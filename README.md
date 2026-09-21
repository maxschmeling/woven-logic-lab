# Woven Logic Lab

**[Open the workshop →](https://maxschmeling.github.io/woven-logic-lab/)**

Code you can hold: a small browser-based Boolean-logic compiler, simulator, and physical build planner inspired by Apollo core-rope memory.

## What you can do

- Start with a half-adder, full-adder, majority voter, signal selector, or door-alert example.
- Write your own expressions with up to **3 binary inputs and 4 outputs**.
- Simulate every input combination and see its selected row in a weaving diagram.
- Print a build packet with the pattern, truth table, materials, instructions, and cell-by-cell checklist.
- Export SVG patterns, CSV truth tables, editable JSON projects, and generated Arduino reader code.
- Work entirely in your browser; no accounts, tracking, remote compiler, or API keys. Local storage is best-effort; save a project file for a portable backup.

## What you are building (and what you are not)

**Yarn model:** rings and yarn encode the truth table, through = 1 and around = 0. You select and read a row by eye. It is not an electronic computer.

**Working-circuit design:** insulated wires are laced onto a nonconductive board. A 1N4148 diode at each stored 1 connects its sense column (anode) to its row (striped cathode). Each row connects through its own 330 Ω resistor to an Arduino UNO R3. Three switches select a row; four pulled-up sense pins read it. The downloadable firmware contains **no equations or expected answers**: the physical connections determine the output. The board is a woven **diode ROM**, not magnetic core rope.

**Hardware status:** this is a reasoned educational reference design, not a bench-validated kit. Software tests verify Boolean logic and generated reader behavior. They do not certify electrical operation, construction quality, or safety. Prototype one bit first and follow the guide. USB-powered 5 V UNO R3 only; no mains, high-power loads, or safety/security applications.

Apollo used magnetic cores, pulse drivers and sensing circuitry, with a separate CPU executing the stored instructions. This app does **not** produce Apollo binaries or claim an ordinary craft ring can store magnetic state. It compiles combinational logic into a finite lookup table, not loops or stateful programs.

## Language

```text
INPUT a, b

# Add two binary digits
sum = a XOR b
carry = a AND b
```

Names are case-insensitive, start with a letter, and contain up to 16 letters/digits/underscores. Inputs must be declared first; each subsequent line defines a unique output from inputs, constants `0` / `1` (`FALSE` / `TRUE`), operators `NOT`, `AND`, `XOR`, `OR`, and parentheses. Symbol equivalents: `! & ^ |`. Precedence is NOT, AND, XOR, OR. Outputs cannot reference other outputs. There is no `eval` or dynamic JavaScript execution. The leftmost input is the most-significant address bit. Output columns preserve their declaration order.

## Development

Production has **zero runtime dependencies**. Static HTML, CSS, SVG, and ES modules live in `site/`.

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm start
```

Open http://localhost:8080. Node 22+ and Python 3 are needed for the developer commands. A C++17 compiler is used to compile the generated firmware against a mocked GPIO/diode-ROM harness. Browser tests can use a system Chromium via `PLAYWRIGHT_EXECUTABLE_PATH`, or a live deployment via `TEST_URL`.

Tests cover all preset truth tables, 100 generated Boolean expressions, precedence and validation, exports/material counts, pin allocation, generated C++ readout against physical board mutations, browser behavior, imports, local-storage failure, printing, and mobile overflow.

## Deployment

The GitHub Actions workflow runs tests, uploads only `site/`, and deploys it to GitHub Pages. Configure repository Settings → Pages → Source as **GitHub Actions**. The site has relative asset URLs and works below a repository path.

## Sources

- [NASA: Apollo Guidance Computer background](https://www.nasa.gov/wp-content/uploads/static/history/alsj/a11/a11.1201-fm.html)
- [Ken Shirriff: core-rope memory investigation](https://www.righto.com/2019/07/software-woven-into-wire-core-rope-and.html)
- [Arduino UNO R3 reference](https://docs.arduino.cc/hardware/uno-rev3/)
- [Vishay 1N4148 datasheet](https://www.vishay.com/docs/81857/1n4148.pdf)

Original diagrams and prose. MIT license for this software and its original artwork; linked external material retains its own rights.
