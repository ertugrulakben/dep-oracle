/**
 * LicenseCollector -- determines the license of an npm package, maps it to
 * an SPDX identifier, and classifies its risk level.
 *
 * Risk classification:
 *   safe     - permissive licenses (MIT, ISC, BSD, Apache-2.0, etc.)
 *   cautious - weak-copyleft licenses (LGPL, MPL, EPL)
 *   risky    - strong-copyleft licenses (GPL, AGPL)
 *   unknown  - unrecognised or missing license
 */

import type { CollectorResult, LicenseData } from '../parsers/schema.js';
import type { CacheManager } from '../cache/store.js';
import { logger } from '../utils/logger.js';
import { npmRateLimiter } from '../utils/rate-limiter.js';
import { BaseCollector } from './base.js';

type LicenseRisk = 'safe' | 'cautious' | 'risky' | 'unknown';

/** Map of SPDX identifiers to their risk classification. */
const RISK_MAP: Record<string, LicenseRisk> = {
  // Safe -- permissive
  'MIT':             'safe',
  'ISC':             'safe',
  'BSD-2-Clause':    'safe',
  'BSD-3-Clause':    'safe',
  'Apache-2.0':      'safe',
  'Unlicense':       'safe',
  '0BSD':            'safe',
  'CC0-1.0':         'safe',
  'CC-BY-4.0':       'safe',
  'Zlib':            'safe',
  'BlueOak-1.0.0':   'safe',
  'MIT-0':           'safe',

  // Cautious -- weak copyleft
  'LGPL-2.1':            'cautious',
  'LGPL-2.1-only':       'cautious',
  'LGPL-2.1-or-later':   'cautious',
  'LGPL-3.0':            'cautious',
  'LGPL-3.0-only':       'cautious',
  'LGPL-3.0-or-later':   'cautious',
  'MPL-2.0':             'cautious',
  'EPL-2.0':             'cautious',
  'EPL-1.0':             'cautious',
  'CDDL-1.0':            'cautious',
  'CDDL-1.1':            'cautious',

  // Risky -- strong copyleft
  'GPL-2.0':            'risky',
  'GPL-2.0-only':       'risky',
  'GPL-2.0-or-later':   'risky',
  'GPL-3.0':            'risky',
  'GPL-3.0-only':       'risky',
  'GPL-3.0-or-later':   'risky',
  'AGPL-3.0':           'risky',
  'AGPL-3.0-only':      'risky',
  'AGPL-3.0-or-later':  'risky',
  'SSPL-1.0':           'risky',
  'EUPL-1.2':           'risky',
};

/** Licenses known to be OSI-approved. */
const OSI_APPROVED = new Set<string>([
  'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0',
  '0BSD', 'Unlicense',
  'LGPL-2.1', 'LGPL-2.1-only', 'LGPL-2.1-or-later',
  'LGPL-3.0', 'LGPL-3.0-only', 'LGPL-3.0-or-later',
  'MPL-2.0', 'EPL-2.0', 'EPL-1.0',
  'GPL-2.0', 'GPL-2.0-only', 'GPL-2.0-or-later',
  'GPL-3.0', 'GPL-3.0-only', 'GPL-3.0-or-later',
  'AGPL-3.0', 'AGPL-3.0-only', 'AGPL-3.0-or-later',
  'CDDL-1.0', 'Artistic-2.0', 'Zlib', 'PostgreSQL',
  'EUPL-1.2', 'ECL-2.0',
]);

/** Common non-SPDX license strings people put in package.json. */
const LICENSE_ALIASES: Record<string, string> = {
  'apache 2.0':       'Apache-2.0',
  'apache2':          'Apache-2.0',
  'apache-2':         'Apache-2.0',
  'apache license 2.0': 'Apache-2.0',
  'bsd':              'BSD-2-Clause',
  'bsd-2':            'BSD-2-Clause',
  'bsd-3':            'BSD-3-Clause',
  'bsd license':      'BSD-2-Clause',
  'gpl':              'GPL-3.0',
  'gpl-2':            'GPL-2.0',
  'gpl-3':            'GPL-3.0',
  'gplv2':            'GPL-2.0',
  'gplv3':            'GPL-3.0',
  'lgpl':             'LGPL-3.0',
  'lgpl-2':           'LGPL-2.1',
  'lgpl-3':           'LGPL-3.0',
  'agpl':             'AGPL-3.0',
  'agpl-3':           'AGPL-3.0',
  'mpl':              'MPL-2.0',
  'mpl-2':            'MPL-2.0',
  'unlicensed':       'Unlicense',
  'public domain':    'Unlicense',
  'wtfpl':            'WTFPL',
  'cc0':              'CC0-1.0',
  'cc0-1.0':          'CC0-1.0',
  'artistic-2.0':     'Artistic-2.0',
};

export class LicenseCollector extends BaseCollector<LicenseData> {
  readonly name = 'license';

  constructor(cache: CacheManager) {
    super(cache);
  }

  async collect(
    packageName: string,
    version: string,
  ): Promise<CollectorResult<LicenseData>> {
    // Check cache first
    const cached = await this.getCached(packageName, version);
    if (cached) return cached;

    try {
      const rawLicense = await this.fetchLicense(packageName, version);
      const spdx = this.toSpdx(rawLicense);
      const risk = this.classifyRisk(spdx);
      const osiApproved = spdx !== null && OSI_APPROVED.has(spdx);

      const data: LicenseData = {
        packageName,
        version,
        raw: rawLicense,
        spdx,
        risk,
        osiApproved,
      };

      await this.setCache(packageName, version, data);

      return {
        status: 'success',
        data,
        collectedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`LicenseCollector failed for ${packageName}@${version}: ${message}`);

      return {
        status: 'error',
        data: null,
        error: message,
        collectedAt: new Date().toISOString(),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // npm registry
  // ---------------------------------------------------------------------------

  /**
   * Fetch the license string from the npm registry.
   *
   * Tries the specific version first, then falls back to the top-level
   * packument "license" field.
   */
  private async fetchLicense(
    packageName: string,
    version: string,
  ): Promise<string | null> {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    logger.debug(`License: fetching packument ${url}`);

    await npmRateLimiter.acquire();
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`npm registry returned ${res.status} for ${packageName}`);
    }

    const body = (await res.json()) as {
      license?: string | { type?: string };
      versions?: Record<string, { license?: string | { type?: string } }>;
    };

    // Try version-specific license first.
    const versionInfo = body.versions?.[version];
    if (versionInfo?.license) {
      return typeof versionInfo.license === 'string'
        ? versionInfo.license
        : versionInfo.license.type ?? null;
    }

    // Fallback to top-level license.
    if (body.license) {
      return typeof body.license === 'string'
        ? body.license
        : body.license.type ?? null;
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // SPDX mapping
  // ---------------------------------------------------------------------------

  /**
   * Normalise a raw license string to an SPDX identifier.
   *
   * Handles common aliases, SPDX expression syntax (e.g. "(MIT OR Apache-2.0)"),
   * and case-insensitive matching.
   */
  private toSpdx(raw: string | null): string | null {
    if (!raw) return null;

    const trimmed = raw.trim();
    if (!trimmed) return null;

    // If it is already a known SPDX id, return as-is.
    if (RISK_MAP[trimmed] !== undefined || OSI_APPROVED.has(trimmed)) {
      return trimmed;
    }

    // Try case-insensitive alias lookup.
    const lower = trimmed.toLowerCase();
    const alias = LICENSE_ALIASES[lower];
    if (alias) return alias;

    // Handle SPDX expressions like "(MIT OR Apache-2.0)".
    // We extract the first recognisable identifier for risk classification.
    const stripped = trimmed.replace(/[()]/g, '');
    const parts = stripped.split(/\s+(?:OR|AND)\s+/i);
    for (const part of parts) {
      const p = part.trim();
      if (RISK_MAP[p] !== undefined) return p;
      const pAlias = LICENSE_ALIASES[p.toLowerCase()];
      if (pAlias) return pAlias;
    }

    // Return the original trimmed value (may be a valid but uncommon SPDX id).
    return trimmed;
  }

  // ---------------------------------------------------------------------------
  // Risk classification
  // ---------------------------------------------------------------------------

  private classifyRisk(spdx: string | null): LicenseRisk {
    if (!spdx) return 'unknown';
    return RISK_MAP[spdx] ?? 'unknown';
  }
}
