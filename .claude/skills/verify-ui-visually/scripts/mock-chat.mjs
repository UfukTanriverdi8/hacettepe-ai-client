// A stand-in for the backend's /chat, so the UI can be driven with no AWS and no real model.
//
//     node mock-chat.mjs [--port 8010] [--mode <mode>]
//
// It answers every POST /chat with the same NDJSON a real stream carries (src/types.ts), and
// prints each request body, so the log shows what the client sent.
//   answer    session, two statuses, a Markdown answer in token chunks, one cited source, done
//   error     session, then an `error` event
//   fallback  what the backend sends when its tool loop runs out of turns
//   slow      like answer, but a 400ms gap between lines, to prove streaming is unbuffered
//   ratelimit answers 429 with no body, like WAF's ChatRateLimit
//   cutoff    answer up to its third token, then the connection drops
//   nodone    every answer event except done, then a clean end
//   unsaved   answer, but done carries no timestamp (the server's write failed)
//   discard-cutoff  two tokens, a discard, then the connection drops
//   empty     session and one status, then a clean end with no text and no done
// A question starting with #<mode> (say "#cutoff hello") uses that mode for that request only, so
// one mock covers every path without a restart.
// Any other request path answers 404, like a backend with no such route.

import http from 'node:http'

const args = process.argv.slice(2)
const option = (name, fallback) => {
    const at = args.indexOf(`--${name}`)
    return at >= 0 ? args[at + 1] : fallback
}
const port = Number(option('port', 8010))
const mode = option('mode', 'answer')

const text = 'Tamam, bu bir deneme yanıtıdır.\n\nİkinci paragraf, bir kaynağa dayanıyor.'
const answer = [
    { type: 'session', session_id: 'mock-session' },
    { type: 'status', message: 'searching the knowledge base...' },
    { type: 'status', message: 'going through the results...' },
    ...text.match(/.{1,12}/gs).map((chunk) => ({ type: 'token', text: chunk })),
    {
        type: 'sources',
        sources: [{ n: 1, url: 'https://example.edu.tr/kaynak', title: 'Örnek kaynak', kind: 'webpage' }],
        // The offset is where the cited passage ends in the joined token text.
        citations: [{ offset: text.length, n: [1] }],
    },
    { type: 'done', timestamp: new Date().toISOString() },
]

const streams = {
    answer,
    slow: answer,
    error: [
        { type: 'session', session_id: 'mock-session' },
        { type: 'error', message: 'Mock backend error' },
    ],
    fallback: [
        { type: 'session', session_id: 'mock-session' },
        { type: 'status', message: 'searching the knowledge base...' },
        { type: 'status', message: 'going through the results...' },
        { type: 'token', text: "I don't have information on that." },
        { type: 'sources', sources: [], citations: [] },
        { type: 'done', timestamp: new Date().toISOString() },
    ],
    nodone: answer.filter((event) => event.type !== 'done'),
    unsaved: answer.map((event) => (event.type === 'done' ? { type: 'done' } : event)),
    cutoff: answer.slice(0, answer.findIndex((event) => event.type === 'token') + 3),
    'discard-cutoff': [
        { type: 'session', session_id: 'mock-session' },
        { type: 'status', message: 'searching the knowledge base...' },
        { type: 'token', text: 'Let me check ' },
        { type: 'token', text: 'the live page.' },
        { type: 'discard' },
    ],
    empty: [
        { type: 'session', session_id: 'mock-session' },
        { type: 'status', message: 'searching the knowledge base...' },
    ],
    ratelimit: [],
}
// Modes whose stream ends with a dropped connection rather than a clean end.
const DROPPED = new Set(['cutoff', 'discard-cutoff'])
if (!streams[mode]) {
    console.error(`unknown mode "${mode}", use one of: ${Object.keys(streams).join(', ')}`)
    process.exit(1)
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

http.createServer((req, res) => {
    // CORS, so a page can reach the mock directly: Vite's proxy keeps the browser's connection
    // open after the mock drops its own, which hides the cutoff and discard-cutoff modes.
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') {
        res.writeHead(204).end()
        return
    }
    if (!req.url.startsWith('/chat') || req.method !== 'POST') {
        res.writeHead(404).end()
        return
    }
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', async () => {
        console.log('POST /chat', body)
        let requestMode = mode
        try {
            const tag = /^#(\S+)/.exec(JSON.parse(body).message ?? '')?.[1]
            if (tag && streams[tag]) requestMode = tag
        } catch {
            // Not JSON: keep the default mode.
        }
        if (requestMode === 'ratelimit') {
            res.writeHead(429).end()
            return
        }
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
        for (const event of streams[requestMode]) {
            res.write(JSON.stringify(event) + '\n')
            if (requestMode === 'slow') await pause(400)
        }
        // A pause before the drop, so the written lines reach the client as data first.
        if (DROPPED.has(requestMode)) setTimeout(() => res.destroy(), 200)
        else res.end()
    })
}).listen(port, () => console.log(`mock /chat (${mode}) on :${port}`))
