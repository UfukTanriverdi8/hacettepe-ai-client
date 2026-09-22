import Typewriter from "typewriter-effect"

const Header = () => {
    return (
        <div className="flex justify-center items-center py-1 border-b-2 border-secondary">
        <h1 className="text-center text-black-text text-2xl sm:text-3xl md:text-4xl font-mono">
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
        </div>
    )
}

export default Header
