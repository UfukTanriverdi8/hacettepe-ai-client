import type { Nodes, Root } from 'mdast'
import type { Citation, Source } from './types'

// Places the numbered source bubbles in a parsed answer.
//
// A citation offset indexes the answer string, and remark's node positions index the same
// string, so an offset maps onto the block that contains it with no conversion: both count
// UTF-16 units. That holds only for the full answer, which is why ChatMessage adds this plugin
// once the reveal is complete and never to a partly revealed prefix.
//
// Bubbles go at the end of a block rather than at the offset itself. A number spliced in
// mid-sentence breaks the reading line, and the model's passages end mid-sentence often.

/** One bubble group, rendered by ChatMessage's `span` override from its data-cite attribute. */
interface CitationsNode {
    type: 'citations'
    children: []
    data: { hName: 'span'; hProperties: { dataCite: string } }
}

// Registered as both phrasing content (it goes inside a paragraph) and root content (so the
// `Nodes` union that tree walks narrow over includes it).
declare module 'mdast' {
    interface PhrasingContentMap {
        citations: CitationsNode
    }
    interface RootContentMap {
        citations: CitationsNode
    }
}

type Anchor = Extract<Nodes, { type: 'paragraph' | 'heading' | 'tableCell' }>

// The blocks a bubble can end. A list item's text is a paragraph inside it, so this covers list
// items too, and puts the bubble before a nested list rather than after it. None of these nest
// inside each other, so in document order they are disjoint and ascending.
const isAnchor = (node: Nodes): node is Anchor =>
    node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell'

const collectAnchors = (node: Nodes, anchors: Anchor[]) => {
    if (isAnchor(node)) {
        if (node.position) anchors.push(node)
        return
    }
    if ('children' in node) for (const child of node.children) collectAnchors(child, anchors)
}

/**
 * The block an offset belongs to: the one containing it, else the last one before it.
 *
 * `start < offset <= end`, because an offset marks where a passage ends: one equal to a
 * paragraph's end offset is that paragraph's last character, not the next paragraph's first.
 * An offset in a gap (the blank line between paragraphs, inside a code block) goes to the
 * block before the gap, the nearest text the reader has just finished.
 */
const anchorFor = (anchors: Anchor[], offset: number): Anchor => {
    let found = anchors[0]
    for (const anchor of anchors) {
        if (anchor.position!.start.offset! >= offset) break
        found = anchor
    }
    return found
}

/** Appends a bubble group to the end of each block that has a cited passage. Mutates `tree`. */
export const placeCitations = (tree: Root, sources: Source[], citations: Citation[]) => {
    const anchors: Anchor[] = []
    collectAnchors(tree, anchors)
    if (anchors.length === 0 || sources.length === 0) return

    const known = new Set(sources.map((source) => source.n))
    const byAnchor = new Map<Anchor, Set<number>>()
    const add = (anchor: Anchor, ns: number[]) => {
        const set = byAnchor.get(anchor) ?? new Set()
        for (const n of ns) if (known.has(n)) set.add(n)
        byAnchor.set(anchor, set)
    }

    for (const citation of citations) add(anchorFor(anchors, citation.offset), citation.n)
    // A page the model fetched but did not cite still informed the answer (a date it checked,
    // say), so the backend lists it with no citation entry. The last block is the closest thing
    // to "this whole answer".
    const cited = new Set(citations.flatMap((citation) => citation.n))
    add(
        anchors[anchors.length - 1],
        sources.map((source) => source.n).filter((n) => !cited.has(n)),
    )

    for (const [anchor, set] of byAnchor) {
        if (set.size === 0) continue
        anchor.children.push({
            type: 'citations',
            children: [],
            data: { hName: 'span', hProperties: { dataCite: [...set].sort((a, b) => a - b).join(',') } },
        })
    }
}

/** The remark plugin form of placeCitations, for ReactMarkdown's remarkPlugins. */
export const remarkCitations = (sources: Source[], citations: Citation[]) => () => (tree: Root) =>
    placeCitations(tree, sources, citations)
