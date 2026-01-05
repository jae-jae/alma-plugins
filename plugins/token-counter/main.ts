import type { PluginContext, PluginActivation } from 'alma-plugin-api';

/**
 * Token Counter Plugin
 *
 * This plugin displays the current token count and estimated cost
 * in the status bar. It updates in real-time as messages are sent and received.
 */

interface TokenStats {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export async function activate(context: PluginContext): Promise<PluginActivation> {
    const { logger, events, ui, settings } = context;

    logger.info('Token Counter plugin activated!');

    // Create status bar item
    const statusBarItem = ui.createStatusBarItem({
        id: 'token-counter',
        alignment: 'right',
        priority: 100,
    });

    // Track token usage for the current session
    let sessionStats: TokenStats = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
    };

    // Get settings
    const getSettings = () => ({
        showCost: settings.get<boolean>('tokenCounter.showCost', true),
        costPerMillionTokens: settings.get<number>('tokenCounter.costPerMillionTokens', 3.0),
    });

    // Update the status bar display
    const updateStatusBar = () => {
        const { showCost, costPerMillionTokens } = getSettings();

        let text = `Tokens: ${formatNumber(sessionStats.totalTokens)}`;

        if (showCost) {
            const cost = (sessionStats.totalTokens / 1_000_000) * costPerMillionTokens;
            text += ` ($${cost.toFixed(4)})`;
        }

        statusBarItem.text = text;
        statusBarItem.tooltip = [
            `Prompt: ${formatNumber(sessionStats.promptTokens)}`,
            `Completion: ${formatNumber(sessionStats.completionTokens)}`,
            `Total: ${formatNumber(sessionStats.totalTokens)}`,
        ].join('\n');
    };

    // Format numbers with commas
    const formatNumber = (num: number): string => {
        return num.toLocaleString();
    };

    // Subscribe to message receive events to track token usage
    const eventDisposable = events.on('chat.message.didReceive', (input, _output) => {
        if (input.response.usage) {
            sessionStats.promptTokens += input.response.usage.promptTokens;
            sessionStats.completionTokens += input.response.usage.completionTokens;
            sessionStats.totalTokens += input.response.usage.totalTokens;

            logger.debug(`Token usage updated: ${JSON.stringify(sessionStats)}`);
            updateStatusBar();
        }
    });

    // Initialize the status bar
    updateStatusBar();
    statusBarItem.show();

    // Listen for settings changes
    const settingsDisposable = settings.onDidChange(() => {
        updateStatusBar();
    });

    return {
        dispose: () => {
            logger.info('Token Counter plugin deactivated');
            eventDisposable.dispose();
            settingsDisposable.dispose();
            statusBarItem.dispose();
        },
    };
}
