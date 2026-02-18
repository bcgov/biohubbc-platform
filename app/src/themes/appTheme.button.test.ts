import appTheme from './appTheme';

describe('appTheme button overrides', () => {
  it('contains contained disabled token styles', () => {
    const contained = appTheme.components?.MuiButton?.styleOverrides?.contained;

    if (typeof contained !== 'function') {
      throw new Error('MuiButton.contained override should be a function');
    }

    const styles = contained({ theme: appTheme, ownerState: {} } as never) as Record<string, unknown>;
    const disabled = styles['&.Mui-disabled'] as Record<string, unknown>;

    expect(disabled.color).toBe(appTheme.palette.action.disabled);
    expect(disabled.backgroundColor).toBe(appTheme.palette.action.disabledBackground);
  });

  it('contains a visible focus-visible ring on root', () => {
    const root = appTheme.components?.MuiButton?.styleOverrides?.root;

    if (typeof root !== 'function') {
      throw new Error('MuiButton.root override should be a function');
    }

    const styles = root({ theme: appTheme, ownerState: {} } as never) as Record<string, unknown>;
    const focusVisible = styles['&.Mui-focusVisible'] as Record<string, unknown>;

    expect(focusVisible.outline).toContain('2px solid');
    expect(focusVisible.outlineOffset).toBe('2px');
  });

  it('sets large size min-height and padding', () => {
    const sizeLarge = appTheme.components?.MuiButton?.styleOverrides?.sizeLarge;

    if (typeof sizeLarge !== 'function') {
      throw new Error('MuiButton.sizeLarge override should be a function');
    }

    const styles = sizeLarge({ theme: appTheme, ownerState: {} } as never) as Record<string, unknown>;

    expect(styles.minHeight).toBe(48);
    expect(styles.padding).toBe(appTheme.spacing(1.25, 3.5));
  });
});
