import { render, screen } from '@testing-library/react';
import { PitWall } from '../components/PitWall';
import type { StatsResponse } from '../lib/types';

const stats: StatsResponse = {
  range: '14d',
  repoUrl: 'https://github.com/S2AI/s2shape',
  chart: [],
  totalTasks: { total: 37, issues: 23, prs: 14, deltaVsPriorWeek: 9 },
  completion: { rate: 0.82, closed: 41, opened: 50 },
  streak: { current: 12, startDate: '2026-05-22', bestThisMonth: 12 },
  crowd: {
    peakToday: 42,
    peaks: [
      { date: '2026-05-28', peak: 10 },
      { date: '2026-05-29', peak: 20 },
      { date: '2026-05-30', peak: 30 },
      { date: '2026-05-31', peak: 40 },
      { date: '2026-06-01', peak: 50 },
      { date: '2026-06-02', peak: 60 },
      { date: '2026-06-03', peak: 70 },
      { date: '2026-06-04', peak: 80 },
      { date: '2026-06-05', peak: 90 },
      { date: '2026-06-06', peak: 100 },
      { date: '2026-06-07', peak: 55 },
      { date: '2026-06-08', peak: 35 },
      { date: '2026-06-09', peak: 45 },
      { date: '2026-06-10', peak: 42 },
    ],
  },
};

describe('PitWall', () => {
  it('renders the three team stat values', () => {
    render(<PitWall stats={stats} />);
    expect(screen.getByTestId('stat-tasks')).toHaveTextContent('37');
    expect(screen.getByTestId('stat-completion')).toHaveTextContent('82%');
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('12');
  });

  it('tasks value tooltip shows the issues + PRs composition', () => {
    render(<PitWall stats={stats} />);
    const tip = screen.getByTestId('stat-tasks').getAttribute('data-tip') ?? '';
    expect(tip).toContain('23 issues');
    expect(tip).toContain('14 pull requests');
  });

  it('completion gauge tooltip shows n / m', () => {
    render(<PitWall stats={stats} />);
    expect(screen.getByTestId('completion-gauge').getAttribute('data-tip')).toContain('41 / 50');
    expect(screen.getByTestId('completion-fill').style.width).toBe('82%');
  });

  it('streak tooltip names the run start and best this month', () => {
    render(<PitWall stats={stats} />);
    const tip = screen.getByTestId('stat-streak').getAttribute('data-tip') ?? '';
    expect(tip).toContain('2026-05-22');
    expect(tip).toContain('best this month is 12');
  });

  it('shows the signed delta-vs-prior-week sub-line', () => {
    render(<PitWall stats={stats} />);
    expect(screen.getByText(/\+9 vs prior week/)).toBeInTheDocument();
  });

  it('renders the crowd peak today value', () => {
    render(<PitWall stats={stats} />);
    expect(screen.getByTestId('stat-crowd')).toHaveTextContent('42');
  });

  it('renders one sparkline bar per crowd.peaks entry', () => {
    render(<PitWall stats={stats} />);
    const bars = screen.getAllByTestId('crowd-bar');
    expect(bars).toHaveLength(14);
  });

  it('crowd tooltip includes the 14-day average', () => {
    render(<PitWall stats={stats} />);
    const tipAttr = screen.getByTestId('stat-crowd').getAttribute('data-tip') ?? '';
    // average of peaks array: sum=727, n=14, avg=52
    expect(tipAttr).toContain('14-day average 52');
  });
});
