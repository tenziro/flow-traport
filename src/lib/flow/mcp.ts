/**
 * flow MCP 클라이언트 (PRD §5.1, 부록 A).
 *
 * 전송은 Streamable HTTP — POST 하나에 JSON-RPC를 싣고, 응답은 SSE로 온다.
 * initialize 없이 tools/call 하면 400 "Server not initialized"이므로
 * 첫 호출 때 한 번 initialize하고 mcp-session-id를 재사용한다.
 * (실측: 전체 왕복 59ms, 세션 재사용 11ms, notifications/initialized는 생략 가능)
 *
 * 화면 코드는 이 파일 밖으로 JSON-RPC를 보지 않는다.
 */

const MCP_URL = "https://flow.team/ai/mcp";
const PROTOCOL_VERSION = "2025-06-18";

export class FlowMcpError extends Error {}

/** 요청 1건 동안 재사용할 MCP 세션. serverless라 요청 간 공유는 하지 않는다. */
export type FlowMcp = ReturnType<typeof createFlowMcp>;

export function createFlowMcp(accessToken: string) {
  let sessionId: string | null = null;
  let handshake: Promise<void> | null = null;
  let nextId = 1;

  async function send(body: unknown): Promise<unknown> {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    sessionId ??= res.headers.get("mcp-session-id");

    const text = await res.text();
    if (!res.ok) throw new FlowMcpError(`MCP ${res.status}: ${text.slice(0, 200)}`);
    return parseSse(text);
  }

  async function ready() {
    handshake ??= send({
      jsonrpc: "2.0",
      id: nextId++,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "flow-cockpit", version: "0.1" },
      },
    }).then(() => undefined);
    return handshake;
  }

  return {
    /**
     * 도구 하나를 호출하고 `structuredContent`를 돌려준다.
     *
     * 타입 인자는 검증이 아니라 호출부 편의다. 응답 형태가 바뀌면 여기가 아니라
     * 이 값을 쓰는 쪽에서 터진다 — PRD R3(계약 불안정)의 대가.
     */
    async call<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
      await ready();
      const res = (await send({
        jsonrpc: "2.0",
        id: nextId++,
        method: "tools/call",
        params: { name, arguments: args },
      })) as JsonRpcResponse<ToolResult>;

      if (res.error) throw new FlowMcpError(`${name}: ${res.error.message}`);
      const result = res.result;
      if (!result) throw new FlowMcpError(`${name}: 빈 응답`);
      if (result.isError) throw new FlowMcpError(`${name}: ${textOf(result) || "도구 오류"}`);

      // 집계 도구는 structuredContent를 주고, 일부 도구는 text에 JSON만 담아 준다.
      if (result.structuredContent !== undefined) return result.structuredContent as T;
      const text = textOf(result);
      if (!text) throw new FlowMcpError(`${name}: 구조화 응답 없음`);
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new FlowMcpError(`${name}: JSON이 아닌 응답`);
      }
    },
  };
}

interface JsonRpcResponse<T> {
  result?: T;
  error?: { code: number; message: string };
}

interface ToolResult {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

function textOf(result: ToolResult): string {
  return result.content?.find((c) => c.type === "text")?.text ?? "";
}

/**
 * SSE 본문에서 첫 message 이벤트의 payload를 꺼낸다.
 *
 * ponytail: 요청당 응답이 1건이라 첫 `data:` 줄만 본다. 스트리밍 응답(부분 결과 다건)을
 * 쓰게 되면 전체 이벤트를 순회하도록 바꿔야 한다.
 */
function parseSse(body: string): unknown {
  const line = body.split("\n").find((l) => l.startsWith("data: "));
  if (!line) throw new FlowMcpError(`SSE 형식이 아님: ${body.slice(0, 200)}`);
  return JSON.parse(line.slice(6));
}
