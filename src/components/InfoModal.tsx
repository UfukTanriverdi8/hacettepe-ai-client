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
        'Hacettepe AI, Hacettepe Üniversitesi öğrencileri için bir yapay zeka asistanıdır.',
        'Sorularınızı yanıtlarken Hacettepe kaynaklarında arama yapabilir ve güncel web sayfalarını çekebilir.',
        'Soru ve önerileriniz için GitHub üzerinden ulaşabilirsiniz.',
        'Hacettepe AI’yi kullandığınız için teşekkür ederiz!',
    ]
    const infoContentEN = [
        'Hacettepe AI is an AI assistant for Hacettepe University students.',
        'To answer your questions, it can search Hacettepe resources and fetch live web pages.',
        'For questions or suggestions, reach out on GitHub.',
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
            href="https://github.com/UfukTanriverdi8/hacettepe-ai-client"
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
