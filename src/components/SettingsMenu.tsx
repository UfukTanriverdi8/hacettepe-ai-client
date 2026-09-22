import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Language, ThemePreference } from '../types'

interface SettingsMenuProps {
    theme: ThemePreference
    setTheme: (theme: ThemePreference) => void
    language: Language
    setLanguage: (language: Language) => void
}

// Selected segment lifts onto the popover color, the rest sit on the muted track.
const segmentItem = 'flex-1 h-7 text-[13px] font-normal text-muted-foreground hover:bg-transparent data-[state=on]:bg-popover data-[state=on]:font-medium data-[state=on]:text-foreground data-[state=on]:shadow-sm'

const SettingsMenu = ({ theme, setTheme, language, setLanguage }: SettingsMenuProps) => {
    const tr = language === 'TR'
    const label = tr ? 'Ayarlar' : 'Settings'

    return (
        <Popover>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={label} className="text-muted-foreground">
                            <SlidersHorizontal className="size-[18px]" />
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" sideOffset={6} className="w-64 gap-4 rounded-xl p-3.5">
                <div className="flex flex-col gap-2">
                    <p id="settings-theme" className="text-xs font-medium text-muted-foreground">{tr ? 'Tema' : 'Theme'}</p>
                    <ToggleGroup
                        type="single"
                        value={theme}
                        // Radix reports '' when the pressed item is clicked again; a segmented
                        // control always has one value, so that click is ignored.
                        onValueChange={value => { if (value) setTheme(value as ThemePreference) }}
                        aria-labelledby="settings-theme"
                        spacing={0}
                        className="w-full rounded-lg bg-muted p-[3px]"
                    >
                        <ToggleGroupItem value="system" className={segmentItem}>{tr ? 'Sistem' : 'System'}</ToggleGroupItem>
                        <ToggleGroupItem value="light" className={segmentItem}>{tr ? 'Açık' : 'Light'}</ToggleGroupItem>
                        <ToggleGroupItem value="dark" className={segmentItem}>{tr ? 'Koyu' : 'Dark'}</ToggleGroupItem>
                    </ToggleGroup>
                </div>
                <div className="flex flex-col gap-2">
                    <p id="settings-language" className="text-xs font-medium text-muted-foreground">{tr ? 'Dil' : 'Language'}</p>
                    <ToggleGroup
                        type="single"
                        value={language}
                        onValueChange={value => { if (value) setLanguage(value as Language) }}
                        aria-labelledby="settings-language"
                        spacing={0}
                        className="w-full rounded-lg bg-muted p-[3px]"
                    >
                        {/* Each language names itself, so someone who switched by mistake can
                            still find the way back. */}
                        <ToggleGroupItem value="TR" lang="tr" className={segmentItem}>Türkçe</ToggleGroupItem>
                        <ToggleGroupItem value="EN" lang="en" className={segmentItem}>English</ToggleGroupItem>
                    </ToggleGroup>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                    {tr
                        ? 'Dil yalnızca arayüzü değiştirir. Asistan, sorunuzun dilinde yanıt verir.'
                        : 'Language changes the interface only. The assistant answers in the language of your question.'}
                </p>
            </PopoverContent>
        </Popover>
    )
}

export default SettingsMenu
