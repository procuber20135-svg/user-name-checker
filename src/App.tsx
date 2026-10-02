import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PlatformIcon } from './components/PlatformIcon';
import {
  ExecutionLogEntry,
  GamertagRecord,
  GeneratorPattern,
  LogSeverity,
  PLATFORMS,
  PlatformId,
  RateLimitConfig,
  SchedulerConfig,
  TargetStopConfig,
  buildCsvExportContent,
  buildTxtExportContent,
  calculateExponentialBackoff,
  calculateNormalDelay,
  detectClientOS,
  formatTimestampMillis,
  generateRareGamertags,
  generateSingleRareTag,
  getPlatformSpec,
  getPlatformVerificationLinks,
  triggerFileDownload,
  validateTagLocally,
} from './utils/gamertagEngine';

const VAULT_STORAGE_KEY = 'xtag_verify_available_vault_v3';
const CONFIG_STORAGE_KEY = 'xtag_verify_config_v3';
const SCHEDULER_STORAGE_KEY = 'xtag_verify_scheduler_v3';
const CHECKED_HISTORY_KEY = 'xtag_verify_checked_history_v3';

type ActiveTab = 'scanner' | 'vault' | 'scheduler' | 'logs';
type ResultFilter = 'ALL' | 'AVAILABLE' | 'TAKEN' | 'ERROR';

interface EmailReceipt {
  id: string;
  timestamp: string;
  recipient: string;
  subject: string;
  webhookStatus: string;
  rfc5322Message: string;
  textBody: string;
}

const INITIAL_SPECIFIC_LIST = [
  'SkerryVq',
  'CairnXz',
  'BerylKr',
  'WhorlQz',
  'LichenVx',
  'FjordZv',
  'Notch',
  'KestrelVn',
].join('\n');

const INITIAL_SEEDED_RECORDS: GamertagRecord[] = [
  {
    id: 'seed-v3-1',
    gamertag: 'SkerryVq',
    platform: 'xbox_mcpe',
    resolvedGamertag: 'SkerryVq',
    status: 'AVAILABLE',
    xboxMcpeStatus: 'AVAILABLE',
    javaStatus: 'AVAILABLE',
    xuid: null,
    latencyMs: 312,
    attempts: 1,
    lastDelayMs: 490,
    checkedAt: '03:39:08.114',
    reason: 'Confirmed AVAILABLE on Xbox Live / MCPE (no account exists).',
    upstreamDetails: 'XboxLive/PlayerDB: Confirmed Unregistered (xbox.not_found)',
    sourceMode: 'RARE_GENERATED',
    patternUsed: 'clean_og',
  },
  {
    id: 'seed-v3-2',
    gamertag: 'CairnXz',
    platform: 'xbox_mcpe',
    resolvedGamertag: 'CairnXz',
    status: 'AVAILABLE',
    xboxMcpeStatus: 'AVAILABLE',
    javaStatus: 'AVAILABLE',
    xuid: null,
    latencyMs: 288,
    attempts: 1,
    lastDelayMs: 525,
    checkedAt: '03:43:35.402',
    reason: 'Confirmed AVAILABLE on Xbox Live / MCPE (no account exists).',
    upstreamDetails: 'XboxLive/PlayerDB: Confirmed Unregistered (xbox.not_found)',
    sourceMode: 'RARE_GENERATED',
    patternUsed: 'clean_og',
  },
  {
    id: 'seed-v3-3',
    gamertag: 'BerylKr',
    platform: 'minecraft',
    resolvedGamertag: 'BerylKr',
    status: 'AVAILABLE',
    xboxMcpeStatus: 'UNKNOWN',
    javaStatus: 'AVAILABLE',
    xuid: null,
    latencyMs: 194,
    attempts: 1,
    lastDelayMs: 470,
    checkedAt: '03:43:38.210',
    reason: 'Confirmed AVAILABLE on Minecraft Java Edition (Mojang 404).',
    upstreamDetails: 'Mojang API: 404 Confirmed Unregistered',
    sourceMode: 'RARE_GENERATED',
    patternUsed: 'clean_og',
  },
  {
    id: 'seed-v3-4',
    gamertag: 'WhorlQz',
    platform: 'twitter',
    resolvedGamertag: 'WhorlQz',
    status: 'AVAILABLE',
    xboxMcpeStatus: 'UNKNOWN',
    javaStatus: 'UNKNOWN',
    xuid: null,
    latencyMs: 226,
    attempts: 1,
    lastDelayMs: 540,
    checkedAt: '03:43:40.890',
    reason: 'Confirmed AVAILABLE on X/Twitter (@WhorlQz not found).',
    upstreamDetails: 'X/Twitter Live API: User not found.',
    sourceMode: 'RARE_GENERATED',
    patternUsed: 'clean_og',
  },
  {
    id: 'seed-v3-5',
    gamertag: 'LichenVx',
    platform: 'reddit',
    resolvedGamertag: 'LichenVx',
    status: 'AVAILABLE',
    xboxMcpeStatus: 'UNKNOWN',
    javaStatus: 'UNKNOWN',
    xuid: null,
    latencyMs: 205,
    attempts: 1,
    lastDelayMs: 610,
    checkedAt: '03:43:42.512',
    reason: 'Confirmed AVAILABLE on Reddit (u/LichenVx not found).',
    upstreamDetails: 'Reddit User Index: 0 matching accounts',
    sourceMode: 'RARE_GENERATED',
    patternUsed: 'clean_og',
  },
];

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<ActiveTab>('scanner');

  // Selected Target Application / Platform
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>('xbox_mcpe');
  const activePlatformSpec = useMemo(
    () => getPlatformSpec(selectedPlatform),
    [selectedPlatform]
  );

  // OS & Export Line Endings (Windows CRLF vs macOS LF)
  const detectedOS = useMemo(() => detectClientOS(), []);
  const [osPlatform, setOsPlatform] = useState<'Windows' | 'macOS'>(
    detectedOS === 'macOS' ? 'macOS' : 'Windows'
  );
  const lineEnding: 'CRLF' | 'LF' = osPlatform === 'Windows' ? 'CRLF' : 'LF';

  // Source Mode & Inputs (default to clean_og which has high live availability)
  const [sourceMode, setSourceMode] = useState<'RARE_GENERATED' | 'SPECIFIC_LIST'>('RARE_GENERATED');
  const [generatorPattern, setGeneratorPattern] = useState<GeneratorPattern>('clean_og');
  const [specificNamesInput, setSpecificNamesInput] = useState<string>(INITIAL_SPECIFIC_LIST);

  // Target Stop Config (default to AVAILABLE_FOUND + skipTakenFromTable = true so already-used handles are skipped!)
  const [targetConfig, setTargetConfig] = useState<TargetStopConfig>({
    stopMode: 'AVAILABLE_FOUND',
    targetCount: 5,
    skipTakenFromTable: true,
  });

  // Rate Limit & Backoff Config
  const [rateConfig, setRateConfig] = useState<RateLimitConfig>(() => {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore storage read error
    }
    return {
      baseDelayMs: 450,
      maxJitterMs: 350,
      maxRetries: 3,
      backoffFactor: 2.0,
      strict12CharLimit: false,
      simulate429Probability: 0,
    };
  });

  // Persistent Deduplication Cache so already-checked / used handles are never fetched twice
  const [checkedHistory, setCheckedHistory] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(CHECKED_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_SEEDED_RECORDS.map((r) => `${r.platform}:${r.gamertag.toLowerCase()}`);
  });

  // Saved Available Usernames Vault in localStorage
  const [savedVault, setSavedVault] = useState<GamertagRecord[]>(() => {
    try {
      const raw = localStorage.getItem(VAULT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage error
    }
    return INITIAL_SEEDED_RECORDS.filter((r) => r.status === 'AVAILABLE');
  });

  // Scheduler & Email Config
  const [schedulerConfig, setSchedulerConfig] = useState<SchedulerConfig>(() => {
    try {
      const raw = localStorage.getItem(SCHEDULER_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return {
      enabled: false,
      intervalMinutes: 15,
      autoExportCsv: false,
      emailNotificationEnabled: true,
      recipientEmail: 'procuber20135@gmail.com',
      notifyTrigger: 'ON_COMPLETION',
      webhookUrl: '',
    };
  });

  // Batch Verification State
  const [records, setRecords] = useState<GamertagRecord[]>(INITIAL_SEEDED_RECORDS);
  const [skippedTakenCount, setSkippedTakenCount] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [batchStateLabel, setBatchStateLabel] = useState<string>('Ready');
  const [currentTagChecking, setCurrentTagChecking] = useState<string>('—');
  const [activeDelayMs, setActiveDelayMs] = useState<number>(0);
  const [isBackingOff, setIsBackingOff] = useState<boolean>(false);
  const [progressCompleted, setProgressCompleted] = useState<number>(5);
  const [progressTarget, setProgressTarget] = useState<number>(5);
  const [retryTotalCount, setRetryTotalCount] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Table Filters & Search
  const [resultFilter, setResultFilter] = useState<ResultFilter>('ALL');
  const [platformTableFilter, setPlatformTableFilter] = useState<PlatformId | 'ALL'>('ALL');
  const [vaultPlatformFilter, setVaultPlatformFilter] = useState<PlatformId | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [manualVaultInput, setManualVaultInput] = useState<string>('');

  // Execution Debug Logs
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([
    {
      id: 'init-v3-1',
      timestamp: '03:39:08.114',
      severity: 'SUCCESS',
      platform: 'xbox_mcpe',
      gamertag: 'SkerryVq',
      attempt: 1,
      httpStatus: 200,
      backoffMs: 490,
      message: '[Xbox / MCPE] Confirmed AVAILABLE: "SkerryVq" (xbox.not_found).',
      details: 'XboxLive/PlayerDB: Confirmed Unregistered (312ms)',
    },
    {
      id: 'init-v3-2',
      timestamp: '03:43:35.402',
      severity: 'SUCCESS',
      platform: 'xbox_mcpe',
      gamertag: 'CairnXz',
      attempt: 1,
      httpStatus: 200,
      backoffMs: 525,
      message: '[Xbox / MCPE] Confirmed AVAILABLE: "CairnXz" (xbox.not_found).',
      details: 'XboxLive/PlayerDB: Confirmed Unregistered (288ms)',
    },
    {
      id: 'init-v3-3',
      timestamp: '03:43:38.210',
      severity: 'SUCCESS',
      platform: 'minecraft',
      gamertag: 'BerylKr',
      attempt: 1,
      httpStatus: 200,
      backoffMs: 470,
      message: '[Minecraft] Confirmed AVAILABLE: "BerylKr" (Mojang HTTP 404).',
      details: 'Official Mojang Profile API: Unregistered (194ms)',
    },
    {
      id: 'init-v3-4',
      timestamp: '03:43:40.890',
      severity: 'SUCCESS',
      platform: 'twitter',
      gamertag: 'WhorlQz',
      attempt: 1,
      httpStatus: 200,
      backoffMs: 540,
      message: '[Twitter / X] Confirmed AVAILABLE: "@WhorlQz" (User not found).',
      details: 'VxTwitter Live Endpoint: Unclaimed (226ms)',
    },
    {
      id: 'init-v3-5',
      timestamp: '03:43:42.512',
      severity: 'SUCCESS',
      platform: 'reddit',
      gamertag: 'LichenVx',
      attempt: 1,
      httpStatus: 200,
      backoffMs: 610,
      message: '[Reddit] Confirmed AVAILABLE: "u/LichenVx" (0 matching accounts).',
      details: 'Reddit User Index API: Unclaimed (205ms)',
    },
  ]);
  const [logFilter, setLogFilter] = useState<LogSeverity | 'ALL'>('ALL');

  // Scheduler Countdown & Email Outbox Receipts
  const [secondsUntilNextRun, setSecondsUntilNextRun] = useState<number>(
    schedulerConfig.intervalMinutes * 60
  );
  const [scheduledRunsCompleted, setScheduledRunsCompleted] = useState<number>(0);
  const [emailReceipts, setEmailReceipts] = useState<EmailReceipt[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  // Refs for cancellation and timers
  const abortRunRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync theme attribute on document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Persist Vault in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(savedVault));
    } catch {
      // ignore quota error
    }
  }, [savedVault]);

  // Persist Checked History in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CHECKED_HISTORY_KEY, JSON.stringify(checkedHistory.slice(-1500)));
    } catch {
      // ignore
    }
  }, [checkedHistory]);

  // Persist Rate Limit Config
  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(rateConfig));
    } catch {
      // ignore
    }
  }, [rateConfig]);

  // Persist Scheduler Config
  useEffect(() => {
    try {
      localStorage.setItem(SCHEDULER_STORAGE_KEY, JSON.stringify(schedulerConfig));
    } catch {
      // ignore
    }
  }, [schedulerConfig]);

  // Elapsed timer during active scan
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Automated Scheduler Countdown Timer
  useEffect(() => {
    if (!schedulerConfig.enabled) {
      setSecondsUntilNextRun(schedulerConfig.intervalMinutes * 60);
      return;
    }
    const timer = setInterval(() => {
      setSecondsUntilNextRun((prev) => {
        if (prev <= 1) {
          if (!isRunning) {
            setScheduledRunsCompleted((c) => c + 1);
            void startVerificationBatch(true);
          }
          return schedulerConfig.intervalMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [schedulerConfig.enabled, schedulerConfig.intervalMinutes, isRunning]);

  function appendLog(entry: Omit<ExecutionLogEntry, 'id' | 'timestamp'>) {
    const newEntry: ExecutionLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: formatTimestampMillis(),
    };
    setLogs((prev) => [newEntry, ...prev.slice(0, 299)]);
  }

  function addRecordToVault(record: GamertagRecord) {
    setSavedVault((prev) => {
      const exists = prev.some(
        (item) =>
          item.gamertag.toLowerCase() === record.gamertag.toLowerCase() &&
          (item.platform || 'xbox_mcpe') === (record.platform || 'xbox_mcpe')
      );
      if (exists) return prev;
      return [record, ...prev];
    });
  }

  function removeTagFromVault(gamertag: string, platform: PlatformId) {
    setSavedVault((prev) =>
      prev.filter(
        (item) =>
          !(
            item.gamertag.toLowerCase() === gamertag.toLowerCase() &&
            (item.platform || 'xbox_mcpe') === platform
          )
      )
    );
  }

  async function sleepInterruptible(ms: number): Promise<boolean> {
    const step = 100;
    let waited = 0;
    while (waited < ms) {
      if (abortRunRef.current) return false;
      const chunk = Math.min(step, ms - waited);
      await new Promise((resolve) => setTimeout(resolve, chunk));
      waited += chunk;
    }
    return !abortRunRef.current;
  }

  async function verifySingleTagWithBackoff(
    gamertag: string,
    platform: PlatformId,
    source: 'RARE_GENERATED' | 'SPECIFIC_LIST',
    pattern?: string
  ): Promise<GamertagRecord> {
    const cleanTag = gamertag.trim();
    const spec = getPlatformSpec(platform);
    const localValidation = validateTagLocally(
      cleanTag,
      platform,
      rateConfig.strict12CharLimit
    );

    if (!localValidation.valid) {
      appendLog({
        severity: 'ERROR',
        platform,
        gamertag: cleanTag,
        attempt: 1,
        backoffMs: 0,
        message: `[${spec.shortLabel}] Pre-flight validation failed: ${localValidation.reason}`,
        details: 'Fast-fail strict rule rejected username before network call.',
      });
      return {
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gamertag: cleanTag,
        platform,
        status: 'INVALID',
        xboxMcpeStatus: 'INVALID',
        javaStatus: 'UNKNOWN',
        xuid: null,
        latencyMs: 0,
        attempts: 1,
        lastDelayMs: 0,
        checkedAt: formatTimestampMillis(),
        reason: localValidation.reason || 'Invalid username format.',
        upstreamDetails: `Strict ${spec.shortLabel} pre-flight validator (0ms)`,
        sourceMode: source,
        patternUsed: pattern,
      };
    }

    let attempt = 0;
    let lastAppliedDelay = calculateNormalDelay(rateConfig.baseDelayMs, rateConfig.maxJitterMs);

    while (attempt <= rateConfig.maxRetries) {
      attempt++;
      if (abortRunRef.current) {
        break;
      }

      if (attempt === 1) {
        lastAppliedDelay = calculateNormalDelay(rateConfig.baseDelayMs, rateConfig.maxJitterMs);
        setIsBackingOff(false);
        setActiveDelayMs(lastAppliedDelay);
      } else {
        lastAppliedDelay = calculateExponentialBackoff(
          rateConfig.baseDelayMs,
          attempt - 1,
          rateConfig.backoffFactor,
          rateConfig.maxJitterMs
        );
        setIsBackingOff(true);
        setActiveDelayMs(lastAppliedDelay);
        setBatchStateLabel(`Exponential Backoff (Attempt ${attempt}/${rateConfig.maxRetries + 1})`);
      }

      const cont = await sleepInterruptible(lastAppliedDelay);
      if (!cont) break;

      setBatchStateLabel(`Verifying ${spec.shortLabel}`);
      try {
        const response = await fetch('/api/verify-gamertag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gamertag: cleanTag,
            platform,
            simulateRateLimitProbability: rateConfig.simulate429Probability,
            strictLength12: rateConfig.strict12CharLimit,
          }),
        });

        const payload = await response.json().catch(() => ({}));

        if (response.status === 429 || payload.status === 'RATE_LIMITED') {
          setRetryTotalCount((c) => c + 1);
          const nextBackoff = calculateExponentialBackoff(
            rateConfig.baseDelayMs,
            attempt,
            rateConfig.backoffFactor,
            rateConfig.maxJitterMs
          );
          appendLog({
            severity: 'RATE_LIMIT',
            platform,
            gamertag: cleanTag,
            attempt,
            httpStatus: 429,
            backoffMs: nextBackoff,
            message: `[${spec.shortLabel}] Rate limit / timeout on "${cleanTag}". Backing off for ${nextBackoff}ms (${rateConfig.backoffFactor}x + jitter).`,
            details: payload.reason || 'Upstream rate limiter active.',
          });

          if (attempt <= rateConfig.maxRetries) {
            continue;
          } else {
            appendLog({
              severity: 'ERROR',
              platform,
              gamertag: cleanTag,
              attempt,
              httpStatus: 429,
              backoffMs: lastAppliedDelay,
              message: `[${spec.shortLabel}] Max retries (${rateConfig.maxRetries}) exhausted for "${cleanTag}" without definitive confirmation.`,
            });
            return {
              id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              gamertag: cleanTag,
              platform,
              status: 'RATE_LIMITED',
              xboxMcpeStatus: 'UNKNOWN',
              javaStatus: 'UNKNOWN',
              xuid: null,
              latencyMs: payload.latencyMs ?? null,
              attempts: attempt,
              lastDelayMs: lastAppliedDelay,
              checkedAt: formatTimestampMillis(),
              reason: `Exhausted ${rateConfig.maxRetries} exponential backoff retries.`,
              upstreamDetails: payload.reason || 'Rate limit exceeded',
              sourceMode: source,
              patternUsed: pattern,
            };
          }
        }

        if (!response.ok || payload.status === 'ERROR') {
          appendLog({
            severity: 'WARN',
            platform,
            gamertag: cleanTag,
            attempt,
            httpStatus: response.status,
            backoffMs: lastAppliedDelay,
            message: `[${spec.shortLabel}] Upstream error (HTTP ${response.status}) while checking "${cleanTag}".`,
            details: payload.reason || 'Upstream service error',
          });

          if (attempt <= rateConfig.maxRetries) {
            setRetryTotalCount((c) => c + 1);
            continue;
          }

          return {
            id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            gamertag: cleanTag,
            platform,
            status: 'ERROR',
            xboxMcpeStatus: 'UNKNOWN',
            javaStatus: 'UNKNOWN',
            xuid: null,
            latencyMs: payload.latencyMs ?? null,
            attempts: attempt,
            lastDelayMs: lastAppliedDelay,
            checkedAt: formatTimestampMillis(),
            reason: payload.reason || `HTTP ${response.status} failure`,
            upstreamDetails: payload.upstreamDetails || 'Failed after retries',
            sourceMode: source,
            patternUsed: pattern,
          };
        }

        const record: GamertagRecord = {
          id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          gamertag: cleanTag,
          platform,
          resolvedGamertag: payload.resolvedGamertag || cleanTag,
          status: payload.status,
          xboxMcpeStatus: payload.xboxMcpeStatus || payload.status,
          javaStatus: payload.javaStatus || 'UNKNOWN',
          xuid: payload.xuid || null,
          latencyMs: payload.latencyMs ?? 0,
          attempts: attempt,
          lastDelayMs: lastAppliedDelay,
          checkedAt: formatTimestampMillis(),
          reason: payload.reason || '',
          upstreamDetails: payload.upstreamDetails || '',
          sourceMode: source,
          patternUsed: pattern,
        };

        if (record.status === 'AVAILABLE') {
          addRecordToVault(record);
          appendLog({
            severity: 'SUCCESS',
            platform,
            gamertag: cleanTag,
            attempt,
            httpStatus: 200,
            backoffMs: lastAppliedDelay,
            message: `[${spec.shortLabel}] Confirmed AVAILABLE: "${spec.handlePrefix}${cleanTag}" saved to local storage.`,
            details: `${record.upstreamDetails} (${record.latencyMs}ms)`,
          });
        } else if (record.status === 'TAKEN') {
          appendLog({
            severity: 'INFO',
            platform,
            gamertag: cleanTag,
            attempt,
            httpStatus: 200,
            backoffMs: lastAppliedDelay,
            message: `[${spec.shortLabel}] Already used (TAKEN): "${spec.handlePrefix}${cleanTag}"${
              record.xuid ? ` (ID: ${record.xuid})` : ''
            } — skipped.`,
            details: `${record.upstreamDetails} (${record.latencyMs}ms)`,
          });
        } else {
          appendLog({
            severity: 'ERROR',
            platform,
            gamertag: cleanTag,
            attempt,
            httpStatus: 200,
            backoffMs: lastAppliedDelay,
            message: `[${spec.shortLabel}] Invalid username "${cleanTag}": ${record.reason}`,
          });
        }

        return record;
      } catch (netErr: unknown) {
        const errMsg = netErr instanceof Error ? netErr.message : 'Network request failed';
        appendLog({
          severity: 'ERROR',
          platform,
          gamertag: cleanTag,
          attempt,
          backoffMs: lastAppliedDelay,
          message: `[${spec.shortLabel}] Network exception checking "${cleanTag}": ${errMsg}`,
        });
        if (attempt <= rateConfig.maxRetries) {
          setRetryTotalCount((c) => c + 1);
          continue;
        }
      }
    }

    return {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      gamertag: cleanTag,
      platform,
      status: 'ERROR',
      xboxMcpeStatus: 'UNKNOWN',
      javaStatus: 'UNKNOWN',
      xuid: null,
      latencyMs: null,
      attempts: attempt,
      lastDelayMs: lastAppliedDelay,
      checkedAt: formatTimestampMillis(),
      reason: 'Process aborted or network unreachable.',
      upstreamDetails: '',
      sourceMode: source,
      patternUsed: pattern,
    };
  }

  async function dispatchCompletionEmail(batchRecords: GamertagRecord[]) {
    const availableInBatch = batchRecords
      .filter((r) => r.status === 'AVAILABLE')
      .map((r) => `${r.gamertag} (${getPlatformSpec(r.platform).shortLabel})`);
    const errorCount = batchRecords.filter(
      (r) => r.status === 'ERROR' || r.status === 'INVALID' || r.status === 'RATE_LIMITED'
    ).length;

    if (
      schedulerConfig.notifyTrigger === 'ON_AVAILABLE_FOUND' &&
      availableInBatch.length === 0
    ) {
      return;
    }
    if (schedulerConfig.notifyTrigger === 'ON_ERROR' && errorCount === 0) {
      return;
    }

    setIsSendingEmail(true);
    try {
      const response = await fetch('/api/notify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: schedulerConfig.recipientEmail,
          subject: `XTag Verify [${activePlatformSpec.shortLabel}] Complete: ${availableInBatch.length} Available / ${batchRecords.length} Checked`,
          summaryStats: {
            checked: batchRecords.length,
            available: availableInBatch.length,
            taken: batchRecords.filter((r) => r.status === 'TAKEN').length,
            retried: retryTotalCount,
            errors: errorCount,
          },
          availableTags: availableInBatch,
          webhookUrl: schedulerConfig.webhookUrl,
        }),
      });
      const data = await response.json();
      if (data.ok) {
        const receipt: EmailReceipt = {
          id: data.messageId,
          timestamp: formatTimestampMillis(),
          recipient: data.recipient,
          subject: data.subject,
          webhookStatus: data.webhookStatus,
          rfc5322Message: data.rfc5322Message,
          textBody: data.textBody,
        };
        setEmailReceipts((prev) => [receipt, ...prev]);
        appendLog({
          severity: 'INFO',
          platform: selectedPlatform,
          message: `Completion email notification dispatched to ${data.recipient} (${availableInBatch.length} available tags).`,
          details: `Message-ID: ${data.messageId}`,
        });
      }
    } catch (err: unknown) {
      appendLog({
        severity: 'ERROR',
        platform: selectedPlatform,
        message: `Email notification dispatch failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setIsSendingEmail(false);
    }
  }

  async function startVerificationBatch(triggeredByScheduler = false) {
    if (isRunning) return;

    abortRunRef.current = false;
    setIsRunning(true);
    setElapsedSeconds(0);
    setBatchStateLabel(
      triggeredByScheduler
        ? `Scheduled ${activePlatformSpec.shortLabel} Batch`
        : `Initializing ${activePlatformSpec.shortLabel} Batch`
    );

    const desiredTarget = Math.max(1, Math.min(500, targetConfig.targetCount));
    const specificLines = specificNamesInput
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);

    const effectiveTarget =
      sourceMode === 'SPECIFIC_LIST' && targetConfig.stopMode === 'TOTAL_CHECKED'
        ? Math.min(desiredTarget, specificLines.length || 1)
        : desiredTarget;

    setProgressCompleted(0);
    setProgressTarget(effectiveTarget);

    appendLog({
      severity: 'INFO',
      platform: selectedPlatform,
      message: `Started [${activePlatformSpec.label}] ${
        sourceMode === 'RARE_GENERATED' ? `Rare Generator (${generatorPattern})` : 'Specific List'
      } batch. Target: ${effectiveTarget} (${
        targetConfig.stopMode === 'AVAILABLE_FOUND' ? 'Available Found' : 'Total Checked'
      }).`,
      details: `Auto-Skip Taken: ${targetConfig.skipTakenFromTable ? 'ON' : 'OFF'} · Base Delay: ${
        rateConfig.baseDelayMs
      }ms · Jitter: +0..${rateConfig.maxJitterMs}ms`,
    });

    const seenInAllHistory = new Set<string>(checkedHistory);
    const batchCreatedRecords: GamertagRecord[] = [];
    let checkedCount = 0;
    let availableFoundCount = 0;
    let listCursor = 0;

    while (!abortRunRef.current) {
      if (targetConfig.stopMode === 'TOTAL_CHECKED' && checkedCount >= effectiveTarget) {
        break;
      }
      if (targetConfig.stopMode === 'AVAILABLE_FOUND' && availableFoundCount >= effectiveTarget) {
        break;
      }
      if (checkedCount >= Math.max(effectiveTarget * 10, 100)) {
        appendLog({
          severity: 'WARN',
          platform: selectedPlatform,
          message: `Reached safety scan ceiling (${checkedCount} usernames checked) while searching for ${effectiveTarget} available handles.`,
        });
        break;
      }

      let candidateTag = '';
      if (sourceMode === 'SPECIFIC_LIST') {
        if (listCursor >= specificLines.length) {
          break;
        }
        candidateTag = specificLines[listCursor];
        listCursor++;
      } else {
        // Generate a fresh candidate that has NEVER been checked before on this platform
        let attempts = 0;
        do {
          candidateTag = generateSingleRareTag(generatorPattern, selectedPlatform);
          attempts++;
        } while (
          seenInAllHistory.has(`${selectedPlatform}:${candidateTag.toLowerCase()}`) &&
          attempts < 80
        );
        seenInAllHistory.add(`${selectedPlatform}:${candidateTag.toLowerCase()}`);
      }

      setCurrentTagChecking(`${activePlatformSpec.handlePrefix}${candidateTag}`);
      const result = await verifySingleTagWithBackoff(
        candidateTag,
        selectedPlatform,
        sourceMode,
        sourceMode === 'RARE_GENERATED' ? generatorPattern : undefined
      );

      if (abortRunRef.current) break;

      setCheckedHistory((prev) => [
        ...prev,
        `${selectedPlatform}:${candidateTag.toLowerCase()}`,
      ]);

      checkedCount++;
      batchCreatedRecords.push(result);

      if (result.status === 'AVAILABLE') {
        availableFoundCount++;
        setRecords((prev) => [result, ...prev]);
      } else if (result.status === 'TAKEN' && targetConfig.skipTakenFromTable) {
        // Skip adding already-used handles to the table so the user only sees available handles!
        setSkippedTakenCount((c) => c + 1);
      } else {
        setRecords((prev) => [result, ...prev]);
      }

      const currentProgressCount =
        targetConfig.stopMode === 'AVAILABLE_FOUND' ? availableFoundCount : checkedCount;
      setProgressCompleted(currentProgressCount);
    }

    const stoppedEarly = abortRunRef.current;
    setIsRunning(false);
    setIsBackingOff(false);
    setActiveDelayMs(0);
    setCurrentTagChecking('—');
    setBatchStateLabel(stoppedEarly ? 'Stopped by User' : 'Batch Completed');

    appendLog({
      severity: stoppedEarly ? 'WARN' : 'SUCCESS',
      platform: selectedPlatform,
      message: stoppedEarly
        ? `[${activePlatformSpec.shortLabel}] Batch halted by user after ${checkedCount} checks (${availableFoundCount} available found).`
        : `[${activePlatformSpec.shortLabel}] Batch finished: ${availableFoundCount} available handles verified (${
            checkedCount - availableFoundCount
          } already-used handles filtered out).`,
    });

    if (!stoppedEarly && schedulerConfig.autoExportCsv && batchCreatedRecords.length > 0) {
      const exportSet = targetConfig.skipTakenFromTable
        ? batchCreatedRecords.filter((r) => r.status === 'AVAILABLE')
        : batchCreatedRecords;
      if (exportSet.length > 0) {
        const csv = buildCsvExportContent(exportSet, lineEnding);
        triggerFileDownload(
          csv,
          `xtag-${selectedPlatform}-available-${Date.now()}.csv`,
          'text/csv;charset=utf-8'
        );
      }
    }

    if (!stoppedEarly && schedulerConfig.emailNotificationEnabled && batchCreatedRecords.length > 0) {
      await dispatchCompletionEmail(batchCreatedRecords);
    }
  }

  function stopVerificationBatch() {
    abortRunRef.current = true;
    setBatchStateLabel('Stopping...');
  }

  function handleGeneratePreviewSample() {
    const existingSet = new Set(
      checkedHistory
        .filter((k) => k.startsWith(`${selectedPlatform}:`))
        .map((k) => k.split(':')[1])
    );
    const previewTags = generateRareGamertags(
      12,
      generatorPattern,
      selectedPlatform,
      existingSet
    );
    setSpecificNamesInput(previewTags.join('\n'));
    appendLog({
      severity: 'INFO',
      platform: selectedPlatform,
      message: `Generated 12 fresh ${activePlatformSpec.shortLabel} candidates using pattern "${generatorPattern}".`,
    });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      const parsed = content
        .split(/\r?\n|,/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
      setSpecificNamesInput(parsed.join('\n'));
      setSourceMode('SPECIFIC_LIST');
      setTargetConfig((prev) => ({
        ...prev,
        targetCount: Math.min(500, Math.max(1, parsed.length)),
      }));
      appendLog({
        severity: 'INFO',
        platform: selectedPlatform,
        message: `Loaded ${parsed.length} usernames from file "${file.name}".`,
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleCopyTag(tag: string) {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => {
      setCopiedTag((current) => (current === tag ? null : current));
    }, 1600);
  }

  function handleExportVaultTxt() {
    const sourceVault =
      vaultPlatformFilter === 'ALL'
        ? savedVault
        : savedVault.filter((r) => (r.platform || 'xbox_mcpe') === vaultPlatformFilter);
    const content = buildTxtExportContent(sourceVault, lineEnding, true);
    triggerFileDownload(
      content,
      `available-usernames-${vaultPlatformFilter.toLowerCase()}-${osPlatform.toLowerCase()}.txt`,
      'text/plain;charset=utf-8'
    );
    appendLog({
      severity: 'INFO',
      message: `Exported ${sourceVault.length} available usernames to .txt (${lineEnding} line endings for ${osPlatform}).`,
    });
  }

  function handleExportRecordsCsv(onlyAvailable = false) {
    const sourceList = onlyAvailable
      ? records.filter((r) => r.status === 'AVAILABLE')
      : records;
    const csvContent = buildCsvExportContent(sourceList, lineEnding);
    triggerFileDownload(
      csvContent,
      `xtag-verify-${onlyAvailable ? 'available' : 'full'}-${osPlatform.toLowerCase()}.csv`,
      'text/csv;charset=utf-8'
    );
    appendLog({
      severity: 'INFO',
      message: `Exported ${sourceList.length} records to clean CSV (${lineEnding} format for ${osPlatform}).`,
    });
  }

  function handleExportDebugLog() {
    const eol = lineEnding === 'CRLF' ? '\r\n' : '\n';
    const lines = logs.map(
      (l) =>
        `[${l.timestamp}] [${l.severity}]${
          l.platform ? ` [${getPlatformSpec(l.platform).shortLabel}]` : ''
        }${l.gamertag ? ` [Handle: ${l.gamertag}]` : ''}${
          l.attempt ? ` [Attempt #${l.attempt}]` : ''
        }${l.httpStatus ? ` [HTTP ${l.httpStatus}]` : ''}${
          l.backoffMs !== undefined ? ` [Delay: ${l.backoffMs}ms]` : ''
        } ${l.message}${l.details ? ` — ${l.details}` : ''}`
    );
    triggerFileDownload(
      lines.join(eol),
      `xtag-execution-debug-${Date.now()}.log`,
      'text/plain;charset=utf-8'
    );
  }

  async function handleSimulate429Fault() {
    const testTag = generateSingleRareTag(generatorPattern, selectedPlatform);
    const prevProb = rateConfig.simulate429Probability;
    setRateConfig((prev) => ({ ...prev, simulate429Probability: 1 }));
    appendLog({
      severity: 'WARN',
      platform: selectedPlatform,
      gamertag: testTag,
      message: `[${activePlatformSpec.shortLabel}] Initiating deterministic HTTP 429 Rate-Limit Fault Test for "${testTag}"...`,
    });
    setActiveTab('logs');
    setIsRunning(true);
    abortRunRef.current = false;
    setCurrentTagChecking(`${activePlatformSpec.handlePrefix}${testTag}`);

    const backoff1 = calculateExponentialBackoff(
      rateConfig.baseDelayMs,
      1,
      rateConfig.backoffFactor,
      rateConfig.maxJitterMs
    );
    appendLog({
      severity: 'RATE_LIMIT',
      platform: selectedPlatform,
      gamertag: testTag,
      attempt: 1,
      httpStatus: 429,
      backoffMs: backoff1,
      message: `[${activePlatformSpec.shortLabel}] HTTP 429 Too Many Requests received. Sleeping ${backoff1}ms before Attempt #2...`,
      details: `Formula: ${rateConfig.baseDelayMs}ms * (${rateConfig.backoffFactor}^1) + randomJitter`,
    });
    setRetryTotalCount((c) => c + 1);
    setIsBackingOff(true);
    setActiveDelayMs(backoff1);
    await sleepInterruptible(Math.min(backoff1, 1600));

    setRateConfig((prev) => ({ ...prev, simulate429Probability: prevProb }));
    const res = await verifySingleTagWithBackoff(
      testTag,
      selectedPlatform,
      'RARE_GENERATED',
      generatorPattern
    );
    if (res.status === 'AVAILABLE' || !targetConfig.skipTakenFromTable) {
      setRecords((prev) => [res, ...prev]);
    }
    setIsRunning(false);
    setIsBackingOff(false);
    setActiveDelayMs(0);
    setCurrentTagChecking('—');
    setBatchStateLabel('Ready');
  }

  function handleAddManualVaultTag(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = manualVaultInput.trim();
    const check = validateTagLocally(
      trimmed,
      selectedPlatform,
      rateConfig.strict12CharLimit
    );
    if (!check.valid) {
      appendLog({
        severity: 'ERROR',
        platform: selectedPlatform,
        gamertag: trimmed,
        message: `Cannot add invalid ${activePlatformSpec.shortLabel} username to vault: ${check.reason}`,
      });
      return;
    }
    const manualRecord: GamertagRecord = {
      id: `manual-${Date.now()}`,
      gamertag: trimmed,
      platform: selectedPlatform,
      resolvedGamertag: trimmed,
      status: 'AVAILABLE',
      xboxMcpeStatus: selectedPlatform === 'xbox_mcpe' ? 'AVAILABLE' : 'UNKNOWN',
      javaStatus: selectedPlatform === 'minecraft' ? 'AVAILABLE' : 'UNKNOWN',
      xuid: null,
      latencyMs: 0,
      attempts: 1,
      lastDelayMs: 0,
      checkedAt: formatTimestampMillis(),
      reason: `Manually saved to ${activePlatformSpec.shortLabel} Available Vault.`,
      upstreamDetails: 'User entry',
      sourceMode: 'SPECIFIC_LIST',
    };
    addRecordToVault(manualRecord);
    setManualVaultInput('');
  }

  // Computed metrics & filtered lists
  const specificListAnalysis = useMemo(() => {
    const rawItems = specificNamesInput
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    let validCount = 0;
    let invalidCount = 0;
    for (const item of rawItems) {
      if (validateTagLocally(item, selectedPlatform, rateConfig.strict12CharLimit).valid) {
        validCount++;
      } else {
        invalidCount++;
      }
    }
    return { total: rawItems.length, validCount, invalidCount };
  }, [specificNamesInput, selectedPlatform, rateConfig.strict12CharLimit]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const recPlatform = r.platform || 'xbox_mcpe';
      if (platformTableFilter !== 'ALL' && recPlatform !== platformTableFilter) {
        return false;
      }
      if (resultFilter === 'AVAILABLE' && r.status !== 'AVAILABLE') return false;
      if (resultFilter === 'TAKEN' && r.status !== 'TAKEN') return false;
      if (
        resultFilter === 'ERROR' &&
        r.status !== 'ERROR' &&
        r.status !== 'INVALID' &&
        r.status !== 'RATE_LIMITED'
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.gamertag.toLowerCase().includes(q) ||
          recPlatform.toLowerCase().includes(q) ||
          (r.xuid && r.xuid.toLowerCase().includes(q)) ||
          r.reason.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, resultFilter, platformTableFilter, searchQuery]);

  const filteredVault = useMemo(() => {
    if (vaultPlatformFilter === 'ALL') return savedVault;
    return savedVault.filter((r) => (r.platform || 'xbox_mcpe') === vaultPlatformFilter);
  }, [savedVault, vaultPlatformFilter]);

  const filteredLogs = useMemo(() => {
    if (logFilter === 'ALL') return logs;
    return logs.filter((l) => l.severity === logFilter);
  }, [logs, logFilter]);

  const statsSummary = useMemo(() => {
    const total = records.length;
    const available = records.filter((r) => r.status === 'AVAILABLE').length;
    const taken = records.filter((r) => r.status === 'TAKEN').length;
    const errors = records.filter(
      (r) => r.status === 'INVALID' || r.status === 'ERROR' || r.status === 'RATE_LIMITED'
    ).length;
    const validLatencies = records
      .map((r) => r.latencyMs)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const avgLatency =
      validLatencies.length > 0
        ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
        : 0;
    return { total, available, taken, errors, avgLatency };
  }, [records]);

  const progressRatio = useMemo(() => {
    if (progressTarget <= 0) return 0;
    return Math.min(1, Math.max(0, progressCompleted / progressTarget));
  }, [progressCompleted, progressTarget]);

  const cliScriptPreview = useMemo(() => {
    const sampleLinks = getPlatformVerificationLinks('SAMPLE_TAG', selectedPlatform);
    const endpointTemplate = sampleLinks[0]?.url.replace('SAMPLE_TAG', '$Tag') || '';
    const bashEndpoint = sampleLinks[0]?.url.replace('SAMPLE_TAG', '$tag') || '';

    if (osPlatform === 'Windows') {
      return [
        `# Windows PowerShell 7+ — ${activePlatformSpec.label} Username Batch Verifier`,
        `# Compatible with Windows Task Scheduler (CRLF line endings)`,
        `$Platform = "${selectedPlatform}"`,
        `$BaseDelayMs = ${rateConfig.baseDelayMs}`,
        `$MaxJitterMs = ${rateConfig.maxJitterMs}`,
        `$BackoffFactor = ${rateConfig.backoffFactor}`,
        `$MaxRetries = ${rateConfig.maxRetries}`,
        `$TargetCount = ${targetConfig.targetCount}`,
        `$OutputCsv = ".\\xtag_${selectedPlatform}_results.csv"`,
        `"Username,Platform,Status,CheckedAt" | Out-File -FilePath $OutputCsv -Encoding utf8`,
        ``,
        `function Check-PlatformHandle($Tag) {`,
        `  for ($attempt = 1; $attempt -le $MaxRetries; $attempt++) {`,
        `    $jitter = Get-Random -Minimum 0 -Maximum $MaxJitterMs`,
        `    $delay = [math]::Round($BaseDelayMs * [math]::Pow($BackoffFactor, $attempt - 1)) + $jitter`,
        `    Start-Sleep -Milliseconds $delay`,
        `    try {`,
        `      $res = Invoke-WebRequest -Uri "${endpointTemplate}" -Method Get -TimeoutSec 8`,
        `      return @{ Status = "TAKEN"; Code = $res.StatusCode }`,
        `    } catch {`,
        `      if ($_.Exception.Response.StatusCode.value__ -eq 404) {`,
        `        return @{ Status = "AVAILABLE"; Code = 404 }`,
        `      }`,
        `      Write-Warning "[Retry $attempt] Rate limit or transient error for $Tag. Backing off ${'$'}delay ms..."`,
        `    }`,
        `  }`,
        `}`,
      ].join('\r\n');
    }
    return [
      `#!/usr/bin/env bash`,
      `# macOS / Linux — ${activePlatformSpec.label} Username Availability Verifier`,
      `# Schedule via crontab -e: */${schedulerConfig.intervalMinutes} * * * * /usr/local/bin/xtag-verify.sh`,
      `PLATFORM="${selectedPlatform}"`,
      `BASE_DELAY_MS=${rateConfig.baseDelayMs}`,
      `MAX_JITTER_MS=${rateConfig.maxJitterMs}`,
      `MAX_RETRIES=${rateConfig.maxRetries}`,
      `OUT_CSV="./xtag_${selectedPlatform}_results.csv"`,
      `echo "Username,Platform,Status,CheckedAt" > "$OUT_CSV"`,
      ``,
      `verify_tag() {`,
      `  local tag="$1"`,
      `  for (( attempt=1; attempt<=MAX_RETRIES; attempt++ )); do`,
      `    jitter=$(( RANDOM % (MAX_JITTER_MS + 1) ))`,
      `    delay_ms=$(( BASE_DELAY_MS * (2 ** (attempt - 1)) + jitter ))`,
      `    sleep "$(awk "BEGIN {print $delay_ms/1000}")"`,
      `    http_code=$(curl -s -o /dev/null -w "%{http_code}" "${bashEndpoint}")`,
      `    if [ "$http_code" = "404" ]; then`,
      `      echo "$tag,$PLATFORM,AVAILABLE,$(date -u +%FT%TZ)" | tee -a "$OUT_CSV"`,
      `      return 0`,
      `    elif [ "$http_code" = "200" ]; then`,
      `      echo "$tag,$PLATFORM,TAKEN,$(date -u +%FT%TZ)" >> "$OUT_CSV"`,
      `      return 0`,
      `    fi`,
      `    echo "[WARN] HTTP $http_code on $tag (attempt $attempt). Exponential backoff: \${delay_ms}ms" >&2`,
      `  done`,
      `}`,
    ].join('\n');
  }, [
    osPlatform,
    selectedPlatform,
    activePlatformSpec.label,
    rateConfig,
    targetConfig.targetCount,
    schedulerConfig.intervalMinutes,
  ]);

  return (
    <div>
      {/* Top Bar Contract: 3 Zones (Brand Wordmark — 4 Nav Links — 2 Actions) */}
      <header className="top-bar">
        <a
          href="#scanner"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('scanner');
          }}
          className="brand-wordmark"
        >
          XTag Verify
        </a>

        <nav className="top-nav" aria-label="Primary Navigation">
          <button
            type="button"
            className={`top-nav-link ${activeTab === 'scanner' ? 'active' : ''}`}
            onClick={() => setActiveTab('scanner')}
          >
            Verification Console
          </button>
          <button
            type="button"
            className={`top-nav-link ${activeTab === 'vault' ? 'active' : ''}`}
            onClick={() => setActiveTab('vault')}
          >
            Available Vault ({savedVault.length})
          </button>
          <button
            type="button"
            className={`top-nav-link ${activeTab === 'scheduler' ? 'active' : ''}`}
            onClick={() => setActiveTab('scheduler')}
          >
            Scheduler & Email
          </button>
          <button
            type="button"
            className={`top-nav-link ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            Debug Logs ({logs.length})
          </button>
        </nav>

        <div className="top-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleExportRecordsCsv(true)}
          >
            Export Available CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          >
            Theme: {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>
      </header>

      <main className="app-shell">
        {/* Metrics Summary Strip */}
        <section className="metrics-strip" aria-label="Verification Telemetry Summary">
          <div className="metric-cell">
            <span className="metric-label">Active Target Platform</span>
            <div className="metric-value">{activePlatformSpec.shortLabel}</div>
            <div className="metric-sub">
              {activePlatformSpec.minLen}–{activePlatformSpec.maxLen} chars · {osPlatform} ({lineEnding})
            </div>
          </div>

          <div className="metric-cell">
            <span className="metric-label">Confirmed Available</span>
            <div className="metric-value" style={{ color: 'var(--status-available)' }}>
              {statsSummary.available}
            </div>
            <div className="metric-sub">Saved in Local Storage: {savedVault.length}</div>
          </div>

          <div className="metric-cell">
            <span className="metric-label">Already Used Filtered Out</span>
            <div className="metric-value">{skippedTakenCount + statsSummary.taken}</div>
            <div className="metric-sub">
              Dedup History: {checkedHistory.length} handles
            </div>
          </div>

          <div className="metric-cell">
            <span className="metric-label">Backoff Retries &amp; Jitter</span>
            <div className="metric-value">{retryTotalCount}</div>
            <div className="metric-sub">
              {rateConfig.baseDelayMs}ms + 0..{rateConfig.maxJitterMs}ms ({rateConfig.backoffFactor}x)
            </div>
          </div>

          <div className="metric-cell">
            <span className="metric-label">Scheduler &amp; Notification</span>
            <div className="metric-value">
              {schedulerConfig.enabled
                ? `${String(Math.floor(secondsUntilNextRun / 60)).padStart(2, '0')}:${String(
                    secondsUntilNextRun % 60
                  ).padStart(2, '0')}`
                : 'Manual'}
            </div>
            <div className="metric-sub">
              {schedulerConfig.emailNotificationEnabled
                ? `Notify: ${schedulerConfig.recipientEmail}`
                : 'Email alerts disabled'}
            </div>
          </div>
        </section>

        {/* Progress Bar Panel */}
        <section className="progress-panel" aria-label="Batch Execution Progress">
          <div className="progress-header">
            <div className="progress-title-group">
              <strong style={{ color: 'var(--text-primary)' }}>Status: {batchStateLabel}</strong>
              <span className="meta-sep">·</span>
              <span>
                Platform:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {activePlatformSpec.label}
                </strong>
              </span>
              <span className="meta-sep">·</span>
              <span>
                Active Handle:{' '}
                <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {currentTagChecking}
                </strong>
              </span>
              <span className="meta-sep">·</span>
              <span>
                Request Delay:{' '}
                <span className="tabular-nums">
                  {activeDelayMs > 0
                    ? `${activeDelayMs}ms ${isBackingOff ? '(Exponential Backoff)' : '(Randomized Jitter)'}`
                    : `${rateConfig.baseDelayMs}–${rateConfig.baseDelayMs + rateConfig.maxJitterMs}ms`}
                </span>
              </span>
            </div>

            <div className="progress-stats-inline">
              <span>
                Progress: {progressCompleted} / {progressTarget} (
                {Math.round(progressRatio * 100)}%)
              </span>
              <span className="meta-sep"> · </span>
              <span>Elapsed: {elapsedSeconds}s</span>
            </div>
          </div>

          <div
            className="progress-track"
            role="progressbar"
            aria-valuenow={Math.round(progressRatio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`progress-fill ${isBackingOff ? 'warning' : ''}`}
              style={{ transform: `scaleX(${progressRatio})` }}
            />
          </div>
        </section>

        {/* TAB 1: SCANNER & CONFIGURATION WORKSPACE */}
        {activeTab === 'scanner' && (
          <div className="workspace-grid">
            {/* Left Column: Configuration Controls */}
            <aside className="panel" aria-label="Scanner Configuration">
              {/* Section 1: Target App / Platform Selection */}
              <div className="panel-section">
                <h2 className="section-heading">01. Target App / Platform</h2>
                <p className="section-description">
                  Select the platform to enforce its exact username syntax rules and live verification endpoints.
                </p>

                <div className="platform-selector-grid" role="group" aria-label="Select Target Platform">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`platform-btn ${selectedPlatform === p.id ? 'active' : ''}`}
                      onClick={() => setSelectedPlatform(p.id)}
                    >
                      <div className="platform-btn-content">
                        <span className="platform-icon-badge" data-platform={p.id} aria-hidden="true">
                          <PlatformIcon platform={p.id} size={15} />
                        </span>
                        <span className="platform-btn-label">{p.shortLabel}</span>
                      </div>
                      <span className="platform-btn-prefix">
                        {p.handlePrefix || `${p.minLen}–${p.maxLen}c`}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="platform-rule-box">
                  <span className="platform-rule-icon" aria-hidden="true">
                    <PlatformIcon platform={activePlatformSpec.id} size={16} />
                  </span>
                  <div>
                    <strong>{activePlatformSpec.label} Rules:</strong> {activePlatformSpec.syntaxSummary}
                  </div>
                </div>
              </div>

              {/* Section 2: List Source Mode */}
              <div className="panel-section">
                <h2 className="section-heading">02. Username Source</h2>
                <p className="section-description">
                  Synthesize fresh unclaimed rare handles or verify a specific list.
                </p>

                <div className="segmented-group" role="group" aria-label="Username Source Mode">
                  <button
                    type="button"
                    className={`segmented-btn ${sourceMode === 'RARE_GENERATED' ? 'active' : ''}`}
                    onClick={() => setSourceMode('RARE_GENERATED')}
                  >
                    Rare Generated List
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${sourceMode === 'SPECIFIC_LIST' ? 'active' : ''}`}
                    onClick={() => setSourceMode('SPECIFIC_LIST')}
                  >
                    Specific Names List
                  </button>
                </div>

                {sourceMode === 'RARE_GENERATED' ? (
                  <div>
                    <div className="field-group">
                      <label className="field-label" htmlFor="pattern-select">
                        <span>Unclaimed Synthesis Pattern</span>
                        <span className="field-hint">{activePlatformSpec.shortLabel}</span>
                      </label>
                      <select
                        id="pattern-select"
                        className="select-control"
                        value={generatorPattern}
                        onChange={(e) => setGeneratorPattern(e.target.value as GeneratorPattern)}
                      >
                        <option value="clean_og">Archaic Root + Rare Cluster (e.g., SkerryVq, CairnXz)</option>
                        <option value="4char_cvcv">Pronounceable 6-Char Synth (e.g., Kavovx, Zelukr)</option>
                        <option value="mcpe_compound">Clean Rare Compounds (e.g., VoidKestrel, SlateWhorl)</option>
                        <option value="semi_repeat">Mirrored Phonetic (e.g., Kavkavvq, Zelzelxz)</option>
                        <option value="3char_alnum">5-Char Alphanumeric Code (e.g., V9kXz, Q7xVq)</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm btn-block"
                      onClick={() => {
                        handleGeneratePreviewSample();
                        setSourceMode('SPECIFIC_LIST');
                      }}
                    >
                      Generate Sample {activePlatformSpec.shortLabel} List into Editor
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="field-group">
                      <label className="field-label" htmlFor="specific-list-textarea">
                        <span>Usernames (1 per line or comma-separated)</span>
                        <span className="field-hint">
                          {specificListAnalysis.validCount} valid · {specificListAnalysis.invalidCount} invalid
                        </span>
                      </label>
                      <textarea
                        id="specific-list-textarea"
                        className="textarea-control"
                        value={specificNamesInput}
                        onChange={(e) => setSpecificNamesInput(e.target.value)}
                        placeholder={`Enter ${activePlatformSpec.label} usernames to check...`}
                      />
                    </div>

                    <div className="action-row">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.csv"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Import .TXT / .CSV
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleGeneratePreviewSample}
                      >
                        Fill with Fresh Candidates
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Target Count & Taken Filtering */}
              <div className="panel-section">
                <h2 className="section-heading">03. Completion Target &amp; Filtering</h2>
                <p className="section-description">
                  Keep scanning until the required number of genuinely available handles is found.
                </p>

                <div className="field-group">
                  <label className="field-label" htmlFor="stop-mode-select">
                    <span>Batch Stop Condition</span>
                  </label>
                  <select
                    id="stop-mode-select"
                    className="select-control"
                    value={targetConfig.stopMode}
                    onChange={(e) =>
                      setTargetConfig((prev) => ({
                        ...prev,
                        stopMode: e.target.value as 'TOTAL_CHECKED' | 'AVAILABLE_FOUND',
                      }))
                    }
                  >
                    <option value="AVAILABLE_FOUND">Finish after N Available Usernames Found</option>
                    <option value="TOTAL_CHECKED">Finish after N Total Usernames Checked</option>
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="target-count-input">
                    <span>
                      {targetConfig.stopMode === 'AVAILABLE_FOUND'
                        ? 'Available Usernames Needed'
                        : 'Total Usernames to Verify'}
                    </span>
                    <span className="field-hint">{targetConfig.targetCount} handles</span>
                  </label>
                  <input
                    id="target-count-input"
                    type="number"
                    min={1}
                    max={500}
                    className="input-control tabular-nums"
                    value={targetConfig.targetCount}
                    onChange={(e) =>
                      setTargetConfig((prev) => ({
                        ...prev,
                        targetCount: Math.max(1, Math.min(500, Number(e.target.value) || 1)),
                      }))
                    }
                  />
                </div>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={targetConfig.skipTakenFromTable}
                    onChange={(e) =>
                      setTargetConfig((prev) => ({
                        ...prev,
                        skipTakenFromTable: e.target.checked,
                      }))
                    }
                  />
                  <span>Auto-skip already-used (TAKEN) handles — only collect AVAILABLE</span>
                </label>
              </div>

              {/* Section 4: Rate-Limit Protection & Exponential Backoff */}
              <div className="panel-section">
                <h2 className="section-heading">04. Rate-Limit &amp; Backoff Policy</h2>
                <p className="section-description">
                  Randomized request jitter and exponential backoff prevent upstream HTTP 429 bans.
                </p>

                <div className="form-row-2col">
                  <div className="field-group">
                    <label className="field-label" htmlFor="base-delay-input">
                      <span>Base Delay</span>
                      <span className="field-hint">ms</span>
                    </label>
                    <input
                      id="base-delay-input"
                      type="number"
                      min={100}
                      max={10000}
                      step={50}
                      className="input-control tabular-nums"
                      value={rateConfig.baseDelayMs}
                      onChange={(e) =>
                        setRateConfig((prev) => ({
                          ...prev,
                          baseDelayMs: Math.max(100, Number(e.target.value) || 100),
                        }))
                      }
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="jitter-input">
                      <span>Random Jitter</span>
                      <span className="field-hint">+0..ms</span>
                    </label>
                    <input
                      id="jitter-input"
                      type="number"
                      min={0}
                      max={5000}
                      step={50}
                      className="input-control tabular-nums"
                      value={rateConfig.maxJitterMs}
                      onChange={(e) =>
                        setRateConfig((prev) => ({
                          ...prev,
                          maxJitterMs: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="form-row-2col" style={{ marginTop: '10px' }}>
                  <div className="field-group">
                    <label className="field-label" htmlFor="backoff-factor-select">
                      <span>Backoff Factor</span>
                    </label>
                    <select
                      id="backoff-factor-select"
                      className="select-control tabular-nums"
                      value={rateConfig.backoffFactor}
                      onChange={(e) =>
                        setRateConfig((prev) => ({
                          ...prev,
                          backoffFactor: Number(e.target.value),
                        }))
                      }
                    >
                      <option value={1.5}>1.5x Exponential</option>
                      <option value={2.0}>2.0x Exponential</option>
                      <option value={2.5}>2.5x Exponential</option>
                      <option value={3.0}>3.0x Aggressive</option>
                    </select>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="max-retries-input">
                      <span>Max Retries</span>
                    </label>
                    <input
                      id="max-retries-input"
                      type="number"
                      min={0}
                      max={8}
                      className="input-control tabular-nums"
                      value={rateConfig.maxRetries}
                      onChange={(e) =>
                        setRateConfig((prev) => ({
                          ...prev,
                          maxRetries: Math.max(0, Math.min(8, Number(e.target.value) || 0)),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="field-group" style={{ marginTop: '10px' }}>
                  <label className="field-label" htmlFor="os-compat-select">
                    <span>Cross-Platform Export Format</span>
                    <span className="field-hint">{lineEnding}</span>
                  </label>
                  <select
                    id="os-compat-select"
                    className="select-control"
                    value={osPlatform}
                    onChange={(e) => setOsPlatform(e.target.value as 'Windows' | 'macOS')}
                  >
                    <option value="Windows">Windows (CRLF \r\n — Excel &amp; Notepad compatible)</option>
                    <option value="macOS">macOS / Unix (LF \n — Numbers &amp; Terminal compatible)</option>
                  </select>
                </div>

                {selectedPlatform === 'xbox_mcpe' && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rateConfig.strict12CharLimit}
                      onChange={(e) =>
                        setRateConfig((prev) => ({
                          ...prev,
                          strict12CharLimit: e.target.checked,
                        }))
                      }
                    />
                    <span>Enforce modern 12-char limit (default 15-char MCPE classic)</span>
                  </label>
                )}
              </div>

              {/* Primary Execution Controls */}
              <div>
                {!isRunning ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={() => void startVerificationBatch(false)}
                  >
                    Find {targetConfig.targetCount} {activePlatformSpec.shortLabel}{' '}
                    {targetConfig.stopMode === 'AVAILABLE_FOUND' ? 'Available Handles' : 'Handles'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-danger btn-block"
                    onClick={stopVerificationBatch}
                  >
                    Stop Active Process
                  </button>
                )}
              </div>
            </aside>

            {/* Right Column: Live Verification Queue & Results Data Table */}
            <section className="panel" aria-label="Verification Results">
              <div className="table-toolbar">
                <div className="filter-tabs" role="tablist" aria-label="Filter Verification Status">
                  <button
                    type="button"
                    className={`filter-tab-btn ${resultFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setResultFilter('ALL')}
                  >
                    All ({statsSummary.total})
                  </button>
                  <button
                    type="button"
                    className={`filter-tab-btn ${resultFilter === 'AVAILABLE' ? 'active' : ''}`}
                    onClick={() => setResultFilter('AVAILABLE')}
                  >
                    Available ({statsSummary.available})
                  </button>
                  <button
                    type="button"
                    className={`filter-tab-btn ${resultFilter === 'TAKEN' ? 'active' : ''}`}
                    onClick={() => setResultFilter('TAKEN')}
                  >
                    Taken ({statsSummary.taken})
                  </button>
                  <button
                    type="button"
                    className={`filter-tab-btn ${resultFilter === 'ERROR' ? 'active' : ''}`}
                    onClick={() => setResultFilter('ERROR')}
                  >
                    Invalid / Errors ({statsSummary.errors})
                  </button>
                </div>

                <div className="action-row">
                  <select
                    className="select-control"
                    style={{ width: 'auto', minWidth: '150px', padding: '6px 10px', fontSize: '12px' }}
                    aria-label="Filter table by platform"
                    value={platformTableFilter}
                    onChange={(e) => setPlatformTableFilter(e.target.value as PlatformId | 'ALL')}
                  >
                    <option value="ALL">All Platforms</option>
                    {PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>

                  <div className="search-input-wrap">
                    <input
                      type="search"
                      className="input-control"
                      style={{ padding: '6px 10px', fontSize: '13px' }}
                      placeholder="Search username or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleExportVaultTxt}
                  >
                    Export Available (.TXT)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleExportRecordsCsv(true)}
                  >
                    Export Available (.CSV)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={isRunning}
                    onClick={() => setRecords([])}
                  >
                    Clear Table
                  </button>
                </div>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="empty-state-box">
                  <div className="empty-state-title">No verification records match current view</div>
                  <p className="empty-state-desc">
                    Select an app (Xbox/MCPE, Minecraft, Discord, Twitter/X, TikTok, Instagram, Facebook, or Reddit) and click Find Available Handles to start checking live availability.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={isRunning}
                    onClick={() => void startVerificationBatch(false)}
                  >
                    Find {activePlatformSpec.shortLabel} Available Handles Now
                  </button>
                </div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Username / Handle</th>
                        <th>Platform</th>
                        <th>Availability Status</th>
                        <th>Live Upstream Verification Proof</th>
                        <th className="num-col">Delay / Latency</th>
                        <th>Direct Verification Links</th>
                        <th className="num-col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((rec) => {
                        const recPlatform = rec.platform || 'xbox_mcpe';
                        const spec = getPlatformSpec(recPlatform);
                        const links = getPlatformVerificationLinks(rec.gamertag, recPlatform);
                        const isSaved = savedVault.some(
                          (v) =>
                            v.gamertag.toLowerCase() === rec.gamertag.toLowerCase() &&
                            (v.platform || 'xbox_mcpe') === recPlatform
                        );
                        return (
                          <tr key={rec.id}>
                            <td>
                              <div className="gamertag-cell">
                                {spec.handlePrefix}
                                {rec.gamertag}
                              </div>
                              <div className="field-hint">
                                {rec.sourceMode === 'RARE_GENERATED'
                                  ? `Rare · ${rec.patternUsed || 'synth'}`
                                  : 'Specific List'}{' '}
                                · {rec.checkedAt}
                              </div>
                            </td>

                            <td>
                              <span className="platform-badge-cell">
                                <PlatformIcon platform={recPlatform} size={14} />
                                <span>{spec.shortLabel}</span>
                              </span>
                            </td>

                            <td>
                              <span
                                className={`status-text ${
                                  rec.status === 'AVAILABLE'
                                    ? 'available'
                                    : rec.status === 'TAKEN'
                                    ? 'taken'
                                    : rec.status === 'RATE_LIMITED'
                                    ? 'warning'
                                    : 'error'
                                }`}
                              >
                                {rec.status}
                              </span>
                            </td>

                            <td>
                              <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                                {rec.xuid ? (
                                  <span className="tabular-nums">ID: {rec.xuid}</span>
                                ) : (
                                  <span>{rec.reason}</span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {rec.upstreamDetails}
                              </div>
                            </td>

                            <td className="num-col">
                              <div>{rec.latencyMs !== null ? `${rec.latencyMs}ms` : '—'}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Wait {rec.lastDelayMs}ms · {rec.attempts}x
                              </div>
                            </td>

                            <td>
                              <div className="verify-links-inline">
                                {links.map((lnk, idx) => (
                                  <React.Fragment key={lnk.label}>
                                    {idx > 0 && <span className="meta-sep">·</span>}
                                    <a
                                      href={lnk.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="verify-link"
                                      title={lnk.title}
                                    >
                                      {lnk.label}
                                    </a>
                                  </React.Fragment>
                                ))}
                              </div>
                            </td>

                            <td className="num-col">
                              <div className="action-row" style={{ justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleCopyTag(rec.gamertag)}
                                >
                                  {copiedTag === rec.gamertag ? 'Copied' : 'Copy'}
                                </button>
                                {rec.status === 'AVAILABLE' && !isSaved && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => addRecordToVault(rec)}
                                  >
                                    Save
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: SAVED AVAILABLE USERNAMES VAULT (LOCAL STORAGE) */}
        {activeTab === 'vault' && (
          <section className="panel" aria-label="Saved Available Usernames Vault">
            <div className="table-toolbar">
              <div>
                <h2 className="section-heading">
                  Confirmed Available Usernames Vault ({filteredVault.length} Shown / {savedVault.length} Stored in LocalStorage)
                </h2>
                <p className="section-description" style={{ marginBottom: 0 }}>
                  Only handles confirmed unregistered by live upstream APIs are persisted in LocalStorage.
                </p>
              </div>

              <div className="action-row">
                <select
                  className="select-control"
                  style={{ width: 'auto', minWidth: '155px', padding: '6px 10px', fontSize: '12px' }}
                  aria-label="Filter vault by platform"
                  value={vaultPlatformFilter}
                  onChange={(e) => setVaultPlatformFilter(e.target.value as PlatformId | 'ALL')}
                >
                  <option value="ALL">All Platforms ({savedVault.length})</option>
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={filteredVault.length === 0}
                  onClick={handleExportVaultTxt}
                >
                  Export Available as .TXT ({lineEnding})
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={filteredVault.length === 0}
                  onClick={() => {
                    const csv = buildCsvExportContent(filteredVault, lineEnding);
                    triggerFileDownload(
                      csv,
                      `xtag-vault-available-${osPlatform.toLowerCase()}.csv`,
                      'text/csv;charset=utf-8'
                    );
                  }}
                >
                  Export Vault as .CSV
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={filteredVault.length === 0}
                  onClick={() => {
                    const allText = filteredVault
                      .map((r) => r.gamertag)
                      .join(lineEnding === 'CRLF' ? '\r\n' : '\n');
                    handleCopyTag(allText);
                  }}
                >
                  Copy All Tags
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={savedVault.length === 0}
                  onClick={() => setSavedVault([])}
                >
                  Clear Vault
                </button>
              </div>
            </div>

            <form
              onSubmit={handleAddManualVaultTag}
              className="action-row"
              style={{ marginTop: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}
            >
              <select
                className="select-control"
                style={{ maxWidth: '180px' }}
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value as PlatformId)}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                className="input-control"
                style={{ maxWidth: '260px' }}
                placeholder={`Bookmark ${activePlatformSpec.shortLabel} handle...`}
                value={manualVaultInput}
                onChange={(e) => setManualVaultInput(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary btn-sm">
                Add to LocalStorage Vault
              </button>
            </form>

            {filteredVault.length === 0 ? (
              <div className="empty-state-box">
                <div className="empty-state-title">No available usernames in Vault for this filter</div>
                <p className="empty-state-desc">
                  Run the Verification Console to automatically populate confirmed available usernames here.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveTab('scanner')}
                >
                  Go to Verification Console
                </button>
              </div>
            ) : (
              <div className="vault-grid">
                {filteredVault.map((item) => {
                  const itemPlatform = item.platform || 'xbox_mcpe';
                  const spec = getPlatformSpec(itemPlatform);
                  const links = getPlatformVerificationLinks(item.gamertag, itemPlatform);
                  return (
                    <div key={item.id} className="vault-item">
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            marginBottom: '6px',
                          }}
                        >
                          <span className="vault-tag-title">
                            {spec.handlePrefix}
                            {item.gamertag}
                          </span>
                          <span className="field-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <PlatformIcon platform={itemPlatform} size={13} />
                            {spec.shortLabel} · {item.gamertag.length}c
                          </span>
                        </div>
                        <div className="vault-meta-line">{item.reason}</div>
                        <div className="vault-meta-line" style={{ marginTop: '2px' }}>
                          Checked: {item.checkedAt || 'Saved'} · {item.latencyMs ?? 0}ms
                        </div>
                      </div>

                      <div>
                        <div className="verify-links-inline" style={{ marginBottom: '10px' }}>
                          {links.map((lnk, idx) => (
                            <React.Fragment key={lnk.label}>
                              {idx > 0 && <span className="meta-sep">·</span>}
                              <a
                                href={lnk.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="verify-link"
                                title={lnk.title}
                              >
                                {lnk.label}
                              </a>
                            </React.Fragment>
                          ))}
                        </div>

                        <div className="action-row">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCopyTag(item.gamertag)}
                          >
                            {copiedTag === item.gamertag ? 'Copied' : 'Copy Handle'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => removeTagFromVault(item.gamertag, itemPlatform)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: AUTOMATED SCHEDULING, EMAIL NOTIFICATIONS & CROSS-PLATFORM CLI */}
        {activeTab === 'scheduler' && (
          <div className="two-col-grid">
            <section className="panel" aria-label="Automated Scheduler and Email Notifications">
              <div className="panel-section">
                <h2 className="section-heading">01. Automated Batch Scheduler</h2>
                <p className="section-description">
                  Automatically trigger recurring username verification runs for {activePlatformSpec.label} at a fixed interval.
                </p>

                <label className="checkbox-label" style={{ marginBottom: '14px' }}>
                  <input
                    type="checkbox"
                    checked={schedulerConfig.enabled}
                    onChange={(e) =>
                      setSchedulerConfig((prev) => ({
                        ...prev,
                        enabled: e.target.checked,
                      }))
                    }
                  />
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Enable Recurring Scheduled Verification
                  </strong>
                </label>

                <div className="form-row-2col">
                  <div className="field-group">
                    <label className="field-label" htmlFor="schedule-interval-input">
                      <span>Run Interval (Minutes)</span>
                    </label>
                    <input
                      id="schedule-interval-input"
                      type="number"
                      min={1}
                      max={1440}
                      className="input-control tabular-nums"
                      value={schedulerConfig.intervalMinutes}
                      onChange={(e) => {
                        const mins = Math.max(1, Math.min(1440, Number(e.target.value) || 1));
                        setSchedulerConfig((prev) => ({ ...prev, intervalMinutes: mins }));
                        setSecondsUntilNextRun(mins * 60);
                      }}
                    />
                  </div>

                  <div className="field-group">
                    <span className="field-label">
                      <span>Next Scheduled Execution</span>
                      <span className="field-hint">Runs: {scheduledRunsCompleted}</span>
                    </span>
                    <div
                      className="input-control tabular-nums"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span>
                        {schedulerConfig.enabled
                          ? `In ${Math.floor(secondsUntilNextRun / 60)}m ${secondsUntilNextRun % 60}s`
                          : 'Paused'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ minHeight: '24px', padding: '2px 8px' }}
                        disabled={isRunning}
                        onClick={() => void startVerificationBatch(true)}
                      >
                        Run Now
                      </button>
                    </div>
                  </div>
                </div>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={schedulerConfig.autoExportCsv}
                    onChange={(e) =>
                      setSchedulerConfig((prev) => ({
                        ...prev,
                        autoExportCsv: e.target.checked,
                      }))
                    }
                  />
                  <span>Automatically download CSV report upon scheduled batch completion</span>
                </label>
              </div>

              <div className="panel-section">
                <h2 className="section-heading">02. Completion Email Notifications</h2>
                <p className="section-description">
                  Dispatch an automated summary report with discovered available usernames when a batch finishes.
                </p>

                <label className="checkbox-label" style={{ marginBottom: '14px' }}>
                  <input
                    type="checkbox"
                    checked={schedulerConfig.emailNotificationEnabled}
                    onChange={(e) =>
                      setSchedulerConfig((prev) => ({
                        ...prev,
                        emailNotificationEnabled: e.target.checked,
                      }))
                    }
                  />
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Send Email Notification Upon Process Completion
                  </strong>
                </label>

                <div className="field-group">
                  <label className="field-label" htmlFor="recipient-email-input">
                    <span>Recipient Email Address</span>
                  </label>
                  <input
                    id="recipient-email-input"
                    type="email"
                    className="input-control"
                    value={schedulerConfig.recipientEmail}
                    onChange={(e) =>
                      setSchedulerConfig((prev) => ({
                        ...prev,
                        recipientEmail: e.target.value,
                      }))
                    }
                    placeholder="user@example.com"
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="notify-trigger-select">
                    <span>Notification Trigger Condition</span>
                  </label>
                  <select
                    id="notify-trigger-select"
                    className="select-control"
                    value={schedulerConfig.notifyTrigger}
                    onChange={(e) =>
                      setSchedulerConfig((prev) => ({
                        ...prev,
                        notifyTrigger: e.target.value as
                          | 'ON_COMPLETION'
                          | 'ON_AVAILABLE_FOUND'
                          | 'ON_ERROR',
                      }))
                    }
                  >
                    <option value="ON_COMPLETION">Every Batch Completion (Full Summary)</option>
                    <option value="ON_AVAILABLE_FOUND">Only When Available Usernames Are Found</option>
                    <option value="ON_ERROR">Only When Rate-Limit / Validation Errors Occur</option>
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="webhook-url-input">
                    <span>Optional Webhook / Relay Endpoint URL</span>
                    <span className="field-hint">POST JSON</span>
                  </label>
                  <input
                    id="webhook-url-input"
                    type="url"
                    className="input-control"
                    value={schedulerConfig.webhookUrl}
                    onChange={(e) =>
                      setSchedulerConfig((prev) => ({
                        ...prev,
                        webhookUrl: e.target.value,
                      }))
                    }
                    placeholder="https://hooks.example.com/notify (optional)"
                  />
                </div>

                <div className="action-row" style={{ marginTop: '14px' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={isSendingEmail}
                    onClick={() => void dispatchCompletionEmail(records)}
                  >
                    {isSendingEmail ? 'Dispatching...' : 'Send Test Completion Email Now'}
                  </button>

                  <a
                    href={`mailto:${encodeURIComponent(
                      schedulerConfig.recipientEmail
                    )}?subject=${encodeURIComponent(
                      `XTag Verify Available Usernames (${savedVault.length})`
                    )}&body=${encodeURIComponent(
                      `Available Usernames:\n${savedVault
                        .map((v) => `- ${v.gamertag} [${getPlatformSpec(v.platform || 'xbox_mcpe').shortLabel}]`)
                        .join('\n')}`
                    )}`}
                    className="btn btn-secondary btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    Open in System Mail Client
                  </a>
                </div>
              </div>

              <div>
                <h3 className="section-heading">Dispatched Notification Outbox ({emailReceipts.length})</h3>
                {emailReceipts.length === 0 ? (
                  <p className="section-description" style={{ marginBottom: 0 }}>
                    No completion emails dispatched in this session yet. Click &ldquo;Send Test Completion Email Now&rdquo; or run a batch with notifications enabled.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {emailReceipts.map((receipt) => (
                      <div key={receipt.id} className="code-preview-block">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '8px',
                            borderBottom: '1px solid var(--border-subtle)',
                            paddingBottom: '6px',
                          }}
                        >
                          <strong>To: {receipt.recipient}</strong>
                          <span>
                            {receipt.timestamp} ·{' '}
                            <button
                              type="button"
                              className="verify-link"
                              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                              onClick={() =>
                                triggerFileDownload(
                                  receipt.rfc5322Message,
                                  `xtag-report-${Date.now()}.eml`,
                                  'message/rfc822'
                                )
                              }
                            >
                              Download .EML
                            </button>
                          </span>
                        </div>
                        <div>{receipt.rfc5322Message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Right Column: Windows & macOS Standalone Automation Script */}
            <section className="panel" aria-label="Cross-Platform OS Compatibility and CLI Export">
              <h2 className="section-heading">
                Cross-Platform Native Script ({activePlatformSpec.shortLabel} · {osPlatform === 'Windows' ? 'PowerShell' : 'Bash'})
              </h2>
              <p className="section-description">
                Export a standalone verification script pre-configured for {activePlatformSpec.label} with your exact exponential backoff and jitter timings.
              </p>

              <div className="segmented-group" role="group" aria-label="Target OS Platform">
                <button
                  type="button"
                  className={`segmented-btn ${osPlatform === 'Windows' ? 'active' : ''}`}
                  onClick={() => setOsPlatform('Windows')}
                >
                  Windows 10/11 (PowerShell · CRLF)
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${osPlatform === 'macOS' ? 'active' : ''}`}
                  onClick={() => setOsPlatform('macOS')}
                >
                  macOS / Linux (Bash · LF)
                </button>
              </div>

              <pre className="code-preview-block" style={{ marginBottom: '14px' }}>
                {cliScriptPreview}
              </pre>

              <div className="action-row">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    triggerFileDownload(
                      cliScriptPreview,
                      osPlatform === 'Windows'
                        ? `xtag-${selectedPlatform}.ps1`
                        : `xtag-${selectedPlatform}.sh`,
                      'text/plain;charset=utf-8'
                    )
                  }
                >
                  Download {osPlatform === 'Windows' ? `xtag-${selectedPlatform}.ps1` : `xtag-${selectedPlatform}.sh`}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleCopyTag(cliScriptPreview)}
                >
                  {copiedTag === cliScriptPreview ? 'Copied Script' : 'Copy Script to Clipboard'}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* TAB 4: EXECUTION & ERROR DEBUG LOGS */}
        {activeTab === 'logs' && (
          <section className="panel" aria-label="Execution and Error Debug Logs">
            <div className="table-toolbar">
              <div className="filter-tabs" role="tablist" aria-label="Log Severity Filter">
                <button
                  type="button"
                  className={`filter-tab-btn ${logFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setLogFilter('ALL')}
                >
                  All ({logs.length})
                </button>
                <button
                  type="button"
                  className={`filter-tab-btn ${logFilter === 'RATE_LIMIT' ? 'active' : ''}`}
                  onClick={() => setLogFilter('RATE_LIMIT')}
                >
                  429 Backoffs ({logs.filter((l) => l.severity === 'RATE_LIMIT').length})
                </button>
                <button
                  type="button"
                  className={`filter-tab-btn ${logFilter === 'ERROR' ? 'active' : ''}`}
                  onClick={() => setLogFilter('ERROR')}
                >
                  Errors ({logs.filter((l) => l.severity === 'ERROR').length})
                </button>
                <button
                  type="button"
                  className={`filter-tab-btn ${logFilter === 'SUCCESS' ? 'active' : ''}`}
                  onClick={() => setLogFilter('SUCCESS')}
                >
                  Available Hits ({logs.filter((l) => l.severity === 'SUCCESS').length})
                </button>
              </div>

              <div className="action-row">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={isRunning}
                  onClick={() => void handleSimulate429Fault()}
                >
                  Simulate HTTP 429 Backoff Fault ({activePlatformSpec.shortLabel})
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleExportDebugLog}
                >
                  Export Debug Log (.LOG)
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setLogs([])}
                >
                  Clear Log
                </button>
              </div>
            </div>

            <div className="log-stream" style={{ marginTop: '16px' }}>
              {filteredLogs.length === 0 ? (
                <div className="empty-state-box">
                  <div className="empty-state-title">No log entries for selected severity</div>
                </div>
              ) : (
                filteredLogs.map((entry) => (
                  <div key={entry.id} className="log-row">
                    <span className="log-time">{entry.timestamp}</span>
                    <span
                      className={`status-text ${
                        entry.severity === 'SUCCESS'
                          ? 'available'
                          : entry.severity === 'RATE_LIMIT' || entry.severity === 'WARN'
                          ? 'warning'
                          : entry.severity === 'ERROR'
                          ? 'error'
                          : 'taken'
                      }`}
                    >
                      {entry.severity}
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {entry.gamertag || 'SYSTEM'}
                      {entry.attempt ? ` (#${entry.attempt})` : ''}
                    </span>
                    <div>
                      <div style={{ color: 'var(--text-primary)' }}>{entry.message}</div>
                      {entry.details && (
                        <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                          {entry.details}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <div>
          XTag Verify · Multi-Platform Username &amp; Gamertag Availability Verifier (Xbox/MCPE, Minecraft, Discord, Twitter/X, TikTok, Instagram, Facebook, Reddit)
        </div>
        <div>
          Platform Compatibility: Windows (CRLF) &amp; macOS (LF) · LocalStorage Persistence Active
        </div>
      </footer>
    </div>
  );
}
