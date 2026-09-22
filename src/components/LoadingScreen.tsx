import DeerMark from './DeerMark'
import { useCyclingText } from '../hooks/useCyclingText'
import type { Language } from '../types'

// Module-level so the arrays keep their identity: useCyclingText restarts when they change.
const LOADING_MESSAGES: Record<Language, readonly string[]> = {
    TR: ['Bağlanılıyor...', 'Yapılandırma yükleniyor...'],
    EN: ['Connecting...', 'Loading configuration...'],
}

const LoadingScreen = ({ language }: { language: Language }) => {
    const cyclingMsg = useCyclingText(LOADING_MESSAGES[language])

    return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background">
            <DeerMark className="size-12 animate-breathe text-primary" />
            <p className="text-muted-foreground">{cyclingMsg}</p>
        </div>
    )
}

export default LoadingScreen
