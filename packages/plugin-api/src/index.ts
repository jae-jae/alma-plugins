/**
 * Alma Plugin API
 *
 * TypeScript type definitions for developing Alma plugins.
 * These types are provided by the Alma runtime when plugins are loaded.
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * A disposable resource that can be cleaned up.
 */
export interface Disposable {
    dispose(): void;
}

/**
 * Result returned from plugin activation.
 */
export interface PluginActivation {
    dispose(): void;
}

// ============================================================================
// Logger API
// ============================================================================

/**
 * Logging utilities for plugins.
 */
export interface Logger {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
}

// ============================================================================
// Tools API
// ============================================================================

/**
 * Definition for a tool that can be used by the AI assistant.
 */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
    execute: (args: unknown) => Promise<unknown>;
}

/**
 * API for registering and managing AI tools.
 */
export interface ToolsAPI {
    register(id: string, tool: ToolDefinition): Disposable;
    unregister(id: string): void;
}

// ============================================================================
// Commands API
// ============================================================================

/**
 * API for registering command palette commands.
 */
export interface CommandsAPI {
    register(id: string, handler: () => Promise<void> | void): Disposable;
    execute(id: string, ...args: unknown[]): Promise<void>;
}

// ============================================================================
// Hooks API
// ============================================================================

/**
 * Options for hook registration.
 */
export interface HookOptions {
    priority?: number;
}

/**
 * API for subscribing to lifecycle events.
 */
export interface HooksAPI {
    register<TInput, TOutput>(
        hookName: string,
        handler: (input: TInput, output: TOutput) => void | Promise<void>,
        options?: HookOptions
    ): Disposable;
}

// ============================================================================
// UI API
// ============================================================================

/**
 * Options for showing notifications.
 */
export interface NotificationOptions {
    type?: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
}

/**
 * A status bar item that can display information.
 */
export interface StatusBarItem {
    id: string;
    text: string;
    tooltip?: string;
    command?: string;
    alignment: 'left' | 'right';
    priority: number;
    show(): void;
    hide(): void;
    dispose(): void;
}

/**
 * Options for creating a status bar item.
 */
export interface StatusBarItemOptions {
    id?: string;
    alignment?: 'left' | 'right';
    priority?: number;
}

/**
 * Theme change event handler.
 */
export interface ThemeChangeHandler {
    onChange(callback: (theme: Theme) => void): Disposable;
}

/**
 * UI utilities for plugins.
 */
export interface UIAPI {
    showNotification(message: string, options?: NotificationOptions): void;
    createStatusBarItem(options?: StatusBarItemOptions): StatusBarItem;
    theme: ThemeChangeHandler;
}

// ============================================================================
// Settings API
// ============================================================================

/**
 * API for reading and writing plugin settings.
 */
export interface SettingsAPI {
    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    set(key: string, value: unknown): Promise<void>;
    onChange(key: string, callback: (value: unknown) => void): Disposable;
    onDidChange(callback: (key?: string) => void): Disposable;
}

// ============================================================================
// Chat API
// ============================================================================

/**
 * A chat message.
 */
export interface ChatMessage {
    id: string;
    threadId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
}

/**
 * A chat thread/conversation.
 */
export interface ChatThread {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * API for accessing chat threads and messages.
 */
export interface ChatAPI {
    onMessage(callback: (message: ChatMessage) => void): Disposable;
    getMessages(threadId: string): Promise<ChatMessage[]>;
    getCurrentThread(): Promise<ChatThread | null>;
}

// ============================================================================
// Transform API
// ============================================================================

/**
 * API for transforming messages and prompts.
 */
export interface TransformAPI {
    registerSystemPrompt(
        id: string,
        transformer: (prompt: string) => string | Promise<string>
    ): Disposable;
    registerUserMessage(
        id: string,
        transformer: (message: string) => string | Promise<string>
    ): Disposable;
}

// ============================================================================
// Theme API
// ============================================================================

/**
 * Color definitions for a theme.
 */
export interface ThemeColors {
    background: string;
    foreground: string;
    primary: string;
    secondary?: string;
    accent?: string;
    muted?: string;
    border?: string;
    error?: string;
    warning?: string;
    success?: string;
    info?: string;
    [key: string]: string | undefined;
}

/**
 * A theme definition.
 */
export interface Theme {
    id: string;
    label: string;
    type: 'dark' | 'light';
    colors: ThemeColors;
}

/**
 * API for registering and managing themes.
 */
export interface ThemesAPI {
    register(theme: Theme): Disposable;
    getCurrent(): Theme | null;
    apply(themeId: string): Promise<void>;
}

// ============================================================================
// Storage API
// ============================================================================

/**
 * Persistent key-value storage for plugins.
 */
export interface StorageAPI {
    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
    keys(): string[];
}

// ============================================================================
// Secrets API
// ============================================================================

/**
 * Secure storage for sensitive data like API keys.
 */
export interface SecretsAPI {
    get(key: string): Promise<string | undefined>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}

// ============================================================================
// Plugin Context
// ============================================================================

/**
 * The main context object passed to plugins during activation.
 * Provides access to all Alma APIs.
 */
export interface PluginContext {
    // Core APIs
    logger: Logger;
    tools: ToolsAPI;
    commands: CommandsAPI;
    hooks: HooksAPI;
    ui: UIAPI;
    settings: SettingsAPI;
    chat: ChatAPI;
    transform: TransformAPI;
    themes: ThemesAPI;
    storage: StorageAPI;
    secrets: SecretsAPI;

    // Plugin info
    pluginId: string;
    pluginPath: string;

    // Extension state storage
    globalState: Map<string, unknown>;
    workspaceState: Map<string, unknown>;
}

// ============================================================================
// Plugin Entry Point
// ============================================================================

/**
 * The activation function that plugins must export.
 *
 * @example
 * ```typescript
 * import type { PluginContext, PluginActivation } from 'alma-plugin-api';
 *
 * export async function activate(context: PluginContext): Promise<PluginActivation> {
 *     context.logger.info('Plugin activated!');
 *
 *     return {
 *         dispose: () => {
 *             context.logger.info('Plugin deactivated');
 *         }
 *     };
 * }
 * ```
 */
export type ActivateFunction = (context: PluginContext) => Promise<PluginActivation>;
