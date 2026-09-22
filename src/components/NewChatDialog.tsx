import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Language } from '../types'

interface NewChatDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
    language: Language
}

// Starting over deletes the conversation from this browser and drops the session, so the next
// question has no memory of this one. Worth one confirmation.
const NewChatDialog = ({ open, onOpenChange, onConfirm, language }: NewChatDialogProps) => {
    const tr = language === 'TR'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="gap-5 p-5 sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{tr ? 'Yeni sohbet başlatılsın mı?' : 'Start a new chat?'}</DialogTitle>
                    <DialogDescription>
                        {tr
                            ? 'Bu sohbet silinir ve asistan önceki soruları hatırlamaz.'
                            : 'This chat is deleted, and the assistant will not remember earlier questions.'}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0">
                    <DialogClose asChild>
                        <Button variant="ghost">{tr ? 'İptal' : 'Cancel'}</Button>
                    </DialogClose>
                    <Button onClick={() => { onConfirm(); onOpenChange(false) }}>
                        {tr ? 'Yeni sohbet' : 'New chat'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default NewChatDialog
