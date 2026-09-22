import { Info, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import SettingsMenu from './SettingsMenu'
import type { Language, ThemePreference } from '../types'

interface HeaderProps {
    language: Language
    setLanguage: (language: Language) => void
    theme: ThemePreference
    setTheme: (theme: ThemePreference) => void
    hasChat: boolean
    onNewChat: () => void
    onInfoClick: () => void
}

const IconButton = ({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) => (
    <Tooltip>
        <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={label} onClick={onClick} className="text-muted-foreground">
                {children}
            </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
    </Tooltip>
)

const Header = ({ language, setLanguage, theme, setTheme, hasChat, onNewChat, onInfoClick }: HeaderProps) => {
    const tr = language === 'TR'

    return (
        <header className="flex shrink-0 items-center justify-between px-4 py-2.5 sm:px-5">
            <h1 className="text-lg font-semibold tracking-tight">
                hacettepe <span className="text-primary">ai</span>
            </h1>
            <div className="flex items-center gap-0.5">
                {/* Nothing to clear on an empty chat, so the button only appears once there is. */}
                {hasChat && (
                    <IconButton label={tr ? 'Yeni sohbet' : 'New chat'} onClick={onNewChat}>
                        <Plus className="size-[18px]" />
                    </IconButton>
                )}
                <SettingsMenu theme={theme} setTheme={setTheme} language={language} setLanguage={setLanguage} />
                <IconButton label={tr ? 'Hakkında' : 'About'} onClick={onInfoClick}>
                    <Info className="size-[18px]" />
                </IconButton>
            </div>
        </header>
    )
}

export default Header
