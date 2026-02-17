let stack = [];
let output = "";
let tokens = [];
let index = 0;
let speed = 1000;
let mode = "postfix";

const stackContainer = document.getElementById("stackContainer");
const outputContainer = document.getElementById("outputContainer");
const stepText = document.getElementById("stepText");
const expressionInput = document.getElementById("expressionInput");
const speedControl = document.getElementById("speedControl");
const speedLabel = document.getElementById("speedLabel");
const modeSelect = document.getElementById("mode");

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
  outputContainer.textContent = output;

  stack.forEach(item => {
    const node = document.createElement("div");
    node.className = "stack-node";
    node.textContent = item;
    stackContainer.appendChild(node);
  });
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
    stepText.textContent = "Conversion Complete!";
    return;
  }

  const token = tokens[index];

  if (/[a-zA-Z0-9]/.test(token)) {
    output += token;
    stepText.textContent = `Operand ${token} → Output`;
  }

  else if (token === '(') {
    stack.push(token);
    stepText.textContent = "Push ( to stack";
  }

  else if (token === ')') {
    while (stack.length && stack[stack.length - 1] !== '(') {
      output += stack.pop();
    }
    stack.pop();
    stepText.textContent = "Pop until (";
  }

  else {
    while (
      stack.length &&
      precedence(stack[stack.length - 1]) >= precedence(token)
    ) {
      output += stack.pop();
    }
    stack.push(token);
    stepText.textContent = `Operator ${token} handled`;
  }

  index++;
  render();
  setTimeout(convertStep, speed);
}

function resetAll() {
  stack = [];
  output = "";
  tokens = [];
  index = 0;
  render();
  stepText.textContent = "Reset Complete";
}
