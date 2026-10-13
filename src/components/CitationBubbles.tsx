import { useRef, useState } from 'react'
import { FileText, Globe, Radio } from 'lucide-react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import type { Language, Source } from '../types'

const KIND_ICON = { webpage: Globe, document: FileText, live: Radio } as const

// Source URLs arrive percent-encoded (the scraper normalizes them that way), so a Turkish or
// German path reads as %C3%B6. Decode for display only; href keeps the encoded form.
const displayUrl = (url: string) => {
    const bare = url.replace(/^https?:\/\//, '')
    try {
        return decodeURI(bare)
    } catch {
        return bare // malformed %-sequence
    }
}

// The backend sends the URL as the title when a page has none.
const hasTitle = (source: Source) => Boolean(source.title) && source.title !== source.url

const bubbleLabel = (source: Source, language: Language) => {
    const live = source.kind === 'live' ? (language === 'TR' ? ' (canlı sayfa)' : ' (live page)') : ''
    const name = hasTitle(source) ? source.title : displayUrl(source.url)
    return `${language === 'TR' ? 'Kaynak' : 'Source'} ${source.n}: ${name}${live}`
}

// Mouse: hover previews, a click on the bubble opens the source. Keyboard: focus previews,
// Enter opens. Touch has no hover, so the first tap previews instead of leaving the page, and
// the card itself is the link: a phone user sees where they are going before they go.
const CitationBubble = ({ source, language }: { source: Source; language: Language }) => {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef<HTMLAnchorElement>(null)
    // Read on click, where the event type differs across browsers (Safari's click is not a
    // PointerEvent). A keyboard Enter fires click with no pointerdown before it, so the ref is
    // reset after every click to keep a stale 'touch' from swallowing it.
    const pointerType = useRef('')
    const Icon = KIND_ICON[source.kind]
    const live = source.kind === 'live'

    return (
        <HoverCard open={open} onOpenChange={setOpen} openDelay={150} closeDelay={200}>
            <HoverCardTrigger asChild>
                <a
                    ref={triggerRef}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={bubbleLabel(source, language)}
                    onPointerDown={(e) => {
                        pointerType.current = e.pointerType
                    }}
                    onClick={(e) => {
                        if (pointerType.current === 'touch') {
                            e.preventDefault()
                            setOpen((o) => !o)
                        }
                        pointerType.current = ''
                    }}
                    className={`cite inline-grid size-5 place-items-center rounded-full border text-[11px] leading-none font-medium tabular-nums no-underline transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
                        live
                            ? 'border-primary/40 bg-primary/10 text-primary hover:border-primary data-[state=open]:border-primary'
                            : 'bg-muted text-muted-foreground hover:border-muted-foreground hover:text-foreground data-[state=open]:border-muted-foreground data-[state=open]:text-foreground'
                    }`}
                >
                    {source.n}
                </a>
            </HoverCardTrigger>
            <HoverCardContent
                align="start"
                sideOffset={6}
                collisionPadding={16}
                className="w-[min(20rem,calc(100vw-2rem))] p-0"
                // DismissableLayer counts the trigger as outside the card, so a second tap on
                // the bubble would close the card and the click after it reopen it at once.
                onPointerDownOutside={(e) => {
                    if (triggerRef.current?.contains(e.target as Node)) e.preventDefault()
                }}
            >
                <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                    <Icon
                        aria-hidden="true"
                        className={`mt-0.5 size-4 shrink-0 ${live ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                    <span className="min-w-0">
                        {/* Without a real title the URL line below already names the page. */}
                        {hasTitle(source) && (
                            <span className="block leading-snug font-medium">{source.title}</span>
                        )}
                        <span className="mt-0.5 block text-xs break-all text-muted-foreground">
                            {displayUrl(source.url)}
                        </span>
                    </span>
                </a>
            </HoverCardContent>
        </HoverCard>
    )
}

interface CitationBubblesProps {
    // Already deduplicated and sorted by placeCitations.
    numbers: number[]
    sources: Source[]
    language: Language
}

const CitationBubbles = ({ numbers, sources, language }: CitationBubblesProps) => (
    <span className="ml-1.5 inline-flex animate-in gap-[3px] whitespace-nowrap align-[1px] duration-300 fade-in zoom-in-75 motion-reduce:animate-none">
        {numbers.map((n) => {
            const source = sources.find((s) => s.n === n)
            return source && <CitationBubble key={n} source={source} language={language} />
        })}
    </span>
)

export default CitationBubbles
