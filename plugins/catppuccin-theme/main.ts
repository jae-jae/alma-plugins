/**
 * Catppuccin Theme Plugin for Alma
 *
 * Registers multiple Catppuccin color palette themes (Mocha, Macchiato, Frappé, Latte)
 */

interface PluginContext {
    plugin: {
        id: string;
        name: string;
    };
    logger: {
        info: (message: string) => void;
        warn: (message: string) => void;
        error: (message: string) => void;
    };
    ui: {
        theme: {
            register: (options: ThemeRegistrationOptions) => Disposable;
        };
    };
}

interface ThemeRegistrationOptions {
    name: string;
    displayName: string;
    type: 'dark' | 'light';
    colors: PluginThemeColors;
    description?: string;
}

interface PluginThemeColors {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
    chart1?: string;
    chart2?: string;
    chart3?: string;
    chart4?: string;
    chart5?: string;
    sidebar?: string;
    sidebarForeground?: string;
    sidebarPrimary?: string;
    sidebarPrimaryForeground?: string;
    sidebarAccent?: string;
    sidebarAccentForeground?: string;
    sidebarBorder?: string;
    sidebarRing?: string;
    chatUserBg?: string;
    chatUserForeground?: string;
    syntaxBg?: string;
    syntaxFg?: string;
    syntaxComment?: string;
    syntaxVariable?: string;
    syntaxConstant?: string;
    syntaxString?: string;
    syntaxRegex?: string;
    syntaxFunction?: string;
    syntaxKeyword?: string;
    syntaxClass?: string;
    syntaxTag?: string;
    syntaxAttribute?: string;
    syntaxSelection?: string;
}

interface Disposable {
    dispose: () => void;
}

interface PluginActivation {
    dispose?: () => void;
}

// Catppuccin Mocha palette (dark)
const catppuccinMocha: PluginThemeColors = {
    // Base colors
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    card: '#181825',
    cardForeground: '#cdd6f4',
    popover: '#181825',
    popoverForeground: '#cdd6f4',
    primary: '#cba6f7',
    primaryForeground: '#1e1e2e',
    secondary: '#313244',
    secondaryForeground: '#cdd6f4',
    muted: '#313244',
    mutedForeground: '#a6adc8',
    accent: '#f5c2e7',
    accentForeground: '#1e1e2e',
    destructive: '#f38ba8',
    destructiveForeground: '#1e1e2e',
    border: '#45475a',
    input: '#45475a',
    ring: '#cba6f7',
    // Chart colors
    chart1: '#f38ba8',
    chart2: '#a6e3a1',
    chart3: '#f9e2af',
    chart4: '#89b4fa',
    chart5: '#f5c2e7',
    // Sidebar colors
    sidebar: '#11111b',
    sidebarForeground: '#cdd6f4',
    sidebarPrimary: '#cba6f7',
    sidebarPrimaryForeground: '#1e1e2e',
    sidebarAccent: '#313244',
    sidebarAccentForeground: '#cdd6f4',
    sidebarBorder: '#45475a',
    sidebarRing: '#cba6f7',
    // Chat colors
    chatUserBg: '#313244',
    chatUserForeground: '#cdd6f4',
    // Syntax highlighting
    syntaxBg: '#1e1e2e',
    syntaxFg: '#cdd6f4',
    syntaxComment: '#6c7086',
    syntaxVariable: '#f38ba8',
    syntaxConstant: '#fab387',
    syntaxString: '#a6e3a1',
    syntaxRegex: '#f5c2e7',
    syntaxFunction: '#89b4fa',
    syntaxKeyword: '#cba6f7',
    syntaxClass: '#f9e2af',
    syntaxTag: '#89b4fa',
    syntaxAttribute: '#f9e2af',
    syntaxSelection: '#45475a',
};

// Catppuccin Macchiato palette (dark)
const catppuccinMacchiato: PluginThemeColors = {
    background: '#24273a',
    foreground: '#cad3f5',
    card: '#1e2030',
    cardForeground: '#cad3f5',
    popover: '#1e2030',
    popoverForeground: '#cad3f5',
    primary: '#c6a0f6',
    primaryForeground: '#24273a',
    secondary: '#363a4f',
    secondaryForeground: '#cad3f5',
    muted: '#363a4f',
    mutedForeground: '#a5adcb',
    accent: '#f5bde6',
    accentForeground: '#24273a',
    destructive: '#ed8796',
    destructiveForeground: '#24273a',
    border: '#494d64',
    input: '#494d64',
    ring: '#c6a0f6',
    chart1: '#ed8796',
    chart2: '#a6da95',
    chart3: '#eed49f',
    chart4: '#8aadf4',
    chart5: '#f5bde6',
    sidebar: '#181926',
    sidebarForeground: '#cad3f5',
    sidebarPrimary: '#c6a0f6',
    sidebarPrimaryForeground: '#24273a',
    sidebarAccent: '#363a4f',
    sidebarAccentForeground: '#cad3f5',
    sidebarBorder: '#494d64',
    sidebarRing: '#c6a0f6',
    chatUserBg: '#363a4f',
    chatUserForeground: '#cad3f5',
    syntaxBg: '#24273a',
    syntaxFg: '#cad3f5',
    syntaxComment: '#6e738d',
    syntaxVariable: '#ed8796',
    syntaxConstant: '#f5a97f',
    syntaxString: '#a6da95',
    syntaxRegex: '#f5bde6',
    syntaxFunction: '#8aadf4',
    syntaxKeyword: '#c6a0f6',
    syntaxClass: '#eed49f',
    syntaxTag: '#8aadf4',
    syntaxAttribute: '#eed49f',
    syntaxSelection: '#494d64',
};

// Catppuccin Frappé palette (dark)
const catppuccinFrappe: PluginThemeColors = {
    background: '#303446',
    foreground: '#c6d0f5',
    card: '#292c3c',
    cardForeground: '#c6d0f5',
    popover: '#292c3c',
    popoverForeground: '#c6d0f5',
    primary: '#ca9ee6',
    primaryForeground: '#303446',
    secondary: '#414559',
    secondaryForeground: '#c6d0f5',
    muted: '#414559',
    mutedForeground: '#a5adce',
    accent: '#f4b8e4',
    accentForeground: '#303446',
    destructive: '#e78284',
    destructiveForeground: '#303446',
    border: '#51576d',
    input: '#51576d',
    ring: '#ca9ee6',
    chart1: '#e78284',
    chart2: '#a6d189',
    chart3: '#e5c890',
    chart4: '#8caaee',
    chart5: '#f4b8e4',
    sidebar: '#232634',
    sidebarForeground: '#c6d0f5',
    sidebarPrimary: '#ca9ee6',
    sidebarPrimaryForeground: '#303446',
    sidebarAccent: '#414559',
    sidebarAccentForeground: '#c6d0f5',
    sidebarBorder: '#51576d',
    sidebarRing: '#ca9ee6',
    chatUserBg: '#414559',
    chatUserForeground: '#c6d0f5',
    syntaxBg: '#303446',
    syntaxFg: '#c6d0f5',
    syntaxComment: '#737994',
    syntaxVariable: '#e78284',
    syntaxConstant: '#ef9f76',
    syntaxString: '#a6d189',
    syntaxRegex: '#f4b8e4',
    syntaxFunction: '#8caaee',
    syntaxKeyword: '#ca9ee6',
    syntaxClass: '#e5c890',
    syntaxTag: '#8caaee',
    syntaxAttribute: '#e5c890',
    syntaxSelection: '#51576d',
};

// Catppuccin Latte palette (light)
const catppuccinLatte: PluginThemeColors = {
    background: '#eff1f5',
    foreground: '#4c4f69',
    card: '#e6e9ef',
    cardForeground: '#4c4f69',
    popover: '#e6e9ef',
    popoverForeground: '#4c4f69',
    primary: '#8839ef',
    primaryForeground: '#eff1f5',
    secondary: '#ccd0da',
    secondaryForeground: '#4c4f69',
    muted: '#ccd0da',
    mutedForeground: '#6c6f85',
    accent: '#ea76cb',
    accentForeground: '#eff1f5',
    destructive: '#d20f39',
    destructiveForeground: '#eff1f5',
    border: '#bcc0cc',
    input: '#bcc0cc',
    ring: '#8839ef',
    chart1: '#d20f39',
    chart2: '#40a02b',
    chart3: '#df8e1d',
    chart4: '#1e66f5',
    chart5: '#ea76cb',
    sidebar: '#dce0e8',
    sidebarForeground: '#4c4f69',
    sidebarPrimary: '#8839ef',
    sidebarPrimaryForeground: '#eff1f5',
    sidebarAccent: '#ccd0da',
    sidebarAccentForeground: '#4c4f69',
    sidebarBorder: '#bcc0cc',
    sidebarRing: '#8839ef',
    chatUserBg: '#ccd0da',
    chatUserForeground: '#4c4f69',
    syntaxBg: '#eff1f5',
    syntaxFg: '#4c4f69',
    syntaxComment: '#9ca0b0',
    syntaxVariable: '#d20f39',
    syntaxConstant: '#fe640b',
    syntaxString: '#40a02b',
    syntaxRegex: '#ea76cb',
    syntaxFunction: '#1e66f5',
    syntaxKeyword: '#8839ef',
    syntaxClass: '#df8e1d',
    syntaxTag: '#1e66f5',
    syntaxAttribute: '#df8e1d',
    syntaxSelection: '#ccd0da',
};

export function activate(ctx: PluginContext): PluginActivation {
    const { logger, ui } = ctx;
    const disposables: Disposable[] = [];

    logger.info('Registering Catppuccin themes...');

    // Register Mocha (dark)
    disposables.push(
        ui.theme.register({
            name: 'mocha',
            displayName: 'Catppuccin Mocha',
            type: 'dark',
            colors: catppuccinMocha,
            description: 'A warm, dark theme with pastel colors',
        })
    );

    // Register Macchiato (dark)
    disposables.push(
        ui.theme.register({
            name: 'macchiato',
            displayName: 'Catppuccin Macchiato',
            type: 'dark',
            colors: catppuccinMacchiato,
            description: 'A medium-dark theme with pastel colors',
        })
    );

    // Register Frappé (dark)
    disposables.push(
        ui.theme.register({
            name: 'frappe',
            displayName: 'Catppuccin Frappé',
            type: 'dark',
            colors: catppuccinFrappe,
            description: 'A light-dark theme with pastel colors',
        })
    );

    // Register Latte (light)
    disposables.push(
        ui.theme.register({
            name: 'latte',
            displayName: 'Catppuccin Latte',
            type: 'light',
            colors: catppuccinLatte,
            description: 'A warm, light theme with pastel colors',
        })
    );

    logger.info('Catppuccin themes registered successfully');

    return {
        dispose: () => {
            logger.info('Unregistering Catppuccin themes...');
            disposables.forEach(d => d.dispose());
        },
    };
}
