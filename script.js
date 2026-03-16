let stack = [];
let output = "";
let tokens = [];
let index = 0;
let speed = 1000;
let mode = "postfix";
let isRunning = false;
let paused = false;

const stackContainer = document.getElementById("stackContainer");
const outputContainer = document.getElementById("outputContainer");
const stepText = document.getElementById("stepText");
const expressionInput = document.getElementById("expressionInput");
const speedControl = document.getElementById("speedControl");
const speedLabel = document.getElementById("speedLabel");
const modeSelect = document.getElementById("mode");
const pauseBtn = document.getElementById("pauseBtn");

speedControl.addEventListener("input", () => {
  speedLabel.textContent = speedControl.value + "x";
  speed = 1000 / speedControl.value;
});

modeSelect.addEventListener("change", () => {
  mode = modeSelect.value;
});

function precedence(op) {
  if (op === '+' || op === '-') return 1;
  if (op === '*' || op === '/') return 2;
  if (op === '^') return 3;
  return 0;
}

// Postfix: left-assoc uses >=, right-assoc (^) uses strict >
function shouldPopPostfix(stackTop, current) {
  if (stackTop === '(') return false;
  if (current === '^') return precedence(stackTop) > precedence(current);
  return precedence(stackTop) >= precedence(current);
}

// Prefix (reversed scan): always strict > handles both assoc types correctly
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

function render() {
  stackContainer.innerHTML = "";
  outputContainer.innerHTML = "";

  stack.forEach(item => {
    const node = document.createElement("div");
    node.className = `stack-item ${getTokenClass(item)}`;
    node.textContent = item;
    stackContainer.appendChild(node);
  });

  for (let char of output) {
    const span = document.createElement("div");
    span.className = `output-token ${getTokenClass(char)}`;
    span.textContent = char;
    outputContainer.appendChild(span);
  }
}

function startConversion() {
  stack = [];
  output = "";
  index = 0;

  let expr = expressionInput.value.replace(/\s+/g, "");

  if (mode === "prefix") {
    expr = expr.split("").reverse().map(c => {
      if (c === '(') return ')';
      if (c === ')') return '(';
      return c;
    }).join("");
  }

  tokens = expr.split("");
  isRunning = true;
  paused = false;
  pauseBtn.disabled = false;
  pauseBtn.textContent = "Pause";
  convertStep();
}

function convertStep() {
  if (index >= tokens.length) {
    while (stack.length > 0) output += stack.pop();

    if (mode === "prefix") {
      output = output.split("").reverse().join("");
    }

    render();
    stepText.textContent = "Conversion Complete! All remaining operators popped from stack to output.";
    isRunning = false;
    pauseBtn.disabled = true;
    return;
  }

  const token = tokens[index];
  const shouldPop = mode === "prefix" ? shouldPopPrefix : shouldPopPostfix;

  if (/[a-zA-Z0-9]/.test(token)) {
    output += token;
    stepText.textContent = `Operand '${token}' → Output (Operands are always added directly to output)`;
  }
  else if (token === '(') {
    stack.push(token);
    stepText.textContent = "Left parenthesis '(' pushed to stack (Marks start of subexpression)";
  }
  else if (token === ')') {
    while (stack.length && stack[stack.length - 1] !== '(') output += stack.pop();
    stack.pop();
    stepText.textContent = "Right parenthesis ')': Popped operators until '(' found, then removed '('";
  }
  else {
    let poppedOps = [];
    while (stack.length && shouldPop(stack[stack.length - 1], token)) {
      let popped = stack.pop();
      output += popped;
      poppedOps.push(popped);
    }
    stack.push(token);
    let poppedStr = poppedOps.length > 0 ? ` (Popped: ${poppedOps.join(', ')})` : "";
    stepText.textContent = `Operator '${token}' (prec: ${precedence(token)}): Pop operators with ≥ precedence${poppedStr}, then push '${token}'`;
  }

  index++;
  render();
  if (!paused) setTimeout(convertStep, speed);
}

function resetAll() {
  stack = [];
  output = "";
  tokens = [];
  index = 0;
  isRunning = false;
  paused = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = "Pause";
  render();
  stepText.textContent = "Reset Complete";
}

function togglePause() {
  if (!isRunning) return;
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  if (!paused) convertStep();
}

function togglePrecedencePanel() {
  document.getElementById("precedenceSidebar").classList.toggle("open");
}