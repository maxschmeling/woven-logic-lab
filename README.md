# Woven Logic Lab

**[Open the workshop →](https://maxschmeling.github.io/woven-logic-lab/)**

Code you can hold: a small browser-based Boolean-logic compiler, simulator, and physical build planner inspired by Apollo core-rope memory.

## What you can do

- Explore ten examples, from a half-adder to a four-bit ALU, comparator, decimal display decoder and eight-way selector.
- Orbit a lit 3D memory model and scrub a thread-by-thread weaving animation.
- Write your own expressions with up to **12 binary inputs, 16 outputs, and 64 LET signals**.
- Simulate every input combination and see its selected row in a weaving diagram.
- Print a build packet with the pattern, truth table, materials, instructions, and cell-by-cell checklist.
- Export SVG patterns, CSV truth tables, editable JSON projects, and generated Arduino reader code.
- Work entirely in your browser; no accounts, tracking, remote compiler, or API keys. Local storage is best-effort; save a project file for a portable backup.

## What you are building (and what you are not)

**Yarn model:** rings and yarn encode the truth table, through = 1 and around = 0. You select and read a row by eye. It is not an electronic computer.

**Working-circuit design:** insulated wires are laced onto a nonconductive board. A 1N4148 diode at each stored 1 connects its sense column (anode) to its row (striped cathode). Each row connects through its own 330 Ω resistor to an Arduino UNO R3. Three switches select a row; four pulled-up sense pins read it. The downloadable firmware contains **no equations or expected answers**: the physical connections determine the output. The board is a woven **diode ROM**, not magnetic core rope.

**Hardware status:** this is a reasoned educational reference design, not a bench-validated kit. Software tests verify Boolean logic and generated reader behavior. They do not certify electrical operation, construction quality, or safety. Prototype one bit first and follow the guide. USB-powered 5 V UNO R3 only; no mains, high-power loads, or safety/security applications.

Apollo used magnetic cores, pulse drivers and sensing circuitry, with a separate CPU executing the stored instructions. This app does **not** produce Apollo binaries or claim an ordinary craft ring can store magnetic state. It compiles combinational logic into a finite lookup table, not loops or stateful programs.


## Interactive 3D memory

The hero is a procedural WebGL sculpture of the **current compiled section**, with ferrite-like rings, copper wraps, insulated routing, brass fasteners, and a framed substrate. Drag to orbit or use Perspective / Top / Close-up and zoom buttons. Play, pause, rewind, or scrub the progress slider to reveal the routing thread by thread. It plays once on load unless reduced motion is requested; rendering pauses offscreen and while the document is hidden. WebGL/module failures retain a live 2D preview and a fully functional workbench.

**Fidelity:** this is an idealized ring-per-bit teaching model using arbitrary display units, not vendor CAD or an Apollo rope module reconstruction. Rings, chassis, copper wraps, and terminals are generic procedural geometry. A 1 passes through the ring, a 0 detours over it. The decorative copper winding is not a specified readout circuit. Use the separate diode-ROM construction guide for the starter electronic build; do not wire from the sculpture.

## Larger logic designs

- **12 input bits, 16 output bits:** up to 4,096 rows / 65,536 stored bits.
- **64 LET signals:** readable reusable expressions, no expansion into exponentially nested syntax trees.
- **16-row sections:** 3D, 2D pattern, truth table, SVG download and print packet all follow the current section. Global row numbers stay intact. Selecting inputs or entering a row address navigates to its section. CSV always includes the entire truth table.
- **Five larger examples:** four-bit addition (8 inputs), four-bit ALU (10), unsigned comparator (8), decimal seven-segment decoder (4 inputs / 7 outputs), eight-way multiplexer (11 inputs). The original five starter examples remain.
- **Honest hardware limits:** designs above 3 inputs or 4 outputs do not offer the UNO sketch or pin map. Their circuit view is a bit-layout illustration, not an engineered expanded reader. Their materials panel explicitly calls for a custom decoder/sensing design. Large yarn builds use multiple boards with size and yarn quantities scaled to the design; materials cover the full design even when printing one section.

The four-bit ALU uses `op1,op0` = `00` ADD, `01` AND, `10` XOR, `11` OR; result bits are `r3…r0`. Addition wraps modulo 16 and reports carry separately. `zero` refers to the four-bit result. These are combinational lookup tables, not CPUs with instruction execution or internal state.

## Language

```text
INPUT a, b

# Add two binary digits
sum = a XOR b
carry = a AND b
```

Names are case-insensitive, start with a letter, and contain up to 16 letters/digits/underscores. Inputs must be declared first; each subsequent line defines a unique output or LET signal from inputs, constants `0` / `1` (`FALSE` / `TRUE`), operators `NOT`, `AND`, `XOR`, `OR`, and parentheses. Symbol equivalents: `! & ^ |`. Precedence is NOT, AND, XOR, OR. Use `LET name = expression` for intermediate signals (not stored columns). Outputs and LET signals may reference earlier signals or outputs; forward references, cycles, and duplicate names are rejected. Each signal is evaluated once per row. There is no `eval` or dynamic JavaScript execution. The leftmost input is the most-significant address bit. Output columns preserve their declaration order.

## Development

The app is static HTML, CSS, SVG, and ES modules. Three.js and its orbit controls are bundled locally by esbuild from pinned development dependencies; the production site makes no CDN calls. `src/loom3d.js` is the visualization source, and `npm run build` emits `site/loom3d.bundle.js` and the Three.js license. Generated files are excluded from git but included in the Pages artifact.

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:visual
npm start
```

Open http://localhost:8080. Node 22+ and Python 3 are needed for the developer commands. A C++17 compiler is used to compile the generated firmware against a mocked GPIO/diode-ROM harness. Browser tests can use a system Chromium via `PLAYWRIGHT_EXECUTABLE_PATH`, or a live deployment via `TEST_URL`.

Tests cover exhaustive arithmetic/comparison/ALU/decoder/selector outputs, the 65,536-bit maximum design, bank boundaries, LET validation, 3D timeline and camera controls, graphics fallback, reduced motion, and all starter preset truth tables, 100 generated Boolean expressions, precedence and validation, exports/material counts, pin allocation, generated C++ readout against physical board mutations, browser behavior, imports, local-storage failure, printing, and mobile overflow.

## Deployment

The GitHub Actions workflow runs tests, uploads only `site/`, and deploys it to GitHub Pages. Configure repository Settings → Pages → Source as **GitHub Actions**. The site has relative asset URLs and works below a repository path.

## Sources

- [NASA: Apollo Guidance Computer background](https://www.nasa.gov/wp-content/uploads/static/history/alsj/a11/a11.1201-fm.html)
- [Ken Shirriff: core-rope memory investigation](https://www.righto.com/2019/07/software-woven-into-wire-core-rope-and.html)
- [Arduino UNO R3 reference](https://docs.arduino.cc/hardware/uno-rev3/)
- [Vishay 1N4148 datasheet](https://www.vishay.com/docs/81857/1n4148.pdf)

Original diagrams and prose. MIT license for this software and its original artwork; linked external material retains its own rights.

3D implementation references: [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html). Three.js is MIT licensed; its license is shipped with the built site.
