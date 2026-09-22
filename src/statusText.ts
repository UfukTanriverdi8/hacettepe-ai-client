import { BookOpen, Globe, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Language } from './types'

// The backend's status strings are English and defined in app/agent/tool_specs.py
// (STATUS_MESSAGES and POST_TOOL_STATUS). They are stored raw on the message and looked up here
// at render time, so switching language mid-answer re-words the line too.
const STATUS: Record<string, { TR: string; EN: string; icon: LucideIcon }> = {
    'searching the knowledge base...': {
        TR: 'Hacettepe kaynakları taranıyor...',
        EN: 'Searching the knowledge base...',
        icon: Search,
    },
    'fetching a live page...': {
        TR: 'Güncel sayfa çekiliyor...',
        EN: 'Fetching a live page...',
        icon: Globe,
    },
    // Sent once a tool's results are back, covering the stretch where the model is reasoning
    // over them and nothing is on screen yet. Without it the tool's own status stays up for
    // ~8s, claiming a search is still running after it finished.
    'going through the results...': {
        TR: 'Sonuçlar inceleniyor...',
        EN: 'Going through the results...',
        icon: BookOpen,
    },
}

// An unmapped status falls through to the raw string and no icon, so a tool added server-side
// shows something rather than nothing until this map catches up.
export function describeStatus(status: string, language: Language): { text: string; icon?: LucideIcon } {
    const known = STATUS[status]
    return known ? { text: known[language], icon: known.icon } : { text: status }
}
