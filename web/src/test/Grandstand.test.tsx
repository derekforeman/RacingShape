import { render, screen, fireEvent } from '@testing-library/react';
import { Grandstand } from '../components/Grandstand';
import type { SpectatorFan } from '@racingshape/shared';

function fan(over: Partial<SpectatorFan>): SpectatorFan {
  return {
    id: 'session-1',
    name: null,
    flag: null,
    cheerForLogin: null,
    isSelf: false,
    watchingForSec: 300,
    ...over,
  };
}

const noop = () => {};
const colorForLogin = (login: string) => (login === 'dev-r' ? '#e10600' : '#15d6e0');

describe('Grandstand', () => {
  it('renders a named fan with flag and name label', () => {
    const fans = [fan({ id: 'a', name: 'maya', flag: '🇨🇦' })];
    render(<Grandstand fans={fans} colorForLogin={colorForLogin} myName={null} myFlag={null} onName={noop} onFlag={noop} />);
    expect(screen.getByText('🇨🇦')).toBeInTheDocument();
    expect(screen.getByTestId('fan-name')).toHaveTextContent('maya');
  });

  it('renders an anonymous fan without a name label, dimmed (opacity-40)', () => {
    const fans = [fan({ id: 'b', name: null, flag: null })];
    render(<Grandstand fans={fans} colorForLogin={colorForLogin} myName={null} myFlag={null} onName={noop} onFlag={noop} />);
    expect(screen.queryByTestId('fan-name')).not.toBeInTheDocument();
    const fanEl = screen.getByTestId('fan');
    expect(fanEl.className).toContain('opacity-40');
  });

  it('does NOT dim your own fan when anonymous (popover would inherit the opacity)', () => {
    const fans = [fan({ id: 'me', name: null, flag: '🇨🇦', isSelf: true })];
    render(<Grandstand fans={fans} colorForLogin={colorForLogin} myName={null} myFlag={null} onName={noop} onFlag={noop} />);
    expect(screen.getByTestId('fan-self').className).not.toContain('opacity-40');
  });

  it('shows +N overflow when fans.length > 24', () => {
    const fans = Array.from({ length: 27 }, (_, i) =>
      fan({ id: `f${i}`, name: `fan${i}` }),
    );
    render(<Grandstand fans={fans} colorForLogin={colorForLogin} myName={null} myFlag={null} onName={noop} onFlag={noop} />);
    expect(screen.getByTestId('fan-overflow')).toHaveTextContent('+3');
  });

  it('renders a supporter dot with the colorForLogin color for a fan cheering a racer', () => {
    const fans = [fan({ id: 'c', name: 'jay', flag: '🇺🇸', cheerForLogin: 'dev-r' })];
    render(<Grandstand fans={fans} colorForLogin={colorForLogin} myName={null} myFlag={null} onName={noop} onFlag={noop} />);
    const dot = screen.getByTestId('supporter-dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveStyle({ background: '#e10600' });
  });

  it('clicking the self fan opens IdentityControl', () => {
    const fans = [fan({ id: 'me', name: 'you', flag: '🇺🇸', isSelf: true })];
    render(
      <Grandstand
        fans={fans}
        colorForLogin={colorForLogin}
        myName="you"
        myFlag="🇺🇸"
        onName={noop}
        onFlag={noop}
      />,
    );
    expect(screen.queryByTestId('identity-control')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('fan-self'));
    const popover = screen.getByTestId('identity-control');
    expect(popover).toBeInTheDocument();
    // Regression: must open left-aligned (rightward), not centered — a centered popover on
    // the left-edge "you" fan overflows the overflow-hidden RaceControl panel and gets clipped.
    expect(popover.className).toContain('left-0');
    expect(popover.className).not.toContain('left-1/2');
  });

  it('typing a name and blurring calls onName with the trimmed value', () => {
    const onName = vi.fn();
    const fans = [fan({ id: 'me', name: null, flag: null, isSelf: true })];
    render(
      <Grandstand
        fans={fans}
        colorForLogin={colorForLogin}
        myName={null}
        myFlag={null}
        onName={onName}
        onFlag={noop}
      />,
    );
    fireEvent.click(screen.getByTestId('fan-self'));
    const input = screen.getByTestId('name-input');
    fireEvent.change(input, { target: { value: '  alex  ' } });
    fireEvent.blur(input);
    expect(onName).toHaveBeenCalledWith('alex');
  });

  it('clicking a flag button calls onFlag with that flag', () => {
    const onFlag = vi.fn();
    const fans = [fan({ id: 'me', name: 'self', flag: null, isSelf: true })];
    render(
      <Grandstand
        fans={fans}
        colorForLogin={colorForLogin}
        myName="self"
        myFlag={null}
        onName={noop}
        onFlag={onFlag}
      />,
    );
    fireEvent.click(screen.getByTestId('fan-self'));
    fireEvent.click(screen.getByTestId('flag-btn-🇺🇸'));
    expect(onFlag).toHaveBeenCalledWith('🇺🇸');
  });
});
