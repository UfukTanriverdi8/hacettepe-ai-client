import Typewriter from "typewriter-effect"

const Header = ({language, handleLanguageChange}) => {
    return (
        <div className="flex justify-between items-center py-1 border-b-2 border-secondary">

        {/* Left — empty, balancing the language toggle so the title stays centered */}
        <div className="w-1/3" />

        {/* Center — title */}
        <h1 className="text-center text-black-text text-2xl sm:text-3xl md:text-4xl w-1/3 font-mono">
            <Typewriter
                onInit={(typewriter) => {
                    typewriter.typeString('hacettepe')
                    .pauseFor(300)
                    .typeString('<strong style="color: #b72e2e;"> ai</strong>')
                    .start()
                }}
                options={{
                    delay: "150",
                    deleteSpeed: "natural",
                    cursor: "_",
                }}
            />
        </h1>

        {/* Right — language toggle */}
        <div className="w-1/3 flex justify-end items-center mr-3 text-base gap-2">
            <div
                className="relative flex items-center cursor-pointer w-14 sm:w-16 h-7 sm:h-8 bg-black rounded-full"
                onClick={handleLanguageChange}
            >
                <div
                    className={`absolute w-7 sm:w-8 h-7 sm:h-8 bg-secondary rounded-full transition-transform duration-300 ${
                        language === 'TR' ? 'translate-x-7 sm:translate-x-8' : 'translate-x-0'
                    }`}
                />
                <span className={`absolute left-1 sm:left-2 text-tertiary text-sm ${language === 'EN' ? 'font-bold' : 'text-opacity-50'}`}>
                    EN
                </span>
                <span className={`absolute right-1 sm:right-2 text-tertiary text-sm ${language === 'TR' ? 'font-bold' : 'text-opacity-50'}`}>
                    TR
                </span>
            </div>
        </div>

        </div>
    )
}

export default Header
