import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { TooltipProvider } from '../lib/tooltip';
import { Header, type HeaderProps } from '../components/Header';
import { THEME_STORAGE_KEY } from '../lib/useTheme';

function props(over: Partial<HeaderProps> = {}): HeaderProps {
  return {
    live: true,
    races: [],
    selectedDate: 'today',
    onSelectDate: () => {},
    replay: { enabled: false, playing: false, speed: 1, onPlay() {}, onPause() {}, onSpeed() {} },
    ...over,
  };
}

function renderHeader(over: Partial<HeaderProps> = {}) {
  return render(
    <TooltipProvider>
      <Header {...props(over)} />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'dark');
});
afterEach(() => localStorage.clear());

describe('Header', () => {
  it('renders the wordmark and the LIVE chip (with a tooltip) on a live day', () => {
    renderHeader({ live: true });
    expect(screen.getByText('RACINGSHAPE')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByTestId('live-chip')).toHaveAttribute('data-tip', expect.stringContaining('||'));
  });

  it('hides the LIVE chip on an archived day', () => {
    renderHeader({ live: false });
    expect(screen.queryByTestId('live-chip')).toBeNull();
  });

  it('mounts the real DateSelector combobox with a tooltip', () => {
    renderHeader();
    const sel = screen.getByRole('combobox', { name: /race day/i });
    expect(sel).toHaveAttribute('data-tip', expect.stringContaining('||'));
    expect(screen.getByRole('option', { name: /TODAY/i })).toBeInTheDocument();
  });

  it('renders the Replay button disabled when replay is not enabled', () => {
    renderHeader({ replay: { enabled: false, playing: false, speed: 1, onPlay() {}, onPause() {}, onSpeed() {} } });
    expect(screen.getByTestId('replay-btn')).toBeDisabled();
  });

  it('toggle button flips the theme and persists it', () => {
    renderHeader();
    const btn = screen.getByTestId('theme-btn');
    expect(btn).toHaveTextContent(/DARK/i);
    fireEvent.click(btn);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(btn).toHaveTextContent(/LIGHT/i);
  });
});
