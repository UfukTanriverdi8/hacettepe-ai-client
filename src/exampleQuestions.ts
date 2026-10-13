import type { Language } from './types'

// How many chips the empty screen shows. App draws this many from the pool of the current language.
export const EXAMPLE_COUNT = 3

// Every question below was sent to the deployed /chat on 2026-10-13 and came back with an answer, in
// the question's language and with sources. Send a new one the same way before adding it. Time-bound
// wording ("this term", a year) answers unreliably: the current academic calendar came back stale or
// as "no information" in most runs, so none of these asks for one.
//
// English is written for international students, Turkish for Turkish students, so the lists are not
// translations of each other.
export const EXAMPLE_POOL: Record<Language, readonly string[]> = {
    EN: [
        'How do I apply to Hacettepe as an international student?',
        'Do I need a student visa to study at Hacettepe?',
        'How do I get a residence permit as an international student in Turkey?',
        'Do I have to spend my first year learning Turkish before starting my degree?',
        'What scholarships are available for international students?',
        'How does the Erasmus exchange work for incoming students?',
        'Is there an English preparatory program, and how do I get exempted from it?',
        'How do I get a student ID card?',
        'How do I register for courses each semester?',
        'Which undergraduate programs are taught in English?',
    ],
    TR: [
        'Yatay geçiş için gerekli şartlar nelerdir?',
        'Çift anadal yapmak için neler gerekiyor?',
        'Tıp programında İngilizce hazırlık sınıfı zorunlu mu?',
        "Hacettepe'de burs ve öğrenci yardımı imkânları nelerdir?",
        "Endüstri Mühendisliği'nde zorunlu staj nasıl yapılır?",
        'Erasmus ile yurt dışına gitmek için başvuru şartları nelerdir?',
        "Beytepe kampüsündeki barınma ve yurt imkânları nelerdir?",
        'Yaz okulunda ders almak için ne yapmam gerekiyor?',
        'Kayıt dondurma nasıl yapılır?',
        'Mezuniyet için gerekli şartlar nelerdir?',
    ],
}

/**
 * `count` distinct entries of `pool` in random order, by a partial Fisher-Yates over a copy, so the
 * pool itself is never reordered. A count past the pool's size returns all of it. `random` is a
 * parameter so scripts/check-example-questions.mjs can seed it.
 */
export function pickRandom<T>(pool: readonly T[], count: number, random: () => number = Math.random): T[] {
    const items = [...pool]
    const n = Math.min(Math.max(count, 0), items.length)
    for (let i = 0; i < n; i++) {
        const j = i + Math.floor(random() * (items.length - i))
        const swapped = items[i]
        items[i] = items[j]
        items[j] = swapped
    }
    return items.slice(0, n)
}
