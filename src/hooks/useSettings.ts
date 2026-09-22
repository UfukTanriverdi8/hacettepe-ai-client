import { useEffect, useState } from 'react'
import type { Language, ThemePreference } from '../types'

// index.html's inline script reads the same two keys before React loads, so the first paint is
// already in the right theme. Change a key or a value here and change it there too.
const THEME_KEY = 'theme'
const LANGUAGE_KEY = 'ui-language'

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark']
const LANGUAGES: readonly Language[] = ['TR', 'EN']

function readSetting<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
    const value = localStorage.getItem(key)
    return allowed.includes(value as T) ? (value as T) : fallback
}

export function useSettings() {
    const [theme, setTheme] = useState<ThemePreference>(() => readSetting(THEME_KEY, THEMES, 'system'))
    const [language, setLanguage] = useState<Language>(() => readSetting(LANGUAGE_KEY, LANGUAGES, 'TR'))

    useEffect(() => {
        localStorage.setItem(THEME_KEY, theme)
        const media = matchMedia('(prefers-color-scheme: dark)')
        const apply = () => {
            document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches))
        }
        apply()
        if (theme !== 'system') return
        // 'system' tracks an OS switch (or a sunset schedule) without a reload.
        media.addEventListener('change', apply)
        return () => media.removeEventListener('change', apply)
    }, [theme])

    useEffect(() => {
        localStorage.setItem(LANGUAGE_KEY, language)
        document.documentElement.lang = language === 'TR' ? 'tr' : 'en'
    }, [language])

    // The EN/TR toggle removed in 2.3.0 stored its choice under 'language'. The setting lives
    // under a new key so that stale choice cannot come back as the user's current one.
    useEffect(() => {
        localStorage.removeItem('language')
    }, [])

    return { theme, setTheme, language, setLanguage }
}
