import { useEffect, useRef, useState } from 'react'

export function useCyclingText(messages: readonly string[]): string {
    const [displayedText, setDisplayedText] = useState('')
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        let msgIndex = 0
        let charIndex = 0
        setDisplayedText('')

        const typeNext = () => {
            const currentMsg = messages[msgIndex]
            if (charIndex < currentMsg.length) {
                const char = currentMsg[charIndex]
                setDisplayedText(currentMsg.slice(0, charIndex + 1))
                charIndex++
                timeoutRef.current = setTimeout(typeNext, char === '.' ? 220 : 45)
            } else {
                timeoutRef.current = setTimeout(() => {
                    msgIndex = (msgIndex + 1) % messages.length
                    charIndex = 0
                    setDisplayedText('')
                    typeNext()
                }, 700)
            }
        }
        typeNext()

        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
    }, [messages])

    return displayedText
}
