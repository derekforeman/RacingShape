import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { Header } from '../components/Header';
import { THEME_STORAGE_KEY } from '../lib/useTheme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'dark');
});
afterEach(() => localStorage.clear());

describe('Header', () => {
  it('renders the wordmark and LIVE chip with a tooltip', () => {
    render(<Header />);
    expect(screen.getByText('RACINGSHAPE')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByTestId('live-chip')).toHaveAttribute('data-tip', expect.stringContaining('||'));
  });

  it('renders a STUB date selector showing TODAY, disabled for plan 04', () => {
    render(<Header />);
    const sel = screen.getByTestId('date-selector') as HTMLSelectElement;
    expect(sel).toBeDisabled();
    expect(sel.value).toMatch(/TODAY/i);
    expect(sel).toHaveAttribute('data-tip', expect.stringContaining('||'));
  });

  it('renders a disabled Replay button (plan 04 seam)', () => {
    render(<Header />);
    expect(screen.getByTestId('replay-btn')).toBeDisabled();
  });

  it('toggle button flips the theme and persists it', () => {
    render(<Header />);
    const btn = screen.getByTestId('theme-btn');
    expect(btn).toHaveTextContent(/DARK/i);
    fireEvent.click(btn);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(btn).toHaveTextContent(/LIGHT/i);
  });
});
