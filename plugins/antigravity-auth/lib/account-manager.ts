/**
 * Multi-Account Manager for Antigravity Auth
 *
 * Manages multiple Google accounts with automatic rotation on rate limits.
 * Each account tracks rate limits separately per model family (claude/gemini).
 *
 * Based on opencode-antigravity-auth's accounts.ts
 */

import type { AntigravityTokens } from './types';

// ============================================================================
// Types
// ============================================================================

export type ModelFamily = 'claude' | 'gemini';
export type HeaderStyle = 'antigravity' | 'gemini-cli';
export type RequestType = 'claude' | 'gemini' | 'image_gen';
export type QuotaKey = 'claude' | 'gemini-antigravity' | 'gemini-cli' | 'gemini-image';

// Rate limit reason types (matching Antigravity-Manager)
export type RateLimitReason = 'quota_exhausted' | 'rate_limit_exceeded' | 'server_error' | 'unknown';

// Default cooldown times in ms (matching Antigravity-Manager)
export const RATE_LIMIT_DEFAULTS = {
    quota_exhausted: 60 * 60 * 1000,     // 1 hour for quota exhaustion
    rate_limit_exceeded: 30 * 1000,       // 30 seconds for rate limiting
    server_error: 20 * 1000,              // 20 seconds for server errors
    unknown: 60 * 1000,                   // 60 seconds for unknown errors
} as const;

export interface ManagedAccount {
    index: number;
    email?: string;
    projectId: string;
    refreshToken: string;
    accessToken?: string;
    expiresAt?: number;
    addedAt: number;
    lastUsed: number;
    /** Rate limit reset times per quota key */
    rateLimitResetTimes: Partial<Record<QuotaKey, number>>;
    /** Last switch reason */
    lastSwitchReason?: 'rate-limit' | 'initial' | 'rotation';
}

export interface AccountStorageData {
    version: 1;
    accounts: Array<{
        email?: string;
        projectId: string;
        refreshToken: string;
        addedAt: number;
        lastUsed: number;
        rateLimitResetTimes?: Partial<Record<QuotaKey, number>>;
    }>;
    activeIndexByFamily: {
        claude: number;
        gemini: number;
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

function nowMs(): number {
    return Date.now();
}

function getQuotaKey(family: ModelFamily, headerStyle: HeaderStyle, requestType?: RequestType): QuotaKey {
    if (family === 'claude') {
        return 'claude';
    }
    // Image generation has separate quota from text generation
    if (requestType === 'image_gen') {
        return 'gemini-image';
    }
    return headerStyle === 'gemini-cli' ? 'gemini-cli' : 'gemini-antigravity';
}

/**
 * Parse rate limit reason from error response body
 * Matches Antigravity-Manager's parse_rate_limit_reason logic
 */
export function parseRateLimitReason(errorBody: string): RateLimitReason {
    try {
        const json = JSON.parse(errorBody);
        const details = json?.error?.details;
        if (Array.isArray(details) && details.length > 0) {
            const reason = details[0]?.reason;
            if (reason === 'QUOTA_EXHAUSTED') {
                return 'quota_exhausted';
            }
            if (reason === 'RATE_LIMIT_EXCEEDED') {
                return 'rate_limit_exceeded';
            }
        }
    } catch {
        // JSON parse failed, try text matching
    }

    // Fallback to text matching
    const lowerBody = errorBody.toLowerCase();
    if (lowerBody.includes('exhausted') || lowerBody.includes('quota')) {
        return 'quota_exhausted';
    }
    if (lowerBody.includes('rate limit') || lowerBody.includes('too many requests')) {
        return 'rate_limit_exceeded';
    }

    return 'unknown';
}

/**
 * Parse retry delay from error response (matches Antigravity-Manager)
 */
export function parseRetryDelay(errorBody: string): number | undefined {
    try {
        const json = JSON.parse(errorBody);
        const details = json?.error?.details;
        if (Array.isArray(details)) {
            for (const detail of details) {
                // Check quotaResetDelay in metadata
                const quotaDelay = detail?.metadata?.quotaResetDelay;
                if (typeof quotaDelay === 'string') {
                    const parsed = parseDurationString(quotaDelay);
                    if (parsed !== undefined) return parsed;
                }

                // Check retryDelay in RetryInfo
                if (detail?.['@type']?.includes('RetryInfo')) {
                    const retryDelay = detail?.retryDelay;
                    if (typeof retryDelay === 'string') {
                        const parsed = parseDurationString(retryDelay);
                        if (parsed !== undefined) return parsed;
                    }
                }
            }
        }
    } catch {
        // JSON parse failed
    }
    return undefined;
}

/**
 * Parse duration string like "2h1m30s", "42s", "500ms"
 */
function parseDurationString(s: string): number | undefined {
    const regex = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?(?:(\d+)ms)?/;
    const match = s.match(regex);
    if (!match) return undefined;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseFloat(match[3] || '0');
    const milliseconds = parseInt(match[4] || '0', 10);

    const totalMs = (hours * 3600 + minutes * 60 + Math.ceil(seconds)) * 1000 + milliseconds;
    return totalMs > 0 ? totalMs : undefined;
}

function isRateLimitedForQuotaKey(account: ManagedAccount, key: QuotaKey): boolean {
    const resetTime = account.rateLimitResetTimes[key];
    return resetTime !== undefined && nowMs() < resetTime;
}

function isRateLimitedForFamily(account: ManagedAccount, family: ModelFamily): boolean {
    if (family === 'claude') {
        return isRateLimitedForQuotaKey(account, 'claude');
    }
    // For Gemini, check both header styles
    return isRateLimitedForQuotaKey(account, 'gemini-antigravity') &&
           isRateLimitedForQuotaKey(account, 'gemini-cli');
}

function clearExpiredRateLimits(account: ManagedAccount): void {
    const now = nowMs();
    for (const key of Object.keys(account.rateLimitResetTimes) as QuotaKey[]) {
        const resetTime = account.rateLimitResetTimes[key];
        if (resetTime !== undefined && now >= resetTime) {
            delete account.rateLimitResetTimes[key];
        }
    }
}

// ============================================================================
// AccountManager Class
// ============================================================================

/**
 * Multi-account manager with automatic rotation on rate limits.
 *
 * Uses the same account until it hits a rate limit (429), then switches.
 * Rate limits are tracked per-model-family (claude/gemini) so an account
 * rate-limited for Claude can still be used for Gemini.
 */
export class AccountManager {
    private accounts: ManagedAccount[] = [];
    private cursor = 0;
    private currentAccountIndexByFamily: Record<ModelFamily, number> = {
        claude: -1,
        gemini: -1,
    };
    private logger?: { debug: (msg: string, ...args: unknown[]) => void; info: (msg: string, ...args: unknown[]) => void };

    constructor(
        logger?: { debug: (msg: string, ...args: unknown[]) => void; info: (msg: string, ...args: unknown[]) => void }
    ) {
        this.logger = logger;
    }

    /**
     * Load accounts from storage data
     */
    loadFromStorage(data: AccountStorageData | null): void {
        if (!data || data.accounts.length === 0) {
            this.accounts = [];
            this.cursor = 0;
            this.currentAccountIndexByFamily = { claude: -1, gemini: -1 };
            return;
        }

        this.accounts = data.accounts.map((acc, index): ManagedAccount => ({
            index,
            email: acc.email,
            projectId: acc.projectId,
            refreshToken: acc.refreshToken,
            addedAt: acc.addedAt,
            lastUsed: acc.lastUsed,
            rateLimitResetTimes: acc.rateLimitResetTimes || {},
        }));

        this.currentAccountIndexByFamily.claude = Math.max(0, data.activeIndexByFamily?.claude ?? 0) % Math.max(1, this.accounts.length);
        this.currentAccountIndexByFamily.gemini = Math.max(0, data.activeIndexByFamily?.gemini ?? 0) % Math.max(1, this.accounts.length);
        this.cursor = this.currentAccountIndexByFamily.claude;
    }

    /**
     * Convert to storage data for persistence
     */
    toStorageData(): AccountStorageData {
        return {
            version: 1,
            accounts: this.accounts.map(acc => ({
                email: acc.email,
                projectId: acc.projectId,
                refreshToken: acc.refreshToken,
                addedAt: acc.addedAt,
                lastUsed: acc.lastUsed,
                rateLimitResetTimes: Object.keys(acc.rateLimitResetTimes).length > 0
                    ? acc.rateLimitResetTimes
                    : undefined,
            })),
            activeIndexByFamily: {
                claude: Math.max(0, this.currentAccountIndexByFamily.claude),
                gemini: Math.max(0, this.currentAccountIndexByFamily.gemini),
            },
        };
    }

    /**
     * Add a new account from OAuth tokens
     */
    addAccount(tokens: AntigravityTokens): ManagedAccount {
        // Check if account already exists (by email or refresh token)
        const existing = this.accounts.find(a =>
            (tokens.email && a.email === tokens.email) ||
            a.refreshToken === tokens.refresh_token
        );

        if (existing) {
            // Update existing account
            existing.refreshToken = tokens.refresh_token;
            existing.projectId = tokens.project_id;
            existing.accessToken = tokens.access_token;
            existing.expiresAt = tokens.expires_at;
            existing.email = tokens.email;
            this.logger?.info(`Updated existing account: ${tokens.email || 'unknown'}`);
            return existing;
        }

        // Add new account
        const account: ManagedAccount = {
            index: this.accounts.length,
            email: tokens.email,
            projectId: tokens.project_id,
            refreshToken: tokens.refresh_token,
            accessToken: tokens.access_token,
            expiresAt: tokens.expires_at,
            addedAt: nowMs(),
            lastUsed: 0,
            rateLimitResetTimes: {},
        };

        this.accounts.push(account);

        // If this is the first account, set it as active
        if (this.accounts.length === 1) {
            this.currentAccountIndexByFamily.claude = 0;
            this.currentAccountIndexByFamily.gemini = 0;
        }

        this.logger?.info(`Added new account: ${tokens.email || 'unknown'} (total: ${this.accounts.length})`);
        return account;
    }

    /**
     * Remove an account
     */
    removeAccount(index: number): boolean {
        if (index < 0 || index >= this.accounts.length) {
            return false;
        }

        this.accounts.splice(index, 1);

        // Re-index remaining accounts
        this.accounts.forEach((acc, i) => {
            acc.index = i;
        });

        // Adjust active indices
        if (this.accounts.length === 0) {
            this.cursor = 0;
            this.currentAccountIndexByFamily = { claude: -1, gemini: -1 };
        } else {
            for (const family of ['claude', 'gemini'] as ModelFamily[]) {
                if (this.currentAccountIndexByFamily[family] >= index) {
                    this.currentAccountIndexByFamily[family] = Math.max(0, this.currentAccountIndexByFamily[family] - 1);
                }
                this.currentAccountIndexByFamily[family] = Math.min(
                    this.currentAccountIndexByFamily[family],
                    this.accounts.length - 1
                );
            }
            this.cursor = Math.min(this.cursor, this.accounts.length - 1);
        }

        return true;
    }

    /**
     * Get account count
     */
    getAccountCount(): number {
        return this.accounts.length;
    }

    /**
     * Get all accounts
     */
    getAccounts(): ManagedAccount[] {
        return [...this.accounts];
    }

    /**
     * Get current account for a model family
     */
    getCurrentAccountForFamily(family: ModelFamily): ManagedAccount | null {
        const index = this.currentAccountIndexByFamily[family];
        if (index >= 0 && index < this.accounts.length) {
            return this.accounts[index] ?? null;
        }
        return null;
    }

    /**
     * Get current or next available account for a model family.
     * Automatically rotates to next account if current is rate limited.
     */
    getCurrentOrNextForFamily(family: ModelFamily): ManagedAccount | null {
        const current = this.getCurrentAccountForFamily(family);

        if (current) {
            clearExpiredRateLimits(current);
            if (!isRateLimitedForFamily(current, family)) {
                current.lastUsed = nowMs();
                return current;
            }
        }

        // Current is rate limited, find next available
        const next = this.getNextForFamily(family);
        if (next) {
            this.currentAccountIndexByFamily[family] = next.index;
            next.lastSwitchReason = 'rate-limit';
            this.logger?.info(`Switched to account ${next.index} (${next.email || 'unknown'}) for ${family} due to rate limit`);
        }
        return next;
    }

    /**
     * Get next available account for a model family
     */
    getNextForFamily(family: ModelFamily): ManagedAccount | null {
        const available = this.accounts.filter(a => {
            clearExpiredRateLimits(a);
            return !isRateLimitedForFamily(a, family);
        });

        if (available.length === 0) {
            return null;
        }

        const account = available[this.cursor % available.length];
        if (!account) {
            return null;
        }

        this.cursor++;
        account.lastUsed = nowMs();
        return account;
    }

    /**
     * Get available header style for an account
     * Gemini has two quota pools (antigravity vs gemini-cli)
     */
    getAvailableHeaderStyle(account: ManagedAccount, family: ModelFamily): HeaderStyle | null {
        clearExpiredRateLimits(account);

        if (family === 'claude') {
            return isRateLimitedForQuotaKey(account, 'claude') ? null : 'antigravity';
        }

        // For Gemini, try antigravity first, then gemini-cli
        if (!isRateLimitedForQuotaKey(account, 'gemini-antigravity')) {
            return 'antigravity';
        }
        if (!isRateLimitedForQuotaKey(account, 'gemini-cli')) {
            return 'gemini-cli';
        }
        return null;
    }

    /**
     * Mark an account as rate limited
     * @param account The account to mark
     * @param retryAfterMs The retry delay (if undefined, uses defaults based on reason)
     * @param family Model family (claude/gemini)
     * @param headerStyle Header style for Gemini
     * @param requestType Request type (claude/gemini/image_gen) - used for separate image quota
     * @param reason Rate limit reason for determining default cooldown
     */
    markRateLimited(
        account: ManagedAccount,
        retryAfterMs: number | undefined,
        family: ModelFamily,
        headerStyle: HeaderStyle = 'antigravity',
        requestType?: RequestType,
        reason: RateLimitReason = 'unknown'
    ): void {
        const key = getQuotaKey(family, headerStyle, requestType);
        // Use provided delay or fall back to reason-based defaults
        const delay = retryAfterMs ?? RATE_LIMIT_DEFAULTS[reason];
        account.rateLimitResetTimes[key] = nowMs() + delay;
        this.logger?.info(`Account ${account.index} (${account.email || 'unknown'}) rate limited for ${key} (${reason}), retry after ${delay}ms`);
    }

    /**
     * Update account tokens after refresh
     */
    updateAccountTokens(account: ManagedAccount, accessToken: string, expiresAt: number): void {
        account.accessToken = accessToken;
        account.expiresAt = expiresAt;
    }

    /**
     * Check if all accounts are rate limited for a family
     */
    allAccountsRateLimited(family: ModelFamily): boolean {
        return this.accounts.every(a => {
            clearExpiredRateLimits(a);
            return isRateLimitedForFamily(a, family);
        });
    }

    /**
     * Get minimum wait time until an account becomes available
     */
    getMinWaitTime(family: ModelFamily): number {
        const waitTimes: number[] = [];
        const now = nowMs();

        for (const account of this.accounts) {
            if (family === 'claude') {
                const resetTime = account.rateLimitResetTimes.claude;
                if (resetTime !== undefined) {
                    waitTimes.push(Math.max(0, resetTime - now));
                }
            } else {
                // For Gemini, account becomes available when EITHER pool expires
                const t1 = account.rateLimitResetTimes['gemini-antigravity'];
                const t2 = account.rateLimitResetTimes['gemini-cli'];
                const accountWait = Math.min(
                    t1 !== undefined ? Math.max(0, t1 - now) : Infinity,
                    t2 !== undefined ? Math.max(0, t2 - now) : Infinity
                );
                if (accountWait !== Infinity) {
                    waitTimes.push(accountWait);
                }
            }
        }

        return waitTimes.length > 0 ? Math.min(...waitTimes) : 0;
    }
}
