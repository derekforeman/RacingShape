import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/** Build the `HEADER||body` convention string the engine parses. */
export function tip(header: string, body: string): string {
  return `${header}||${body}`;
}

interface TipState {
  show: boolean;
  header: string;
  body: string;
  left: number;
  top: number;
}

const PAD = 14;
const TipCtx = createContext<null>(null);

export function useTip() {
  return useContext(TipCtx);
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TipState>({
    show: false,
    header: '',
    body: '',
    left: 0,
    top: 0,
  });
  const tipRef = useRef<HTMLDivElement>(null);

  const place = useCallback((clientX: number, clientY: number) => {
    const el = tipRef.current;
    const w = el?.offsetWidth || 240;
    const h = el?.offsetHeight || 80;
    let x = clientX + PAD;
    let y = clientY + PAD;
    if (x + w > window.innerWidth - 8) x = clientX - w - PAD;
    if (y + h > window.innerHeight - 8) y = clientY - h - PAD;
    return { x, y };
  }, []);

  const showFor = useCallback(
    (raw: string, clientX: number, clientY: number) => {
      const [head, body] = raw.split('||');
      const { x, y } = place(clientX, clientY);
      setState({
        show: true,
        header: body ? head : '',
        body: body ?? head,
        left: x,
        top: y,
      });
    },
    [place],
  );

  useEffect(() => {
    const onOver = (e: MouseEvent) => {
      const t = (e.target as HTMLElement)?.closest('[data-tip]');
      if (t) showFor(t.getAttribute('data-tip') ?? '', e.clientX, e.clientY);
    };
    const onMove = (e: MouseEvent) => {
      setState((s) => {
        if (!s.show) return s;
        const { x, y } = place(e.clientX, e.clientY);
        return { ...s, left: x, top: y };
      });
    };
    const onOut = (e: MouseEvent) => {
      const t = (e.target as HTMLElement)?.closest('[data-tip]');
      const related = e.relatedTarget as Node | null;
      if (t && !(related && t.contains(related))) {
        setState((s) => ({ ...s, show: false }));
      }
    };
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseout', onOut);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseout', onOut);
    };
  }, [showFor, place]);

  return (
    <TipCtx.Provider value={null}>
      {children}
      <div
        ref={tipRef}
        data-testid="tooltip"
        className={`tip${state.show ? ' show' : ''}`}
        style={{
          position: 'fixed',
          zIndex: 9999,
          maxWidth: 260,
          background: 'var(--panel2)',
          color: 'var(--ink)',
          border: '1px solid var(--line)',
          borderLeft: '3px solid var(--cyan)',
          borderRadius: 8,
          padding: '9px 11px',
          fontSize: 12,
          lineHeight: 1.5,
          whiteSpace: 'pre-line',
          pointerEvents: 'none',
          opacity: state.show ? 1 : 0,
          transform: state.show ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity .12s, transform .12s',
          boxShadow: '0 10px 30px rgba(0,0,0,.45)',
          left: state.left,
          top: state.top,
        }}
      >
        <span
          data-testid="tooltip-header"
          style={{
            display: state.header ? 'block' : 'none',
            fontFamily: 'var(--font-head)',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: 'var(--cyan)',
            marginBottom: 3,
          }}
        >
          {state.header}
        </span>
        <span data-testid="tooltip-body">{state.body}</span>
      </div>
    </TipCtx.Provider>
  );
}
