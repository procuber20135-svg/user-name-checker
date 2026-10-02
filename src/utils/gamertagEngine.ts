export type PlatformId =
  | 'xbox_mcpe'
  | 'minecraft'
  | 'discord'
  | 'twitter'
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'reddit';

export interface PlatformSpec {
  id: PlatformId;
  label: string;
  shortLabel: string;
  handlePrefix: string;
  minLen: number;
  maxLen: number;
  syntaxSummary: string;
}

export const PLATFORMS: PlatformSpec[] = [
  {
    id: 'xbox_mcpe',
    label: 'Xbox Live / MCPE',
    shortLabel: 'Xbox / MCPE',
    handlePrefix: '',
    minLen: 3,
    maxLen: 15,
    syntaxSummary: '3–15 chars · starts with letter · A–Z, 0–9, single spaces',
  },
  {
    id: 'minecraft',
    label: 'Minecraft (Java)',
    shortLabel: 'Minecraft',
    handlePrefix: '',
    minLen: 3,
    maxLen: 16,
    syntaxSummary: '3–16 chars · A–Z, 0–9, underscore (_) · no spaces',
  },
  {
    id: 'discord',
    label: 'Discord',
    shortLabel: 'Discord',
    handlePrefix: '@',
    minLen: 2,
    maxLen: 32,
    syntaxSummary: '2–32 chars · lowercase a–z, 0–9, underscore (_), period (.)',
  },
  {
    id: 'twitter',
    label: 'Twitter / X',
    shortLabel: 'Twitter / X',
    handlePrefix: '@',
    minLen: 4,
    maxLen: 15,
    syntaxSummary: '4–15 chars · A–Z, 0–9, underscore (_)',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    shortLabel: 'TikTok',
    handlePrefix: '@',
    minLen: 2,
    maxLen: 24,
    syntaxSummary: '2–24 chars · letters, numbers, underscores, periods (not trailing)',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    shortLabel: 'Instagram',
    handlePrefix: '@',
    minLen: 1,
    maxLen: 30,
    syntaxSummary: '1–30 chars · A–Z, 0–9, period (.), underscore (_)',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    shortLabel: 'Facebook',
    handlePrefix: 'fb.com/',
    minLen: 5,
    maxLen: 50,
    syntaxSummary: '5–50 chars · A–Z, 0–9, period (.) · no underscores',
  },
  {
    id: 'reddit',
    label: 'Reddit',
    shortLabel: 'Reddit',
    handlePrefix: 'u/',
    minLen: 3,
    maxLen: 20,
    syntaxSummary: '3–20 chars · A–Z, 0–9, underscore (_), hyphen (-)',
  },
];

export function getPlatformSpec(id: PlatformId): PlatformSpec {
  return PLATFORMS.find((p) => p.id === id) || PLATFORMS[0];
}

export type GeneratorPattern =
  | 'clean_og'
  | '4char_cvcv'
  | 'mcpe_compound'
  | 'semi_repeat'
  | '3char_alnum';

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
  platform: PlatformId;
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
  platform?: PlatformId;
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
  skipTakenFromTable: boolean;
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
const RARE_CLUSTERS = ['Vq', 'Xz', 'Kr', 'Vx', 'Qz', 'Zv', 'Vn', 'Kv', 'Zr', 'Nx', 'Qv', 'Rx', 'Vz', 'Kx'];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'y'];
const DIGITS = ['2', '3', '4', '5', '6', '7', '8', '9'];

const ARCHAIC_ROOTS = [
  'Beryl', 'Cairn', 'Scion', 'Tarn', 'Fjord', 'Vesper', 'Flint', 'Silt',
  'Skerry', 'Brine', 'Kestrel', 'Onyx', 'Pyre', 'Rime', 'Sable', 'Talon',
  'Umber', 'Whorl', 'Zephyr', 'Aegis', 'Basalt', 'Cinder', 'Glint',
  'Hearth', 'Inlet', 'Knoll', 'Lichen', 'Mire', 'Nadir', 'Ochre', 'Pith',
  'Quill', 'Shard', 'Thicket', 'Vane', 'Weir', 'Yarrow', 'Zenith', 'Briar',
];

const MCPE_PREFIXES = [
  'Void', 'Nether', 'Ender', 'Slate', 'Quartz', 'Sculk', 'Basalt',
  'Cobalt', 'Obsidian', 'Crimson', 'Aether', 'Prism', 'Beryl', 'Cairn',
];

const MCPE_SUFFIXES = [
  'Kestrel', 'Whorl', 'Skerry', 'Vesper', 'Lichen', 'Nadir', 'Ochre',
  'Thicket', 'Yarrow', 'Quill', 'Fjord', 'Cairn', 'Talon', 'Zephyr',
];

export function validateTagLocally(
  rawTag: string,
  platform: PlatformId = 'xbox_mcpe',
  strict12 = false
): { valid: boolean; reason?: string } {
  const tag = rawTag.trim();
  if (!tag) {
    return { valid: false, reason: 'Empty username.' };
  }

  switch (platform) {
    case 'xbox_mcpe': {
      if (tag.length < 3) return { valid: false, reason: 'Minimum length is 3 characters.' };
      if (strict12 && tag.length > 12) {
        return { valid: false, reason: 'Exceeds modern 12-character Xbox suffix-free limit.' };
      }
      if (tag.length > 15) return { valid: false, reason: 'Exceeds 15-character MCPE/Xbox limit.' };
      if (!/^[A-Za-z]/.test(tag)) return { valid: false, reason: 'Must start with a letter (A–Z).' };
      if (!/^[A-Za-z0-9 ]+$/.test(tag)) {
        return { valid: false, reason: 'Only letters, numbers, and single spaces allowed.' };
      }
      if (/\s{2,}/.test(tag)) return { valid: false, reason: 'Consecutive spaces are prohibited.' };
      return { valid: true };
    }
    case 'minecraft': {
      if (tag.length < 3 || tag.length > 16) {
        return { valid: false, reason: 'Minecraft username must be 3–16 characters.' };
      }
      if (!/^[A-Za-z0-9_]+$/.test(tag)) {
        return { valid: false, reason: 'Only letters, numbers, and underscores (_) allowed.' };
      }
      return { valid: true };
    }
    case 'discord': {
      if (tag.length < 2 || tag.length > 32) {
        return { valid: false, reason: 'Discord username must be 2–32 characters.' };
      }
      if (!/^[a-z0-9_.]+$/i.test(tag)) {
        return { valid: false, reason: 'Only letters, numbers, underscore (_), and period (.) allowed.' };
      }
      if (/\.\./.test(tag)) {
        return { valid: false, reason: 'Consecutive periods (..) are prohibited on Discord.' };
      }
      return { valid: true };
    }
    case 'twitter': {
      if (tag.length < 4 || tag.length > 15) {
        return { valid: false, reason: 'Twitter / X handle must be 4–15 characters.' };
      }
      if (!/^[A-Za-z0-9_]+$/.test(tag)) {
        return { valid: false, reason: 'Only letters, numbers, and underscores (_) allowed.' };
      }
      if (/twitter|admin/i.test(tag)) {
        return { valid: false, reason: 'Cannot contain reserved words "Twitter" or "Admin".' };
      }
      return { valid: true };
    }
    case 'tiktok': {
      if (tag.length < 2 || tag.length > 24) {
        return { valid: false, reason: 'TikTok username must be 2–24 characters.' };
      }
      if (!/^[A-Za-z0-9_.]+$/.test(tag)) {
        return { valid: false, reason: 'Only letters, numbers, underscores, and periods allowed.' };
      }
      if (tag.endsWith('.')) {
        return { valid: false, reason: 'TikTok username cannot end with a period.' };
      }
      if (/^\d+$/.test(tag)) {
        return { valid: false, reason: 'TikTok username cannot be numbers only.' };
      }
      return { valid: true };
    }
    case 'instagram': {
      if (tag.length < 1 || tag.length > 30) {
        return { valid: false, reason: 'Instagram handle must be 1–30 characters.' };
      }
      if (!/^[A-Za-z0-9_.]+$/.test(tag)) {
        return { valid: false, reason: 'Only letters, numbers, periods, and underscores allowed.' };
      }
      if (/\.\./.test(tag) || tag.startsWith('.') || tag.endsWith('.')) {
        return { valid: false, reason: 'Cannot start/end with period or have consecutive periods.' };
      }
      return { valid: true };
    }
    case 'facebook': {
      if (tag.length < 5 || tag.length > 50) {
        return { valid: false, reason: 'Facebook username must be 5–50 characters.' };
      }
      if (!/^[A-Za-z0-9.]+$/.test(tag)) {
        return { valid: false, reason: 'Facebook only allows letters, numbers, and periods.' };
      }
      if (/\.\./.test(tag) || tag.startsWith('.') || tag.endsWith('.')) {
        return { valid: false, reason: 'Cannot start/end with a period or have consecutive periods.' };
      }
      return { valid: true };
    }
    case 'reddit': {
      if (tag.length < 3 || tag.length > 20) {
        return { valid: false, reason: 'Reddit username must be 3–20 characters.' };
      }
      if (!/^[A-Za-z0-9_-]+$/.test(tag)) {
        return { valid: false, reason: 'Only letters, numbers, underscores (_), and hyphens (-) allowed.' };
      }
      return { valid: true };
    }
  }
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateSingleRareTag(
  pattern: GeneratorPattern,
  platform: PlatformId = 'xbox_mcpe'
): string {
  let raw = '';
  switch (pattern) {
    case 'clean_og': {
      // High-availability clean archaic root + 2-letter rare phonetic cluster (e.g., SkerryVq, CairnXz, BerylKr)
      const root = randomItem(ARCHAIC_ROOTS);
      const cluster = randomItem(RARE_CLUSTERS);
      raw = `${root}${cluster}`.slice(0, 12);
      break;
    }
    case '4char_cvcv': {
      // Pronounceable 6–7 char CVCVCV unclaimed synth (e.g., Kavonex, Zeluvqr, Vexoryn)
      const c1 = randomItem(CONSONANTS);
      const v1 = randomItem(VOWELS);
      const c2 = randomItem(CONSONANTS).toLowerCase();
      const v2 = randomItem(VOWELS);
      const tail = randomItem(['vx', 'qz', 'kr', 'vq', 'xz', 'zv', 'nx', 'rv']);
      raw = `${c1}${v1}${c2}${v2}${tail}`;
      break;
    }
    case 'mcpe_compound': {
      const p = randomItem(MCPE_PREFIXES);
      const s = randomItem(MCPE_SUFFIXES);
      const sep =
        platform === 'xbox_mcpe'
          ? Math.random() > 0.6
            ? ' '
            : ''
          : platform === 'discord' || platform === 'instagram' || platform === 'tiktok'
          ? Math.random() > 0.5
            ? '.'
            : '_'
          : platform === 'reddit'
          ? '_'
          : platform === 'facebook'
          ? '.'
          : '';
      raw = `${p}${sep}${s}`.slice(0, 15);
      break;
    }
    case 'semi_repeat': {
      const c1 = randomItem(CONSONANTS);
      const v1 = randomItem(VOWELS);
      const c2 = randomItem(CONSONANTS).toLowerCase();
      const cluster = randomItem(RARE_CLUSTERS).toLowerCase();
      raw = `${c1}${v1}${c2}${c1.toLowerCase()}${v1}${cluster}`;
      break;
    }
    case '3char_alnum': {
      // Short 5–6 char alphanumeric rare codes (e.g., V9kXz, Q7xVq, Z4mKr)
      const c1 = randomItem(CONSONANTS);
      const d1 = randomItem(DIGITS);
      const c2 = randomItem(CONSONANTS).toLowerCase();
      const cluster = randomItem(RARE_CLUSTERS);
      raw = `${c1}${d1}${c2}${cluster}`;
      break;
    }
  }

  if (platform === 'discord' || platform === 'instagram' || platform === 'tiktok') {
    raw = raw.toLowerCase();
  }
  return raw;
}

export function generateRareGamertags(
  count: number,
  pattern: GeneratorPattern,
  platform: PlatformId = 'xbox_mcpe',
  existingTags: Set<string> = new Set()
): string[] {
  const results: string[] = [];
  const used = new Set<string>(Array.from(existingTags).map((t) => t.toLowerCase()));
  let safetyCounter = 0;
  const maxAttempts = count * 30;

  while (results.length < count && safetyCounter < maxAttempts) {
    safetyCounter++;
    const candidate = generateSingleRareTag(pattern, platform);
    const lower = candidate.toLowerCase();
    if (!used.has(lower) && validateTagLocally(candidate, platform).valid) {
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

export interface PlatformLinkItem {
  label: string;
  url: string;
  title: string;
}

export function getPlatformVerificationLinks(
  gamertag: string,
  platform: PlatformId = 'xbox_mcpe'
): PlatformLinkItem[] {
  const encoded = encodeURIComponent(gamertag.trim());
  const noSpaces = encodeURIComponent(gamertag.trim().replace(/\s+/g, ''));

  switch (platform) {
    case 'xbox_mcpe':
      return [
        {
          label: 'XboxLive',
          url: `https://www.xboxgamertag.com/search/${encoded}`,
          title: 'Verify on XboxGamertag.com',
        },
        {
          label: 'PlayerDB',
          url: `https://playerdb.co/api/player/xbox/${encoded}`,
          title: 'Query Authoritative PlayerDB Xbox Endpoint',
        },
        {
          label: 'GeyserMC',
          url: `https://api.geysermc.org/v2/xbox/xuid/${encoded}`,
          title: 'Query GeyserMC Bedrock XUID API',
        },
        {
          label: 'NameMC',
          url: `https://namemc.com/search?q=${noSpaces}`,
          title: 'Cross-Check NameMC',
        },
      ];
    case 'minecraft':
      return [
        {
          label: 'MojangAPI',
          url: `https://api.mojang.com/users/profiles/minecraft/${noSpaces}`,
          title: 'Query Official Mojang Profile API',
        },
        {
          label: 'NameMC',
          url: `https://namemc.com/search?q=${noSpaces}`,
          title: 'Verify on NameMC',
        },
        {
          label: 'PlayerDB',
          url: `https://playerdb.co/api/player/minecraft/${noSpaces}`,
          title: 'Query PlayerDB Minecraft API',
        },
        {
          label: 'LabyNet',
          url: `https://laby.net/@${noSpaces}`,
          title: 'Check Laby.net Profile',
        },
      ];
    case 'discord':
      return [
        {
          label: 'DiscordApp',
          url: `https://discord.com/users/${noSpaces}`,
          title: 'Open Discord Profile Lookup',
        },
        {
          label: 'Discordhub',
          url: `https://discord.id/`,
          title: 'Open Discord ID & Handle Lookup',
        },
        {
          label: 'InviteCheck',
          url: `https://discord.com/api/v9/invites/${noSpaces}`,
          title: 'Check Discord Vanity API',
        },
      ];
    case 'twitter':
      return [
        {
          label: 'X Profile',
          url: `https://x.com/${noSpaces}`,
          title: 'Open X (Twitter) Profile',
        },
        {
          label: 'VxTwitterAPI',
          url: `https://api.vxtwitter.com/${noSpaces}`,
          title: 'Inspect Live VxTwitter JSON API',
        },
      ];
    case 'tiktok':
      return [
        {
          label: 'TikTok Profile',
          url: `https://www.tiktok.com/@${noSpaces}`,
          title: 'Open TikTok @Username Profile',
        },
        {
          label: 'Countik',
          url: `https://countik.com/tiktok-analytics/user/@${noSpaces}`,
          title: 'Verify TikTok Handle Status',
        },
      ];
    case 'instagram':
      return [
        {
          label: 'Instagram',
          url: `https://www.instagram.com/${noSpaces}/`,
          title: 'Open Instagram Profile URL',
        },
        {
          label: 'ImgInn',
          url: `https://imginn.com/${noSpaces}/`,
          title: 'Check Public Instagram Handle Index',
        },
      ];
    case 'facebook':
      return [
        {
          label: 'Facebook URL',
          url: `https://www.facebook.com/${noSpaces}`,
          title: 'Open Facebook Vanity URL',
        },
        {
          label: 'FB Lookup',
          url: `https://www.facebook.com/public/${noSpaces}`,
          title: 'Check Facebook Public Directory',
        },
      ];
    case 'reddit':
      return [
        {
          label: 'Reddit Profile',
          url: `https://www.reddit.com/user/${noSpaces}`,
          title: 'Open Reddit User Profile',
        },
        {
          label: 'RedditIndex',
          url: `https://arctic-shift.photon-reddit.com/api/users/search?author=${noSpaces}&limit=1`,
          title: 'Inspect Live Reddit User Index JSON',
        },
      ];
  }
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
  records: GamertagRecord[],
  osLineEnding: 'CRLF' | 'LF',
  includeHeader = false
): string {
  const eol = osLineEnding === 'CRLF' ? '\r\n' : '\n';
  const lines: string[] = [];
  if (includeHeader) {
    lines.push(`# XTag Verify — Confirmed Available Usernames (${records.length})`);
    lines.push(`# Exported: ${new Date().toISOString()}`);
    lines.push('');
  }
  for (const r of records) {
    const spec = getPlatformSpec(r.platform || 'xbox_mcpe');
    lines.push(`${r.gamertag} [${spec.shortLabel}]`);
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
    'Username',
    'Platform',
    'Status',
    'Platform_Identifier_ID',
    'Latency_ms',
    'Attempts',
    'Last_Delay_ms',
    'Source_Mode',
    'Checked_Timestamp',
    'Primary_Verification_URL',
    'Diagnostic_Notes',
  ];

  const rows = [headers.join(',')];

  for (const r of records) {
    const links = getPlatformVerificationLinks(r.gamertag, r.platform || 'xbox_mcpe');
    const spec = getPlatformSpec(r.platform || 'xbox_mcpe');
    const row = [
      escapeCsvCell(r.gamertag),
      escapeCsvCell(spec.label),
      escapeCsvCell(r.status),
      escapeCsvCell(r.xuid || 'UNREGISTERED'),
      escapeCsvCell(r.latencyMs ?? ''),
      escapeCsvCell(r.attempts),
      escapeCsvCell(r.lastDelayMs),
      escapeCsvCell(r.sourceMode),
      escapeCsvCell(r.checkedAt || ''),
      escapeCsvCell(links[0]?.url || ''),
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
