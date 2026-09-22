import { Button } from '@/components/ui/button'
import DeerMark from './DeerMark'

// Deliberately bilingual: it can only appear before the app is up, and it is the one screen a
// visitor cannot fix by finding the language setting.
const ConfigErrorScreen = ({ onRetry }: { onRetry: () => void }) => {
    return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background p-4 text-center">
            <DeerMark className="size-12 text-primary" />
            <div className="flex flex-col gap-1">
                <p>Uygulama yapılandırması yüklenemedi. Lütfen tekrar deneyin.</p>
                <p className="text-muted-foreground" lang="en">Failed to load app configuration. Please try again.</p>
            </div>
            <Button onClick={onRetry} size="lg" className="px-4">
                Tekrar dene / Retry
            </Button>
        </div>
    )
}

export default ConfigErrorScreen
