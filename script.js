// ─── State ───────────────────────────────────────────────────────────────────
let stack = [], output = "", tokens = [], index = 0;
let speed = 1000, mode = "postfix";
let isRunning = false, paused = false, loopRunning = false;
let originalExpr = "";
let stepType = "idle";

// ─── DOM refs ────────────────────────────────────────────────────────────────
const stackContainer  = document.getElementById("stackContainer");
const outputContainer = document.getElementById("outputContainer");
const stepText        = document.getElementById("stepText");
const expTitle        = document.getElementById("expTitle");
const expBody         = document.getElementById("expBody");
const ruleBox         = document.getElementById("ruleBox");
const expressionInput = document.getElementById("expressionInput");
const speedControl    = document.getElementById("speedControl");
const speedLabel      = document.getElementById("speedLabel");
const modeSelect      = document.getElementById("mode");
const pauseBtn        = document.getElementById("pauseBtn");
const tokenScannerEl  = document.getElementById("tokenScanner");

// ─── Event listeners ─────────────────────────────────────────────────────────
speedControl.addEventListener("input", () => {
  speedLabel.textContent = speedControl.value + "x";
  speed = 1000 / speedControl.value;
});
modeSelect.addEventListener("change", () => { mode = modeSelect.value; });

// ─── Algorithm helpers ───────────────────────────────────────────────────────
function precedence(op) {
  if (op === '^') return 3;
  if (op === '*' || op === '/') return 2;
  if (op === '+' || op === '-') return 1;
  return 0;
}

function shouldPopPostfix(stackTop, current) {
  if (stackTop === '(') return false;
  if (current === '^') return precedence(stackTop) > precedence(current);
  return precedence(stackTop) >= precedence(current);
}

function shouldPopPrefix(stackTop, current) {
  if (stackTop === '(') return false;
  return precedence(stackTop) > precedence(current);
}

function getTokenClass(token) {
  if (token === '^')                  return 'op-exp';
  if (token === '*' || token === '/') return 'op-muldiv';
  if (token === '+' || token === '-') return 'op-addsub';
  if (token === '(' || token === ')') return 'op-paren';
  return 'op-operand';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── WHY panel: contextual explanations ──────────────────────────────────────
function showWhy(ctx) {
  // ctx: { type, token?, willPop?, finalResult? }
  let title = "", body = "", rule = "";

  switch (ctx.type) {
    case "idle":
      title = "How it works";
      body  = `Type an expression like <code>a+b*c</code> and press <strong>Start</strong>.<br><br>
               We scan the expression left to right. Each character is either sent straight to the <strong>Output</strong>,
               or placed on the <strong>Stack</strong> temporarily.`;
      rule  = "";
      break;

    case "operand":
      title = `'${ctx.token}' is a variable / number`;
      body  = `<strong class="hi">${ctx.token}</strong> is an operand — a value, not an operation.<br><br>
               Operands are <em>always written directly to the output</em>. They never sit on the stack.
               The order of operands stays the same in infix, postfix, and prefix.`;
      rule  = `<div class="rule-label">Rule</div>Operand → Output immediately`;
      break;

    case "lparen":
      title = `'(' opens a sub-group`;
      body  = `<strong class="hi">(</strong> is pushed onto the stack as a <em>guard</em>.<br><br>
               It tells the algorithm: "don't pop anything below this point until you find the matching <strong>)</strong>."
               Think of it as a locked gate that protects the operators inside.`;
      rule  = `<div class="rule-label">Rule</div>( → push onto stack as a guard`;
      break;

    case "rparen":
      if (ctx.willPop && ctx.willPop.length > 0) {
        title = `')' closes the group — flushing ${ctx.willPop.join(", ")}`;
        body  = `<strong class="hi">)</strong> triggers a flush.<br><br>
                 Everything between this <code>)</code> and the matching <code>(</code> must go to output now.
                 So <strong>${ctx.willPop.join(", ")}</strong> get${ctx.willPop.length === 1 ? "s" : ""} popped to output.<br><br>
                 Then both <code>(</code> and <code>)</code> are <em>thrown away</em> — they only existed to group things, and that job is done.`;
      } else {
        title = `')' closes the group`;
        body  = `<strong class="hi">)</strong> looks for the matching <code>(</code>.<br><br>
                 Nothing was between them, so nothing is popped. Both brackets are discarded.<br><br>
                 Brackets are not part of postfix / prefix notation — the positions of operators already encode the order.`;
      }
      rule = `<div class="rule-label">Rule</div>) → pop to output until (, then discard both`;
      break;

    case "operator_push_only":
      title = `'${ctx.token}' waits on the stack`;
      body  = `<strong class="hi">${ctx.token}</strong> (priority: ${precedence(ctx.token)}) goes straight onto the stack.<br><br>
               Why? The stack is either empty, has a <code>(</code> on top, or the operator already there has <em>lower</em> priority.
               So nothing needs to be popped yet — <strong>${ctx.token}</strong> just waits for its turn.`;
      rule  = `<div class="rule-label">Rule</div>Operator → push when stack is empty or top has lower priority`;
      break;

    case "operator_pop_push":
      title = `'${ctx.token}' triggers a pop: ${ctx.willPop.join(" → out, ")} → out`;
      body  = `<strong class="hi">${ctx.token}</strong> (priority: ${precedence(ctx.token)}) found
               <strong>${ctx.willPop.join(", ")}</strong> on the stack with equal or higher priority.<br><br>
               Those operators must go to output <em>before</em> <strong>${ctx.token}</strong>, because they bind their operands more tightly
               (or at the same level, left-to-right). After popping them, <strong>${ctx.token}</strong> is pushed.`;
      rule  = `<div class="rule-label">Rule</div>Pop all stack ops with ≥ priority, then push current op`;
      break;

    case "final":
      title = "Flushing the remaining operators";
      body  = `All characters have been scanned. Any operators still on the stack were waiting — now they go to output one by one, from top to bottom.<br><br>
               ${mode === "prefix" ? "Since this is <strong>Prefix mode</strong>, the output is then <em>reversed</em> to give the final prefix expression." : ""}`;
      rule  = `<div class="rule-label">Rule</div>End of input → pop entire stack to output`;
      break;

    case "complete":
      title = "Done! ✓";
      body  = `Result: <span class="hi">${output}</span><br><br>
               In <strong>${mode === "postfix" ? "Postfix (RPN)" : "Prefix (Polish)"}</strong>, every operator sits right next to its operands —
               so you can evaluate it with a simple stack scan. No brackets needed!`;
      rule  = "";
      break;
  }

  expTitle.textContent = title;
  expBody.innerHTML    = body;

  if (rule) {
    ruleBox.innerHTML = rule;
    ruleBox.classList.add("visible");
  } else {
    ruleBox.innerHTML = "";
    ruleBox.classList.remove("visible");
  }
}

// ─── Render: Stack ───────────────────────────────────────────────────────────
function renderStack() {
  stackContainer.innerHTML = "";
  stack.forEach(item => {
    const node = document.createElement("div");
    node.className = `stack-item ${getTokenClass(item)}`;
    node.textContent = item;
    stackContainer.appendChild(node);
  });
}

// ─── Render: Output ──────────────────────────────────────────────────────────
function renderOutput() {
  outputContainer.innerHTML = "";
  for (const char of output) {
    const span = document.createElement("div");
    span.className = `output-token ${getTokenClass(char)}`;
    span.textContent = char;
    outputContainer.appendChild(span);
  }
}

function render() { renderStack(); renderOutput(); }

// ─── Render: Token Scanner ───────────────────────────────────────────────────
function renderScanner(currentIdx) {
  tokenScannerEl.innerHTML = "";
  if (!originalExpr) {
    tokenScannerEl.innerHTML = '<span class="scanner-placeholder">tokens appear here during conversion</span>';
    return;
  }
  const chars = originalExpr.split("");
  chars.forEach((char, i) => {
    const span = document.createElement("span");
    span.className = `scan-token ${getTokenClass(char)}`;
    span.textContent = char;

    const displayCurrent = mode === "prefix"
      ? originalExpr.length - 1 - currentIdx
      : currentIdx;

    if (mode === "prefix") {
      if (i > displayCurrent)        span.classList.add("processed");
      else if (i === displayCurrent) span.classList.add("current");
      else                           span.classList.add("pending");
    } else {
      if (i < displayCurrent)        span.classList.add("processed");
      else if (i === displayCurrent) span.classList.add("current");
      else                           span.classList.add("pending");
    }
    tokenScannerEl.appendChild(span);
  });
}

// ─── Animation: pop top N stack items ────────────────────────────────────────
async function animateStackPop(count) {
  if (count <= 0) return;
  const items = Array.from(stackContainer.children);
  items.slice(-count).forEach(item => item.classList.add("stack-item--popping"));
  await sleep(220);
}

// ─── Conversion: one token step ──────────────────────────────────────────────
async function processStep() {
  const token = tokens[index];
  const shouldPop = mode === "prefix" ? shouldPopPrefix : shouldPopPostfix;

  if (/[a-zA-Z0-9]/.test(token)) {
    stepType = "operand";
    output += token;
    stepText.textContent = `'${token}' is an operand → goes directly to Output`;
    showWhy({ type: "operand", token });

  } else if (token === '(') {
    stepType = "lparen";
    stack.push(token);
    stepText.textContent = `'(' pushed to Stack — acts as a guard for this group`;
    showWhy({ type: "lparen", token });

  } else if (token === ')') {
    stepType = "rparen";
    const willPop = [];
    let t = stack.length - 1;
    while (t >= 0 && stack[t] !== '(') { willPop.push(stack[t]); t--; }

    await animateStackPop(willPop.length);
    while (stack.length && stack[stack.length - 1] !== '(') output += stack.pop();
    stack.pop();

    const poppedStr = willPop.length ? `[${willPop.join(", ")}] → Output` : "nothing to pop";
    stepText.textContent = `')' closed group: ${poppedStr}, then '(' discarded`;
    showWhy({ type: "rparen", token, willPop });

  } else {
    // Operator
    stepType = "operator";
    const willPop = [];
    let tmp = [...stack];
    while (tmp.length && shouldPop(tmp[tmp.length - 1], token)) willPop.push(tmp.pop());

    await animateStackPop(willPop.length);
    while (stack.length && shouldPop(stack[stack.length - 1], token)) output += stack.pop();
    stack.push(token);

    if (willPop.length > 0) {
      stepText.textContent = `'${token}' (prio ${precedence(token)}): popped [${willPop.join(", ")}] → Output, then pushed '${token}'`;
      showWhy({ type: "operator_pop_push", token, willPop });
    } else {
      stepText.textContent = `'${token}' (prio ${precedence(token)}): nothing to pop, pushed '${token}' to Stack`;
      showWhy({ type: "operator_push_only", token, willPop: [] });
    }
  }

  index++;
  renderScanner(index - 1);
  render();
}

// ─── Conversion: final flush ─────────────────────────────────────────────────
async function finalFlush() {
  stepType = "final";
  showWhy({ type: "final" });

  while (stack.length > 0) {
    if (paused) return;
    const items = Array.from(stackContainer.children);
    if (items.length > 0) {
      items[items.length - 1].classList.add("stack-item--popping");
      await sleep(220);
    }
    output += stack.pop();
    render();
    stepText.textContent = `Flushed '${output[output.length - 1]}' from Stack → Output`;
    await sleep(Math.max(speed * 0.7, 200));
  }

  if (mode === "prefix") {
    output = output.split("").reverse().join("");
    renderOutput();
    await sleep(300);
  }

  setComplete();
}

// ─── Conversion: complete ────────────────────────────────────────────────────
function setComplete() {
  stepType = "complete";
  stepText.textContent = `Done!  Result: ${output}`;
  isRunning = false;
  paused = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = "Pause";
  renderScanner(tokens.length);
  showWhy({ type: "complete" });
}

// ─── Main loop ───────────────────────────────────────────────────────────────
async function runLoop() {
  if (loopRunning) return;
  loopRunning = true;
  while (index < tokens.length) {
    if (paused) { loopRunning = false; return; }
    await processStep();
    if (!paused) await sleep(speed);
  }
  if (!paused) await finalFlush();
  loopRunning = false;
}

// ─── Public: start ───────────────────────────────────────────────────────────
async function startConversion() {
  stack = []; output = ""; index = 0;
  originalExpr = expressionInput.value.trim();
  if (!originalExpr) return;

  let expr = originalExpr.replace(/\s+/g, "");
  if (mode === "prefix") {
    expr = expr.split("").reverse().map(c => c==="(" ? ")" : c===")" ? "(" : c).join("");
  }

  tokens = expr.split("");
  isRunning = true; paused = false; loopRunning = false;
  stepType = "idle";
  pauseBtn.disabled = false; pauseBtn.textContent = "Pause";

  render();
  renderScanner(-1);
  showWhy({ type: "idle" });

  await runLoop();
}

// ─── Public: reset ───────────────────────────────────────────────────────────
function resetAll() {
  stack = []; output = ""; tokens = []; index = 0;
  isRunning = false; paused = false; loopRunning = false;
  stepType = "idle"; originalExpr = "";
  pauseBtn.disabled = true; pauseBtn.textContent = "Pause";
  render();
  renderScanner(-1);
  showWhy({ type: "idle" });
  stepText.textContent = "Reset — ready for a new expression.";
}

// ─── Public: pause / resume ───────────────────────────────────────────────────
function togglePause() {
  if (!isRunning) return;
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  if (!paused) runLoop();
}

// ─── Public: precedence panel ─────────────────────────────────────────────────
function togglePrecedencePanel() {
  document.getElementById("precedenceSidebar").classList.toggle("open");
}

// ─── Init ─────────────────────────────────────────────────────────────────────
showWhy({ type: "idle" });
renderScanner(-1);
