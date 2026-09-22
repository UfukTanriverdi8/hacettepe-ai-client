import { useState } from 'react'
import { FaStar, FaStarHalfStroke } from 'react-icons/fa6'
import { toast } from 'react-toastify'

const FeedbackModal = ({ onClose, timestamp, session_id, feedbackUrl, language }) => {
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

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-primary border border-secondary rounded-lg p-6 w-full max-w-md mx-4">
                <h2 className="text-tertiary text-lg font-bold mb-4">
                    {language === 'TR' ? 'Geri Bildirim' : 'Feedback'}
                </h2>

                {/* Star Rating */}
                <div className="mb-4">
                    <p className="text-[#9ca3af] text-sm mb-2">
                        {language === 'TR' ? 'Bu yanıtı nasıl değerlendirirsiniz?' : 'How would you rate this response?'}
                    </p>
                    <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
                        {[1, 2, 3, 4, 5].map(star => (
                            <div
                                key={star}
                                className="relative cursor-pointer text-2xl"
                                style={{ width: '1.75rem', height: '1.75rem' }}
                            >
                                {/* Left half triggers half-star */}
                                <div
                                    className="absolute inset-y-0 left-0 w-1/2 z-10"
                                    onMouseEnter={() => setHoverRating(star - 0.5)}
                                    onClick={() => setRating(star - 0.5)}
                                />
                                {/* Right half triggers full star */}
                                <div
                                    className="absolute inset-y-0 right-0 w-1/2 z-10"
                                    onMouseEnter={() => setHoverRating(star)}
                                    onClick={() => setRating(star)}
                                />
                                {activeRating >= star
                                    ? <FaStar className="text-yellow-400" />
                                    : activeRating >= star - 0.5
                                    ? <FaStarHalfStroke className="text-yellow-400" />
                                    : <FaStar className="text-[#4b5563]" />
                                }
                            </div>
                        ))}
                    </div>
                </div>

                {/* Comment */}
                <div className="mb-6">
                    <textarea
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder={language === 'TR' ? 'Yorumunuz (isteğe bağlı)' : 'Your comment (optional)'}
                        rows={3}
                        className="w-full px-3 py-2 bg-black text-tertiary rounded-lg border border-primary focus:border-secondary focus:outline-hidden resize-none text-sm"
                    />
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => onClose(false)}
                        className="px-4 py-2 text-sm text-[#9ca3af] hover:text-tertiary transition-colors duration-200"
                    >
                        {language === 'TR' ? 'İptal' : 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={rating === 0 || submitting}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all duration-200 ${
                            rating === 0 || submitting
                                ? 'bg-[#4b5563] text-[#9ca3af] cursor-not-allowed'
                                : 'bg-secondary text-tertiary hover:opacity-90'
                        }`}
                    >
                        {submitting
                            ? (language === 'TR' ? 'Gönderiliyor...' : 'Sending...')
                            : (language === 'TR' ? 'Gönder' : 'Submit')
                        }
                    </button>
                </div>
            </div>
        </div>
    )
}

export default FeedbackModal
