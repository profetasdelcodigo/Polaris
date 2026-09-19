import { PolarisError } from "../../errors.js";

type Token = { type: "number"; value: number } | { type: "operator"; value: "+" | "-" | "*" | "/" | "(" | ")" };

function tokenize(expression: string): Token[] {
  if (expression.length > 200) {
    throw new PolarisError("VALIDATION_ERROR", "La expresión es demasiado larga.", 400);
  }

  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const character = expression[index];
    if (!character) break;
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(character)) {
      const start = index;
      while (index < expression.length && /[0-9.]/.test(expression[index] ?? "")) index += 1;
      const source = expression.slice(start, index);
      if (!/^\d+(?:\.\d+)?$/.test(source)) {
        throw new PolarisError("VALIDATION_ERROR", "La expresión contiene un número inválido.", 400);
      }
      const value = Number(source);
      if (!Number.isFinite(value)) {
        throw new PolarisError("VALIDATION_ERROR", "La expresión contiene un número inválido.", 400);
      }
      tokens.push({ type: "number", value });
      continue;
    }
    if ("+-*/()".includes(character)) {
      tokens.push({ type: "operator", value: character as "+" | "-" | "*" | "/" | "(" | ")" });
      index += 1;
      continue;
    }
    throw new PolarisError("VALIDATION_ERROR", "La calculadora solo acepta números y +, -, *, /, ( ).", 400);
  }
  return tokens;
}

export function calculateExpression(expression: string): number {
  const tokens = tokenize(expression);
  let current = 0;

  function peek(): Token | undefined {
    return tokens[current];
  }

  function consume(): Token {
    const token = tokens[current];
    if (!token) throw new PolarisError("VALIDATION_ERROR", "La expresión está incompleta.", 400);
    current += 1;
    return token;
  }

  function parsePrimary(): number {
    const token = consume();
    if (token.type === "number") return token.value;
    if (token.value === "-") return -parsePrimary();
    if (token.value === "(") {
      const result = parseExpression();
      const closing = consume();
      if (closing.type !== "operator" || closing.value !== ")") {
        throw new PolarisError("VALIDATION_ERROR", "Falta cerrar un paréntesis.", 400);
      }
      return result;
    }
    throw new PolarisError("VALIDATION_ERROR", "La expresión no es válida.", 400);
  }

  function parseTerm(): number {
    let result = parsePrimary();
    while (peek()?.type === "operator" && (peek()?.value === "*" || peek()?.value === "/")) {
      const operator = consume().value;
      const right = parsePrimary();
      if (operator === "/") {
        if (right === 0) throw new PolarisError("VALIDATION_ERROR", "No se puede dividir entre cero.", 400);
        result /= right;
      } else {
        result *= right;
      }
    }
    return result;
  }

  function parseExpression(): number {
    let result = parseTerm();
    while (peek()?.type === "operator" && (peek()?.value === "+" || peek()?.value === "-")) {
      const operator = consume().value;
      const right = parseTerm();
      result = operator === "+" ? result + right : result - right;
    }
    return result;
  }

  if (tokens.length === 0) {
    throw new PolarisError("VALIDATION_ERROR", "La expresión no puede estar vacía.", 400);
  }
  const result = parseExpression();
  if (current !== tokens.length || !Number.isFinite(result)) {
    throw new PolarisError("VALIDATION_ERROR", "La expresión no es válida.", 400);
  }
  return result;
}
