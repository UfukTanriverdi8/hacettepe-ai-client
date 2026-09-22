import { FaGithub } from "react-icons/fa6";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Language } from "../types";

interface InfoModalProps {
    open: boolean
    onClose: () => void
    language: Language
}

const InfoModal = ({ open, onClose, language }: InfoModalProps) => {
    const infoTitleTR = "Hakkında"
    const infoTitleEN = "About"
    // One entry per paragraph.
    const infoContentTR = [
        'Hacettepe AI, Hacettepe Üniversitesi öğrencileri için özel bir yapay zeka asistanıdır.',
        'Retrieval-Augmented Generation (RAG) mimarisini ve Gemini modelini kullanarak hızlı ve doğru yanıtlar sağlar. ' +
        'Üniversitenin web sitesinden alınan verilerle geliştirilen bu uygulama hızlıca üniversite ile alakalı soruları cevaplayabilir.',
        'Daha fazlası için LinkedIn ve GitHub üzerinden benimle bağlantı kurabilirsiniz.',
        'Hacettepe AI’yi kullandığınız için teşekkür ederiz!',
    ]
    const infoContentEN = [
        'Hacettepe AI is a dedicated AI assistant for Hacettepe University students.',
        'It leverages Retrieval-Augmented Generation (RAG) architecture and the Gemini model to deliver fast and accurate responses. ' +
        'Developed using scraped data from the university’s website, it ensures reliable information at your fingertips.',
        'For more updates, connect with me on LinkedIn and GitHub. If you have any questions or feedback, feel free to reach out.',
        'Thank you for using Hacettepe AI!',
    ]
    const tr = language === "TR"

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent closeLabel={tr ? "Kapat" : "Close"} className="gap-4 p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr ? infoTitleTR : infoTitleEN}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2.5 text-[15px] leading-relaxed text-muted-foreground">
          {(tr ? infoContentTR : infoContentEN).map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
          <a
            href="https://github.com/UfukTanriverdi8/HacettepeAI-client"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <FaGithub className="size-4" />
            GitHub
          </a>
          <span>Hacettepe AI © 2026 · v{__APP_VERSION__}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InfoModal;
