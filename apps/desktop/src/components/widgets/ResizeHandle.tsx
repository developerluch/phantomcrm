import { forwardRef, type HTMLAttributes } from 'react'
import type { ResizeHandleAxis } from 'react-grid-layout'

type ResizeHandleProps = HTMLAttributes<HTMLDivElement> & {
  handleAxis?: ResizeHandleAxis
}

/**
 * Custom diagonal SE resize grip for react-grid-layout.
 *
 * Must be a `forwardRef` component that spreads remaining props onto the
 * outermost element — react-grid-layout wires drag events through the
 * forwarded ref and injects event handlers/className via the spread props.
 * See: https://github.com/react-grid-layout/react-grid-layout#custom-resize-handle
 */
export const ResizeHandle = forwardRef<HTMLDivElement, ResizeHandleProps>(
  ({ handleAxis, className, style, ...rest }, ref) => {
    const composedClassName = [
      'phantom-resize-handle',
      `phantom-resize-handle-${handleAxis ?? 'se'}`,
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div
        ref={ref}
        {...rest}
        className={composedClassName}
        style={{
          position: 'absolute',
          right: 4,
          bottom: 4,
          width: 12,
          height: 12,
          cursor: 'se-resize',
          transition: 'opacity 120ms ease',
          touchAction: 'none',
          ...style,
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', pointerEvents: 'none' }}
          aria-hidden="true"
        >
          {/* Two parallel diagonal strokes indicating a draggable SE corner */}
          <line
            x1="2"
            y1="10"
            x2="10"
            y2="2"
            stroke="#7dd3fc"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="6"
            y1="10"
            x2="10"
            y2="6"
            stroke="#7dd3fc"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    )
  },
)

ResizeHandle.displayName = 'ResizeHandle'
