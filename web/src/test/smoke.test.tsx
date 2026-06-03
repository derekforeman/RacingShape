import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App smoke', () => {
  it('renders the RacingShape wordmark', () => {
    render(<App />);
    expect(screen.getByText(/RacingShape/i)).toBeInTheDocument();
  });
});
