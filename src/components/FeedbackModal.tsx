import { useState } from 'react'
import { FaStar, FaStarHalfStroke } from 'react-icons/fa6'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { Language } from '../types'

// Stored as a kind and worded at render time, so a language switch re-words an open error.
const SUBMIT_ERRORS = {
    failed: {
        EN: "Couldn't send your feedback. Check your connection and try again.",
        TR: 'Geri bildiriminiz gönderilemedi. Bağlantınızı kontrol edip tekrar deneyin.',
    },
    missing: {
        EN: "This answer is no longer stored, so it can't be rated.",
        TR: 'Bu yanıt artık kayıtlı değil, bu yüzden puanlanamaz.',
    },
}

interface FeedbackModalProps {
    open: boolean
    // The dialog was dismissed: Cancel, Esc, the overlay or the close button.
    onClose: () => void
    // The server answered 200 or 404, so this answer must not offer rating again.
    onDone: () => void
    timestamp: string
    session_id?: string | null
    feedbackUrl: string
    language: Language
}

const FeedbackModal = ({
    open,
    onClose,
    onDone,
    timestamp,
    session_id,
    feedbackUrl,
    language,
}: FeedbackModalProps) => {
    const [rating, setRating] = useState(0)
    const [hoverRating, setHoverRating] = useState(0)
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<keyof typeof SUBMIT_ERRORS | null>(null)

    const activeRating = hoverRating || rating
    // Any edit is a new attempt, so a stale error does not sit under changed input. A 'missing'
    // answer stays missing whatever is typed, so that one stays.
    const changeRating = (update: (r: number) => number) => {
        setRating(update)
        setError((e) => (e === 'missing' ? e : null))
    }

    // Every way out (Cancel, Esc, overlay, ×). A failed attempt ends with the dialog, so reopening
    // is a fresh try with the same input rather than a replay of the old error. A missing answer
    // stays missing.
    const dismiss = () => {
        setError((e) => (e === 'missing' ? e : null))
        onClose()
    }

    const handleSubmit = async () => {
        if (rating === 0 || submitting || error === 'missing') return
        setSubmitting(true)
        setError(null)
        try {
            const response = await fetch(feedbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id,
                    timestamp,
                    feedback_value: rating >= 3 ? 'Positive' : 'Negative',
                    rating: Math.round(rating * 2),
                    ...(comment && { feedback_reason: comment }),
                }),
            })
            // The endpoint answers 404 when (session_id, timestamp) matches no stored exchange
            // — the row aged out under the 180-day TTL, or was never written. Thanking the user
            // for a rating that went nowhere is the one outcome worth avoiding here. A retry
            // cannot fix it, so the answer counts as done and stops offering rating.
            if (response.status === 404) {
                setError('missing')
                onDone()
                return
            }
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }
            toast.success(
                language === 'TR' ? 'Geri bildiriminiz için teşekkürler!' : 'Thank you for your feedback!',
                { position: 'top-left', autoClose: 3000, className: 'custom-toast' },
            )
            onDone()
            onClose()
        } catch (err) {
            // The dialog stays open with the stars and comment as entered, so a retry is one
            // click instead of re-rating from scratch.
            console.error('Feedback error:', err)
            setError('failed')
        } finally {
            setSubmitting(false)
        }
    }

    const tr = language === 'TR'

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) dismiss()
            }}
        >
            <DialogContent closeLabel={tr ? 'Kapat' : 'Close'} className="gap-5 p-5 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{tr ? 'Geri bildirim' : 'Feedback'}</DialogTitle>
                    <DialogDescription>
                        {tr ? 'Bu yanıtı nasıl değerlendirirsiniz?' : 'How would you rate this response?'}
                    </DialogDescription>
                </DialogHeader>

                {/* Star Rating. The halves take the mouse; the slider role and arrow keys make
                    the same half-star steps reachable from the keyboard and to screen readers. */}
                <div
                    role="slider"
                    tabIndex={0}
                    aria-label={tr ? 'Puan' : 'Rating'}
                    aria-valuemin={0}
                    aria-valuemax={5}
                    aria-valuenow={rating}
                    aria-valuetext={`${rating} / 5`}
                    onKeyDown={(e) => {
                        const step: Record<string, number> = {
                            ArrowRight: 0.5,
                            ArrowUp: 0.5,
                            ArrowLeft: -0.5,
                            ArrowDown: -0.5,
                        }
                        if (e.key in step) changeRating((r) => Math.min(5, Math.max(0, r + step[e.key])))
                        else if (e.key === 'Home') changeRating(() => 0)
                        else if (e.key === 'End') changeRating(() => 5)
                        else return
                        e.preventDefault()
                    }}
                    className="flex w-fit gap-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    onMouseLeave={() => setHoverRating(0)}
                >
                    {[1, 2, 3, 4, 5].map((star) => (
                        <div key={star} className="relative size-8 cursor-pointer text-[28px]">
                            {/* Left half triggers half-star */}
                            <div
                                className="absolute inset-y-0 left-0 z-10 w-1/2"
                                onMouseEnter={() => setHoverRating(star - 0.5)}
                                onClick={() => changeRating(() => star - 0.5)}
                            />
                            {/* Right half triggers full star */}
                            <div
                                className="absolute inset-y-0 right-0 z-10 w-1/2"
                                onMouseEnter={() => setHoverRating(star)}
                                onClick={() => changeRating(() => star)}
                            />
                            {activeRating >= star ? (
                                <FaStar className="text-star" />
                            ) : activeRating >= star - 0.5 ? (
                                <FaStarHalfStroke className="text-star" />
                            ) : (
                                <FaStar className="text-border" />
                            )}
                        </div>
                    ))}
                </div>

                <Textarea
                    value={comment}
                    onChange={(e) => {
                        setComment(e.target.value)
                        setError((current) => (current === 'missing' ? current : null))
                    }}
                    placeholder={tr ? 'Yorumunuz (isteğe bağlı)' : 'Your comment (optional)'}
                    rows={3}
                    className="min-h-20 resize-none bg-muted text-sm dark:bg-muted"
                />

                {error && (
                    <p role="alert" className="-mt-2 text-[13px] text-destructive">
                        {SUBMIT_ERRORS[error][language]}
                    </p>
                )}

                <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0">
                    <Button variant="ghost" onClick={dismiss}>
                        {tr ? 'İptal' : 'Cancel'}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={rating === 0 || submitting || error === 'missing'}
                    >
                        {submitting ? (tr ? 'Gönderiliyor...' : 'Sending...') : tr ? 'Gönder' : 'Submit'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default FeedbackModal
