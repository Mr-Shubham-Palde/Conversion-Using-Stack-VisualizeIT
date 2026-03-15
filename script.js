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

function render() {
  stackContainer.innerHTML = "";
  outputContainer.innerHTML = "";

  stack.forEach(item => {
    const node = document.createElement("div");
    node.className = "stack-node";
    
    // Add color class based on operator type
    if (item === '^') {
      node.classList.add('op-high');
    } else if (item === '*' || item === '/') {
      node.classList.add('op-med');
    } else if (item === '+' || item === '-') {
      node.classList.add('op-low');
    } else if (item === '(' || item === ')') {
      node.classList.add('paren');
    } else {
      node.classList.add('operand');
    }
    
    node.textContent = item;
    stackContainer.appendChild(node);
  });

  // Color output characters
  for (let char of output) {
    const span = document.createElement("span");
    if (char === '^') {
      span.className = 'output-op-high';
    } else if (char === '*' || char === '/') {
      span.className = 'output-op-med';
    } else if (char === '+' || char === '-') {
      span.className = 'output-op-low';
    } else if (char === '(' || char === ')') {
      span.className = 'output-paren';
    } else {
      span.className = 'output-operand';
    }
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

    while (stack.length > 0) {
      output += stack.pop();
    }

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

  if (/[a-zA-Z0-9]/.test(token)) {
    output += token;
    stepText.textContent = `Operand '${token}' → Output (Operands are always added directly to output)`;
  }

  else if (token === '(') {
    stack.push(token);
    stepText.textContent = "Left parenthesis '(' pushed to stack (Marks start of subexpression)";
  }

  else if (token === ')') {
    while (stack.length && stack[stack.length - 1] !== '(') {
      output += stack.pop();
    }
    stack.pop(); // remove the '('
    stepText.textContent = "Right parenthesis ')': Popped operators until '(' found, then removed '('";
  }

  else {
    let poppedOps = [];
    while (
      stack.length &&
      precedence(stack[stack.length - 1]) >= precedence(token)
    ) {
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
  if (!paused) {
    setTimeout(convertStep, speed);
  }
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
  if (!paused) {
    // Resume by calling convertStep again
    convertStep();
  }
}

function togglePrecedence() {
  const sidebar = document.getElementById("precedenceSidebar");
  sidebar.classList.toggle("visible");
}
