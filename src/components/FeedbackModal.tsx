import { useState } from 'react'
import { FaStar, FaStarHalfStroke } from 'react-icons/fa6'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { Language } from '../types'

interface FeedbackModalProps {
    open: boolean
    // true when the rating was stored, which hides the feedback button for good
    onClose: (submitted: boolean) => void
    timestamp: string
    session_id?: string | null
    feedbackUrl: string
    language: Language
}

const FeedbackModal = ({ open, onClose, timestamp, session_id, feedbackUrl, language }: FeedbackModalProps) => {
    const [rating, setRating] = useState(0)
    const [hoverRating, setHoverRating] = useState(0)
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const activeRating = hoverRating || rating

    const handleSubmit = async () => {
        if (rating === 0) return
        setSubmitting(true)
        try {
            const response = await fetch(feedbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id,
                    timestamp,
                    feedback_value: rating >= 3 ? 'Positive' : 'Negative',
                    rating: Math.round(rating * 2),
                    ...(comment && { feedback_reason: comment })
                })
            })
            // The endpoint answers 404 when (session_id, timestamp) matches no stored exchange
            // — the row aged out under the 180-day TTL, or was never written. Thanking the user
            // for a rating that went nowhere is the one outcome worth avoiding here.
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }
            toast.success(
                language === 'TR' ? 'Geri bildiriminiz için teşekkürler!' : 'Thank you for your feedback!',
                { position: 'top-left', autoClose: 3000, className: 'custom-toast' }
            )
            onClose(true)
        } catch (err) {
            console.error('Feedback error:', err)
            toast.error(
                language === 'TR' ? 'Geri bildirim gönderilemedi.' : 'Could not send feedback.',
                { position: 'top-left', autoClose: 3000, className: 'custom-toast' }
            )
            onClose(false)
        } finally {
            setSubmitting(false)
        }
    }

    const tr = language === 'TR'

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(false) }}>
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
                    onKeyDown={e => {
                        const step: Record<string, number> = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 }
                        if (e.key in step) setRating(r => Math.min(5, Math.max(0, r + step[e.key])))
                        else if (e.key === 'Home') setRating(0)
                        else if (e.key === 'End') setRating(5)
                        else return
                        e.preventDefault()
                    }}
                    className="flex w-fit gap-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    onMouseLeave={() => setHoverRating(0)}
                >
                    {[1, 2, 3, 4, 5].map(star => (
                        <div key={star} className="relative size-8 cursor-pointer text-[28px]">
                            {/* Left half triggers half-star */}
                            <div
                                className="absolute inset-y-0 left-0 z-10 w-1/2"
                                onMouseEnter={() => setHoverRating(star - 0.5)}
                                onClick={() => setRating(star - 0.5)}
                            />
                            {/* Right half triggers full star */}
                            <div
                                className="absolute inset-y-0 right-0 z-10 w-1/2"
                                onMouseEnter={() => setHoverRating(star)}
                                onClick={() => setRating(star)}
                            />
                            {activeRating >= star
                                ? <FaStar className="text-star" />
                                : activeRating >= star - 0.5
                                ? <FaStarHalfStroke className="text-star" />
                                : <FaStar className="text-border" />
                            }
                        </div>
                    ))}
                </div>

                <Textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder={tr ? 'Yorumunuz (isteğe bağlı)' : 'Your comment (optional)'}
                    rows={3}
                    className="min-h-20 resize-none bg-muted text-sm dark:bg-muted"
                />

                <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0">
                    <Button variant="ghost" onClick={() => onClose(false)}>
                        {tr ? 'İptal' : 'Cancel'}
                    </Button>
                    <Button onClick={handleSubmit} disabled={rating === 0 || submitting}>
                        {submitting
                            ? (tr ? 'Gönderiliyor...' : 'Sending...')
                            : (tr ? 'Gönder' : 'Submit')
                        }
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default FeedbackModal
