// Drives src/citations.ts's placeCitations() over real mdast, with no DOM and no React render.
//
//     node scripts/check-citations.mjs
//
// The trees come from the parser stack react-markdown runs (micromark + gfm), so a node's
// position here is the position ChatMessage sees. Placement fails quietly when it fails: a
// bubble one paragraph too early still looks like a bubble, and only a fixture catches it.

import assert from 'node:assert/strict'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { toString } from 'mdast-util-to-string'
import { gfm } from 'micromark-extension-gfm'
// A .ts import, run under Node's built-in type stripping (Node 22.18+ / 23.6+).
import { placeCitations } from '../src/citations.ts'

const parse = (markdown) =>
    fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })

const source = (n, kind = 'document') => ({
    n,
    url: `https://example.edu.tr/${n}`,
    title: `Source ${n}`,
    kind,
})

/** Where an offset lands: just past the first occurrence of `marker` in the markdown. */
const after = (markdown, marker) => {
    const at = markdown.indexOf(marker)
    assert.ok(at >= 0, `fixture is missing ${marker}`)
    return at + marker.length
}

/** Each bubble group as [text of the block it sits in, its numbers], in document order. */
const place = (markdown, sources, citations) => {
    const tree = parse(markdown)
    placeCitations(tree, sources, citations)
    const found = []
    const walk = (node) => {
        for (const child of node.children ?? []) {
            if (child.type === 'citations')
                found.push([toString(node).trim(), child.data.hProperties.dataCite])
            else walk(child)
        }
    }
    walk(tree)
    return found
}

// 1. A passage ending on a paragraph's last character goes on that paragraph, not the next.
{
    const md = 'Staj 40 iş günü.\n\nİki dönemde yapılır.'
    assert.deepEqual(
        place(
            md,
            [source(1), source(2)],
            [
                { offset: after(md, 'günü.'), n: [1] },
                { offset: md.length, n: [2] },
            ],
        ),
        [
            ['Staj 40 iş günü.', '1'],
            ['İki dönemde yapılır.', '2'],
        ],
    )
}

// 2. Several citations in one paragraph merge into one group, deduplicated and sorted.
{
    const md = 'Birinci cümle. İkinci cümle. Üçüncü cümle.'
    assert.deepEqual(
        place(
            md,
            [source(1), source(2), source(3)],
            [
                { offset: after(md, 'Birinci cümle.'), n: [3] },
                { offset: after(md, 'İkinci cümle.'), n: [1, 3] },
                { offset: md.length, n: [2] },
            ],
        ),
        [[md, '1,2,3']],
    )
}

// 3. An offset in the gap between blocks belongs to the block before the gap.
{
    const md = 'Birinci paragraf.\n\nİkinci paragraf.'
    assert.deepEqual(place(md, [source(1)], [{ offset: after(md, 'paragraf.\n'), n: [1] }]), [
        ['Birinci paragraf.', '1'],
    ])
}

// 4. A list item gets its bubble at the end of its own text, before its nested list.
{
    const md = '- Kabul yazısı\n  - imzalı\n- Başvuru formu'
    assert.deepEqual(
        place(
            md,
            [source(1), source(2)],
            [
                { offset: after(md, 'Kabul yazısı'), n: [1] },
                { offset: md.length, n: [2] },
            ],
        ),
        [
            ['Kabul yazısı', '1'],
            ['Başvuru formu', '2'],
        ],
    )
}

// 5. An offset inside inline markup still finds the paragraph around it.
{
    const md = 'Toplam **40 iş günü** staj gerekir.'
    assert.deepEqual(place(md, [source(1)], [{ offset: after(md, '40 iş'), n: [1] }]), [
        ['Toplam 40 iş günü staj gerekir.', '1'],
    ])
}

// 6. Headings and table cells are blocks too.
{
    const md = '## Şartlar\n\n| Belge | Süre |\n| --- | --- |\n| Form | 15 gün |'
    assert.deepEqual(
        place(
            md,
            [source(1), source(2)],
            [
                { offset: after(md, 'Şartlar'), n: [1] },
                { offset: after(md, '15 gün'), n: [2] },
            ],
        ),
        [
            ['Şartlar', '1'],
            ['15 gün', '2'],
        ],
    )
}

// 7. A source with no citation entry (an uncited live fetch) goes on the last block, merged
// with whatever else is there.
{
    const md = 'Birinci.\n\nSon paragraf.'
    assert.deepEqual(place(md, [source(1), source(2, 'live')], [{ offset: md.length, n: [1] }]), [
        ['Son paragraf.', '1,2'],
    ])
}

// 8. Offsets count UTF-16 units, as the backend sends them: an emoji before the passage shifts
// it by two, and the bubble still lands on the right paragraph.
{
    const md = '🦌 Birinci.\n\nİkinci.'
    assert.equal(after(md, 'Birinci.'), '🦌 Birinci.'.length)
    assert.deepEqual(place(md, [source(1)], [{ offset: after(md, 'Birinci.'), n: [1] }]), [
        ['🦌 Birinci.', '1'],
    ])
}

// 9. An offset past the end (the answer and the offsets disagreed) degrades to the last block
// instead of disappearing.
{
    const md = 'Tek paragraf.'
    assert.deepEqual(place(md, [source(1)], [{ offset: 999, n: [1] }]), [[md, '1']])
}

// 10. Empty lists, the greeting and refusal case, add nothing.
{
    assert.deepEqual(place('Merhaba!', [], []), [])
}

// 11. A number with no matching source is dropped rather than shown as a dead bubble.
{
    const md = 'Paragraf.'
    assert.deepEqual(place(md, [source(1)], [{ offset: md.length, n: [1, 7] }]), [[md, '1']])
}

// 12. An answer with no text blocks at all (a lone code block) has nowhere to put bubbles.
{
    assert.deepEqual(place('```\nkod\n```', [source(1)], [{ offset: 3, n: [1] }]), [])
}

console.log('check-citations: all cases pass')
