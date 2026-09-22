import { GiDeerHead } from "react-icons/gi"

const ConfigErrorScreen = ({ onRetry }) => {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-primary/85 text-tertiary p-4 text-center">
            <GiDeerHead className="text-5xl text-secondary mb-4" />
            <p className="mb-1">Uygulama yapılandırması yüklenemedi. Lütfen tekrar deneyin.</p>
            <p className="mb-4 text-[#9ca3af]">Failed to load app configuration. Please try again.</p>
            <button
                onClick={onRetry}
                className="bg-secondary text-tertiary px-4 py-2 rounded-md transition-all hover:bg-secondary-red duration-300 focus:outline-hidden focus:ring-2"
            >
                Tekrar dene / Retry
            </button>
        </div>
    )
}

export default ConfigErrorScreen
