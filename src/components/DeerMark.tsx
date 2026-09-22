// Drawn in the same 24px, stroke-only style as the lucide icons beside it, so the avatar and the
// header controls read as one set. Takes currentColor: red on the greeting and on answers, muted
// while an answer is pending.
const DeerMark = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
    >
        <path d="M9 10 7 5M7 5 4.5 3M7 5l2.5-1.5M15 10l2-5M17 5l2.5-2M17 5l-2.5-1.5" />
        <path d="M8.5 10.5h7l-1.2 5L12 21l-2.3-5.5z" />
    </svg>
)

export default DeerMark
