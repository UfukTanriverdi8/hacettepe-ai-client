import { useState, useEffect } from "react";
import { FaRegCircleXmark } from "react-icons/fa6";

const InfoModal = ({ onClose, language }) => {
    const [displayedText, setDisplayedText] = useState("") // State to hold the currently displayed text
    const infoTitleTR = "Hakkında"
    const infoTitleEN = "About"
    const infoContentTR = 'Hacettepe AI, Hacettepe Üniversitesi öğrencileri için özel bir yapay zeka asistanıdır.<br />' +
    'Retrieval-Augmented Generation (RAG) mimarisini ve Gemini modelini kullanarak hızlı ve doğru yanıtlar sağlar. ' +
    'Üniversitenin web sitesinden alınan verilerle geliştirilen bu uygulama hızlıca üniversite ile alakalı soruları cevaplayabilir.<br />' +
    'Daha fazlası için LinkedIn ve GitHub üzerinden benimle bağlantı kurabilirsiniz.<br />' +
    'Hacettepe AI’yi kullandığınız için teşekkür ederiz!'
    const infoContentEN = 'Hacettepe AI is a dedicated AI assistant for Hacettepe University students.<br />' +
    'It leverages Retrieval-Augmented Generation (RAG) architecture and the Gemini model to deliver fast and accurate responses. ' +
    'Developed using scraped data from the university’s website, it ensures reliable information at your fingertips. <br /> ' +
    'For more updates, connect with me on LinkedIn and GitHub. If you have any questions or feedback, feel free to reach out.<br />' +
    'Thank you for using Hacettepe AI!'


    const fullText = language === "EN" ? infoContentEN : infoContentTR
    useEffect(() => {
        let currentIndex = -1
        const interval = setInterval(() => {
            currentIndex++
        setDisplayedText((prev) => prev + fullText[currentIndex])
        
        if (currentIndex >= fullText.length-1) {
            clearInterval(interval) // Clear the interval when the full text has been displayed
        }
        }, 5) // Adjust the interval time to control the speed of the typing effect

        return () => clearInterval(interval) // Cleanup the interval on component unmount
    }, [fullText])

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
        onClose()
        }
    };

  return (
    <div 
      className="fixed inset-0 flex justify-center items-center bg-black/70 z-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-primary border-secondary rounded-sm relative w-11/12 max-w-md">
      <div className="flex items-center justify-between border-b-secondary border-b-2 p-2">
        <h2 className="text-xl">{language === "EN" ? infoTitleEN : infoTitleTR}</h2>
            
            <button 
            onClick={onClose} 
            className=" bg-secondary text-white py-1 px-2 rounded-sm">
            <FaRegCircleXmark />

            
            </button>
      </div>
        <div className="p-2">
            <p dangerouslySetInnerHTML={{__html: displayedText}}></p>
            {/* Outside the typewriter, so it renders immediately rather than being typed out */}
            <p className="text-right text-xs text-[#9ca3af] mt-3">v{__APP_VERSION__}</p>
      </div>
    </div>
    </div>
  );
};

export default InfoModal;
