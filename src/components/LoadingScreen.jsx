import { GiDeerHead } from "react-icons/gi"
import { useCyclingText } from '../hooks/useCyclingText'

const LOADING_MESSAGES = ['🦌 Bağlanılıyor...', '⚙️ Yapılandırma yükleniyor...']

const LoadingScreen = () => {
    const cyclingMsg = useCyclingText(LOADING_MESSAGES)

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-primary bg-opacity-85 text-tertiary">
            <GiDeerHead className="text-5xl text-secondary mb-4" />
            <p className="text-[#9ca3af]">{cyclingMsg}</p>
        </div>
    )
}

export default LoadingScreen
