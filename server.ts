import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESERVED_WORDS = new Set([
  'admin',
  'administrator',
  'xbox',
  'microsoft',
  'minecraft',
  'mojang',
  'support',
  'moderator',
  'system',
  'official',
]);

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

function validateXboxGamertag(rawTag: string): ValidationResult {
  const tag = rawTag.trim();
  if (tag.length < 3) {
    return { valid: false, reason: 'Gamertag must be at least 3 characters long.' };
  }
  if (tag.length > 15) {
    return { valid: false, reason: 'Gamertag cannot exceed 15 characters for MCPE/Xbox.' };
  }
  if (!/^[A-Za-z]/.test(tag)) {
    return { valid: false, reason: 'Gamertag must begin with an alphabetical character (A-Z).' };
  }
  if (!/^[A-Za-z0-9 ]+$/.test(tag)) {
    return { valid: false, reason: 'Gamertag contains invalid symbols. Only letters, numbers, and single spaces are allowed.' };
  }
  if (/\s{2,}/.test(tag)) {
    return { valid: false, reason: 'Consecutive spaces are not permitted in Xbox gamertags.' };
  }
  if (RESERVED_WORDS.has(tag.toLowerCase())) {
    return { valid: false, reason: 'Gamertag matches a reserved platform identifier.' };
  }
  return { valid: true };
}

async function fetchWithTimeout(url: string, timeoutMs = 4500, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'XTagVerify-DiagnosticUtility/1.0',
        Accept: 'application/json',
        ...headers,
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

  app.post('/api/verify-gamertag', async (req, res) => {
    const startTime = Date.now();
    const { gamertag, simulateRateLimitProbability = 0, strictLength12 = false } = req.body || {};

    if (!gamertag || typeof gamertag !== 'string') {
      res.status(400).json({
        gamertag: String(gamertag || ''),
        status: 'INVALID',
        reason: 'Missing or non-string gamertag parameter.',
        latencyMs: Date.now() - startTime,
      });
      return;
    }

    const cleanedTag = gamertag.trim();
    const validation = validateXboxGamertag(cleanedTag);
    if (!validation.valid) {
      res.status(200).json({
        gamertag: cleanedTag,
        status: 'INVALID',
        xboxMcpeStatus: 'INVALID',
        javaStatus: 'UNKNOWN',
        xuid: null,
        reason: validation.reason,
        latencyMs: Date.now() - startTime,
        upstreamDetails: 'Rejected by strict pre-flight validator (0 upstream calls).',
      });
      return;
    }

    if (strictLength12 && cleanedTag.length > 12) {
      res.status(200).json({
        gamertag: cleanedTag,
        status: 'INVALID',
        xboxMcpeStatus: 'INVALID',
        javaStatus: 'UNKNOWN',
        xuid: null,
        reason: 'Exceeds modern 12-character suffix-free Xbox gamertag limit.',
        latencyMs: Date.now() - startTime,
        upstreamDetails: 'Rejected by strict 12-char limit validator.',
      });
      return;
    }

    // Optional deterministic or probabilistic 429 rate-limit simulation for testing backoff
    if (
      simulateRateLimitProbability > 0 &&
      Math.random() < Number(simulateRateLimitProbability)
    ) {
      const retryAfterMs = 1200 + Math.floor(Math.random() * 800);
      res.status(429).json({
        gamertag: cleanedTag,
        status: 'RATE_LIMITED',
        reason: 'HTTP 429 Too Many Requests: Upstream Xbox/Geyser rate limiter triggered.',
        retryAfterMs,
        latencyMs: Date.now() - startTime,
      });
      return;
    }

    try {
      const encodedTag = encodeURIComponent(cleanedTag);

      // Query real public MCPE / Xbox and Minecraft endpoints concurrently
      const [geyserResult, playerDbXboxResult, playerDbMcResult] = await Promise.allSettled([
        fetchWithTimeout(`https://api.geysermc.org/v2/xbox/xuid/${encodedTag}`, 4200),
        fetchWithTimeout(`https://playerdb.co/api/player/xbox/${encodedTag}`, 4200),
        fetchWithTimeout(`https://playerdb.co/api/player/minecraft/${encodedTag.replace(/\s+/g, '')}`, 3800),
      ]);

      // Check if any upstream returned HTTP 429
      if (
        (geyserResult.status === 'fulfilled' && geyserResult.value.status === 429) ||
        (playerDbXboxResult.status === 'fulfilled' && playerDbXboxResult.value.status === 429)
      ) {
        res.status(429).json({
          gamertag: cleanedTag,
          status: 'RATE_LIMITED',
          reason: 'HTTP 429 Too Many Requests received from upstream verification API.',
          retryAfterMs: 2000,
          latencyMs: Date.now() - startTime,
        });
        return;
      }

      let xboxTaken = false;
      let xuid: string | null = null;
      let resolvedName = cleanedTag;
      const diagnostics: string[] = [];

      // Evaluate GeyserMC (MCPE Bedrock XUID resolver)
      if (geyserResult.status === 'fulfilled') {
        const gRes = geyserResult.value;
        if (gRes.status === 200) {
          const data = (await gRes.json().catch(() => null)) as { xuid?: number | string } | null;
          if (data && data.xuid) {
            xboxTaken = true;
            xuid = String(data.xuid);
            diagnostics.push(`GeyserMC: 200 OK (XUID ${xuid})`);
          }
        } else if (gRes.status === 404) {
          diagnostics.push('GeyserMC: 404 Not Found (Unregistered in Bedrock cache)');
        } else {
          diagnostics.push(`GeyserMC: HTTP ${gRes.status}`);
        }
      } else {
        diagnostics.push('GeyserMC: Timeout/Unreachable');
      }

      // Evaluate PlayerDB Xbox Live resolver
      if (playerDbXboxResult.status === 'fulfilled') {
        const pRes = playerDbXboxResult.value;
        if (pRes.status === 200) {
          const data = (await pRes.json().catch(() => null)) as {
            success?: boolean;
            data?: { player?: { id?: string; username?: string } };
          } | null;
          if (data?.success && data?.data?.player) {
            xboxTaken = true;
            if (!xuid && data.data.player.id) {
              xuid = String(data.data.player.id);
            }
            if (data.data.player.username) {
              resolvedName = data.data.player.username;
            }
            diagnostics.push(`PlayerDB(Xbox): 200 Found (${resolvedName})`);
          } else {
            diagnostics.push('PlayerDB(Xbox): Not Found');
          }
        } else {
          diagnostics.push(`PlayerDB(Xbox): HTTP ${pRes.status} (Unregistered)`);
        }
      } else {
        diagnostics.push('PlayerDB(Xbox): Timeout/Unreachable');
      }

      // Evaluate Minecraft Java cross-platform status
      let javaStatus: 'AVAILABLE' | 'TAKEN' | 'INVALID' | 'UNKNOWN' = 'UNKNOWN';
      if (cleanedTag.includes(' ')) {
        javaStatus = 'INVALID';
      } else if (playerDbMcResult.status === 'fulfilled') {
        const mRes = playerDbMcResult.value;
        if (mRes.status === 200) {
          const mData = (await mRes.json().catch(() => null)) as { success?: boolean } | null;
          javaStatus = mData?.success ? 'TAKEN' : 'AVAILABLE';
        } else if (mRes.status === 400 || mRes.status === 404 || mRes.status === 500) {
          javaStatus = 'AVAILABLE';
        }
      }

      // Ensure if both Xbox upstreams failed completely due to network disconnect, report error
      const bothFailed =
        geyserResult.status === 'rejected' && playerDbXboxResult.status === 'rejected';
      if (bothFailed) {
        res.status(503).json({
          gamertag: cleanedTag,
          status: 'ERROR',
          reason: 'Both upstream verification providers timed out or failed to respond.',
          latencyMs: Date.now() - startTime,
          upstreamDetails: diagnostics.join(' | '),
        });
        return;
      }

      const finalStatus = xboxTaken ? 'TAKEN' : 'AVAILABLE';
      res.status(200).json({
        gamertag: cleanedTag,
        resolvedGamertag: resolvedName,
        status: finalStatus,
        xboxMcpeStatus: finalStatus,
        javaStatus,
        xuid,
        latencyMs: Date.now() - startTime,
        upstreamDetails: diagnostics.join(' · '),
        reason: xboxTaken
          ? `Registered on Xbox Live / MCPE${xuid ? ` (XUID: ${xuid})` : ''}`
          : 'No Xbox Live / MCPE profile bound to this gamertag.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected verification error';
      res.status(500).json({
        gamertag: cleanedTag,
        status: 'ERROR',
        reason: message,
        latencyMs: Date.now() - startTime,
      });
    }
  });

  app.post('/api/notify-email', async (req, res) => {
    const {
      recipient,
      subject,
      summaryStats,
      availableTags = [],
      webhookUrl,
    } = req.body || {};

    if (!recipient || typeof recipient !== 'string' || !recipient.includes('@')) {
      res.status(400).json({
        ok: false,
        error: 'Valid recipient email address is required.',
      });
      return;
    }

    const timestamp = new Date().toISOString();
    const messageId = `<xtag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@xtag-verify.local>`;

    const textBody = [
      `XTag Verify — Automated Batch Completion Report`,
      `Timestamp: ${timestamp}`,
      `Recipient: ${recipient}`,
      `----------------------------------------`,
      `Batch Summary:`,
      `- Total Checked: ${summaryStats?.checked ?? 0}`,
      `- Available Found: ${summaryStats?.available ?? 0}`,
      `- Taken / Registered: ${summaryStats?.taken ?? 0}`,
      `- Rate-Limit Backoffs: ${summaryStats?.retried ?? 0}`,
      `- Errors / Invalid: ${summaryStats?.errors ?? 0}`,
      ``,
      `Verified Available Gamertags (${availableTags.length}):`,
      availableTags.length > 0 ? availableTags.map((t: string) => `  * ${t}`).join('\n') : '  (None found in this batch)',
      ``,
      `Direct Verification Portal: https://www.xboxgamertag.com`,
    ].join('\r\n');

    const rfc5322Message = [
      `From: "XTag Verify Scheduler" <no-reply@xtag-verify.local>`,
      `To: <${recipient.trim()}>`,
      `Subject: ${subject || `XTag Verify Report: ${availableTags.length} Available Gamertags Found`}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${messageId}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      textBody,
    ].join('\r\n');

    let webhookStatus = 'Skipped (no webhook configured)';
    if (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('http')) {
      try {
        const whRes = await fetchWithTimeout(
          webhookUrl,
          4000,
          { 'Content-Type': 'application/json' }
        );
        webhookStatus = `HTTP ${whRes.status}`;
      } catch (e: unknown) {
        webhookStatus = `Failed (${e instanceof Error ? e.message : 'Network error'})`;
      }
    }

    res.status(200).json({
      ok: true,
      messageId,
      timestamp,
      recipient: recipient.trim(),
      subject: subject || `XTag Verify Report: ${availableTags.length} Available Gamertags Found`,
      webhookStatus,
      rfc5322Message,
      textBody,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`XTag Verify server running on http://localhost:${PORT}`);
  });
}

startServer();
