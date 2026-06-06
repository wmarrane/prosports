/**
 * Vitest global setup — run before every test file.
 * Patches globalThis.Response so that status codes like 204 accept an empty-string
 * body in tests (Node 22+ undici is strict about null-body status codes, but test
 * mocks legitimately use new Response('', { status: 204 })).
 */
const OriginalResponse = globalThis.Response

class PatchedResponse extends OriginalResponse {
  constructor(body?: BodyInit | null, init?: ResponseInit) {
    const nullBodyStatuses = [101, 103, 204, 205, 304]
    const status = init?.status ?? 200
    if (nullBodyStatuses.includes(status) && body === '') {
      super(null, init)
    } else {
      super(body, init)
    }
  }
}

globalThis.Response = PatchedResponse as typeof Response
