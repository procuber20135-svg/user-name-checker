export type GeneratorPattern =
  | '4char_cvcv'
  | '3char_alnum'
  | 'clean_og'
  | 'semi_repeat'
  | 'mcpe_compound';

export type VerificationStatus =
  | 'PENDING'
  | 'CHECKING'
  | 'AVAILABLE'
  | 'TAKEN'
  | 'RATE_LIMITED'
  | 'INVALID'
  | 'ERROR';

export interface GamertagRecord {
  id: string;
  gamertag: string;
  resolvedGamertag?: string;
  status: VerificationStatus;
  xboxMcpeStatus: 'AVAILABLE' | 'TAKEN' | 'INVALID' | 'UNKNOWN';
  javaStatus: 'AVAILABLE' | 'TAKEN' | 'INVALID' | 'UNKNOWN';
  xuid: string | null;
  latencyMs: number | null;
  attempts: number;
  lastDelayMs: number;
  checkedAt: string | null;
  reason: string;
  upstreamDetails: string;
  sourceMode: 'RARE_GENERATED' | 'SPECIFIC_LIST';
  patternUsed?: string;
}

export type LogSeverity = 'INFO' | 'WARN' | 'RATE_LIMIT' | 'ERROR' | 'SUCCESS';

export interface ExecutionLogEntry {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  gamertag?: string;
  attempt?: number;
  httpStatus?: number;
  backoffMs?: number;
  message: string;
  details?: string;
}

export interface RateLimitConfig {
  baseDelayMs: number;
  maxJitterMs: number;
  maxRetries: number;
  backoffFactor: number;
  strict12CharLimit: boolean;
  simulate429Probability: number;
}

export interface TargetStopConfig {
  stopMode: 'TOTAL_CHECKED' | 'AVAILABLE_FOUND';
  targetCount: number;
}

export interface SchedulerConfig {
  enabled: boolean;
  intervalMinutes: number;
  autoExportCsv: boolean;
  emailNotificationEnabled: boolean;
  recipientEmail: string;
  notifyTrigger: 'ON_COMPLETION' | 'ON_AVAILABLE_FOUND' | 'ON_ERROR';
  webhookUrl: string;
}

const CONSONANTS = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W', 'X', 'Z'];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'y'];
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const ARCHAIC_ROOTS = [
  'Beryl', 'Cairn', 'Scion', 'Tarn', 'Fjord', 'Vesper', 'Flint', 'Silt',
  'Loom', 'Gale', 'Skerry', 'Brine', 'Kestrel', 'Onyx', 'Pyre', 'Rime',
  'Sable', 'Talon', 'Umber', 'Vale', 'Whorl', 'Zephyr', 'Aegis', 'Basalt',
  'Cinder', 'Dusk', 'Eddy', 'Fen', 'Glint', 'Hearth', 'Inlet', 'Jilt',
  'Knoll', 'Lichen', 'Mire', 'Nadir', 'Ochre', 'Pith', 'Quill', 'Rift',
  'Shard', 'Thicket', 'Urn', 'Vane', 'Weir', 'Yarrow', 'Zenith', 'Briar',
];

const MCPE_PREFIXES = [
  'Void', 'Nether', 'Ender', 'Slate', 'Quartz', 'Redstone', 'Prism', 'Sculk',
  'Basalt', 'Copper', 'Amethyst', 'Bedrock', 'Cobalt', 'Obsidian', 'Crimson',
];

const MCPE_SUFFIXES = [
  'Vein', 'Rift', 'Shard', 'Core', 'Warden', 'Golem', 'Spire', 'Vault',
  'Strider', 'Beacon', 'Anvil', 'Crafter', 'Relic', 'Forge', 'Pulse',
];

export function validateTagLocally(rawTag: string, strict12 = false): { valid: boolean; reason?: string } {
  const tag = rawTag.trim();
  if (!tag) {
    return { valid: false, reason: 'Empty gamertag.' };
  }
  if (tag.length < 3) {
    return { valid: false, reason: 'Minimum length is 3 characters.' };
  }
  if (strict12 && tag.length > 12) {
    return { valid: false, reason: 'Exceeds modern 12-character Xbox suffix-free limit.' };
  }
  if (tag.length > 15) {
    return { valid: false, reason: 'Exceeds 15-character MCPE/Xbox maximum limit.' };
  }
  if (!/^[A-Za-z]/.test(tag)) {
    return { valid: false, reason: 'Must start with a letter (A–Z).' };
  }
  if (!/^[A-Za-z0-9 ]+$/.test(tag)) {
    return { valid: false, reason: 'Only letters, numbers, and single spaces allowed.' };
  }
  if (/\s{2,}/.test(tag)) {
    return { valid: false, reason: 'Consecutive spaces are prohibited.' };
  }
  return { valid: true };
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateSingleRareTag(pattern: GeneratorPattern): string {
  switch (pattern) {
    case '3char_alnum': {
      const c1 = randomItem(CONSONANTS);
      const c2 = randomItem(CONSONANTS).toLowerCase();
      const d = randomItem(DIGITS);
      return Math.random() > 0.45 ? `${c1}${d}${c2.toUpperCase()}` : `${c1}${c2}${d}`;
    }
    case '4char_cvcv': {
      const c1 = randomItem(CONSONANTS);
      const v1 = randomItem(VOWELS);
      const c2 = randomItem(CONSONANTS).toLowerCase();
      const v2 = randomItem(VOWELS);
      return `${c1}${v1}${c2}${v2}`;
    }
    case 'semi_repeat': {
      const c1 = randomItem(CONSONANTS);
      const v1 = randomItem(VOWELS);
      const d = randomItem(DIGITS);
      const mode = Math.random();
      if (mode < 0.35) {
        return `${c1}${d}${c1}${d}`;
      } else if (mode < 0.7) {
        const c2 = randomItem(CONSONANTS).toLowerCase();
        return `${c1}${v1}${c2}${c2}${v1}`;
      } else {
        return `${c1}${v1}${v1}${c1.toLowerCase()}${d}`;
      }
    }
    case 'clean_og': {
      const root = randomItem(ARCHAIC_ROOTS);
      const suffix = Math.random() > 0.3 ? randomItem(['x', 'z', 'v', 'q', 'k', 'r', 'n', '7', '9']) : '';
      const sub = Math.random() > 0.6 ? randomItem(['o', 'a', 'e', 'i']) : '';
      return `${root}${sub}${suffix}`.slice(0, 12);
    }
    case 'mcpe_compound': {
      const p = randomItem(MCPE_PREFIXES);
      const s = randomItem(MCPE_SUFFIXES);
      const sep = Math.random() > 0.65 ? ' ' : '';
      const combined = `${p}${sep}${s}`;
      if (combined.length <= 15) return combined;
      return `${p}${s}`.slice(0, 12);
    }
  }
}

export function generateRareGamertags(
  count: number,
  pattern: GeneratorPattern,
  existingTags: Set<string> = new Set()
): string[] {
  const results: string[] = [];
  const used = new Set<string>(Array.from(existingTags).map((t) => t.toLowerCase()));
  let safetyCounter = 0;
  const maxAttempts = count * 25;

  while (results.length < count && safetyCounter < maxAttempts) {
    safetyCounter++;
    const candidate = generateSingleRareTag(pattern);
    const lower = candidate.toLowerCase();
    if (!used.has(lower) && validateTagLocally(candidate).valid) {
      used.add(lower);
      results.push(candidate);
    }
  }
  return results;
}

export function calculateNormalDelay(baseDelayMs: number, maxJitterMs: number): number {
  const jitter = maxJitterMs > 0 ? Math.floor(Math.random() * maxJitterMs) : 0;
  return Math.max(50, baseDelayMs + jitter);
}

export function calculateExponentialBackoff(
  baseDelayMs: number,
  attemptIndex: number,
  backoffFactor: number,
  maxJitterMs: number,
  maxCapMs = 30000
): number {
  const exponential = baseDelayMs * Math.pow(backoffFactor, attemptIndex);
  const jitter = maxJitterMs > 0 ? Math.floor(Math.random() * maxJitterMs) : 0;
  return Math.min(maxCapMs, Math.round(exponential + jitter));
}

export function getPlatformVerificationLinks(gamertag: string) {
  const encoded = encodeURIComponent(gamertag.trim());
  const noSpaces = encodeURIComponent(gamertag.trim().replace(/\s+/g, ''));
  return {
    xboxGamertag: `https://www.xboxgamertag.com/search/${encoded}`,
    geyserXuid: `https://api.geysermc.org/v2/xbox/xuid/${encoded}`,
    playerDbXbox: `https://playerdb.co/api/player/xbox/${encoded}`,
    nameMc: `https://namemc.com/search?q=${noSpaces}`,
  };
}

export function formatTimestampMillis(date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function detectClientOS(): 'Windows' | 'macOS' | 'Linux' {
  if (typeof navigator === 'undefined') return 'Windows';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  return 'Windows';
}

export function buildTxtExportContent(
  tags: string[],
  osLineEnding: 'CRLF' | 'LF',
  includeHeader = false
): string {
  const eol = osLineEnding === 'CRLF' ? '\r\n' : '\n';
  const lines: string[] = [];
  if (includeHeader) {
    lines.push(`# XTag Verify — Available Xbox / MCPE Gamertags (${tags.length})`);
    lines.push(`# Exported: ${new Date().toISOString()}`);
    lines.push('');
  }
  for (const tag of tags) {
    lines.push(tag);
  }
  return lines.join(eol);
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvExportContent(
  records: GamertagRecord[],
  osLineEnding: 'CRLF' | 'LF'
): string {
  const eol = osLineEnding === 'CRLF' ? '\r\n' : '\n';
  const headers = [
    'Gamertag',
    'Status',
    'Xbox_MCPE_Status',
    'Minecraft_Java_Status',
    'Xbox_XUID',
    'Latency_ms',
    'Attempts',
    'Last_Delay_ms',
    'Source_Mode',
    'Checked_Timestamp',
    'XboxGamertag_Check_URL',
    'GeyserMC_API_URL',
    'NameMC_URL',
    'Diagnostic_Notes',
  ];

  const rows = [headers.join(',')];

  for (const r of records) {
    const links = getPlatformVerificationLinks(r.gamertag);
    const row = [
      escapeCsvCell(r.gamertag),
      escapeCsvCell(r.status),
      escapeCsvCell(r.xboxMcpeStatus),
      escapeCsvCell(r.javaStatus),
      escapeCsvCell(r.xuid || 'UNREGISTERED'),
      escapeCsvCell(r.latencyMs ?? ''),
      escapeCsvCell(r.attempts),
      escapeCsvCell(r.lastDelayMs),
      escapeCsvCell(r.sourceMode),
      escapeCsvCell(r.checkedAt || ''),
      escapeCsvCell(links.xboxGamertag),
      escapeCsvCell(links.geyserXuid),
      escapeCsvCell(links.nameMc),
      escapeCsvCell(`${r.reason}${r.upstreamDetails ? ` (${r.upstreamDetails})` : ''}`),
    ];
    rows.push(row.join(','));
  }

  return rows.join(eol);
}

export function triggerFileDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
