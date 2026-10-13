// A stand-in for the backend's /chat, so the UI can be driven with no AWS and no real model.
//
//     node mock-chat.mjs [--port 8010] [--mode answer|error|fallback|slow]
//
// It answers every POST /chat with the same NDJSON a real stream carries (src/types.ts), and
// prints each request body, so the log shows what the client sent.
//   answer    session, two statuses, a Markdown answer in token chunks, one cited source, done
//   error     session, then an `error` event
//   fallback  what the backend sends when its tool loop runs out of turns
//   slow      like answer, but a 400ms gap between lines, to prove streaming is unbuffered
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
}
if (!streams[mode]) {
    console.error(`unknown mode "${mode}", use one of: ${Object.keys(streams).join(', ')}`)
    process.exit(1)
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

http.createServer((req, res) => {
    if (!req.url.startsWith('/chat') || req.method !== 'POST') {
        res.writeHead(404).end()
        return
    }
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', async () => {
        console.log('POST /chat', body)
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
        for (const event of streams[mode]) {
            res.write(JSON.stringify(event) + '\n')
            if (mode === 'slow') await pause(400)
        }
        res.end()
    })
}).listen(port, () => console.log(`mock /chat (${mode}) on :${port}`))
