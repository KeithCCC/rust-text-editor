type JsonToken = {
  type: "key" | "string" | "number" | "boolean" | "null" | "punctuation" | "plain";
  value: string;
};

type JsonCodeBlockProps = {
  source: string;
};

const JSON_TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\bnull\b|([{}[\],:])/g;

function tokenizeJson(source: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(JSON_TOKEN_PATTERN)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      tokens.push({ type: "plain", value: source.slice(lastIndex, index) });
    }

    const value = match[0];
    if (match[1]) {
      tokens.push({ type: "key", value });
    } else if (match[2]) {
      tokens.push({ type: "string", value });
    } else if (match[3]) {
      tokens.push({ type: "number", value });
    } else if (match[4]) {
      tokens.push({ type: "boolean", value });
    } else if (value === "null") {
      tokens.push({ type: "null", value });
    } else {
      tokens.push({ type: "punctuation", value });
    }

    lastIndex = index + value.length;
  }

  if (lastIndex < source.length) {
    tokens.push({ type: "plain", value: source.slice(lastIndex) });
  }

  return tokens;
}

export function JsonCodeBlock({ source }: JsonCodeBlockProps) {
  const tokens = tokenizeJson(source);

  return (
    <pre className="json-code-block">
      <code>
        {tokens.map((token, index) => (
          <span key={`${index}-${token.type}`} className={`json-token json-token-${token.type}`}>
            {token.value}
          </span>
        ))}
      </code>
    </pre>
  );
}
