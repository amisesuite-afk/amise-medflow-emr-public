/**
 * PHI read audit middleware.
 *
 * Automatically logs every authenticated GET request to PHI-bearing API
 * endpoints. Runs after auth but before the route handler; never blocks
 * the request path.
 *
 * Patterns are matched against req.path (the Express-normalised path,
 * already stripped of the /api prefix by the time Express sees it).
 */
import type { Request, Response, NextFunction } from 'express';
import { sb } from './supabase.js';
import { logger } from './logger.js';

// Path prefix → resource_type for audit log
const PHI_ROUTES: Array<{ prefix: string; resourceType: string }> = [
  { prefix: '/api/patients',              resourceType: 'patient'              },
  { prefix: '/api/encounter',             resourceType: 'encounter'            },
  { prefix: '/api/visits',                resourceType: 'encounter'            },
  { prefix: '/api/visit',                 resourceType: 'encounter'            },
  { prefix: '/api/clinical-notes',        resourceType: 'clinical_note'        },
  { prefix: '/api/investigations',        resourceType: 'investigation_result' },
  { prefix: '/api/document',              resourceType: 'document'             },
  { prefix: '/api/ai-proposals',          resourceType: 'ai_proposal'          },
  { prefix: '/api/clinical-states',       resourceType: 'clinical_state'       },
  { prefix: '/api/workflow-tasks',        resourceType: 'workflow_task'        },
  { prefix: '/api/referrals',             resourceType: 'referral'             },
  { prefix: '/api/billing',              resourceType: 'invoice'              },
  { prefix: '/api/prescriptions',         resourceType: 'prescription'         },
  { prefix: '/api/calls',                 resourceType: 'call_record'          },
  { prefix: '/api/patient-messages',      resourceType: 'patient_message'      },
  { prefix: '/api/generate-letter',       resourceType: 'letter'               },
  { prefix: '/api/generate-endoscopy',    resourceType: 'clinical_note'        },
  { prefix: '/api/generate-operative',    resourceType: 'clinical_note'        },
  { prefix: '/api/discharge-summary',     resourceType: 'clinical_note'        },
  { prefix: '/api/procedure-report',      resourceType: 'clinical_note'        },
  { prefix: '/api/summary',              resourceType: 'patient'              },
  { prefix: '/api/portal',               resourceType: 'patient'              },
  { prefix: '/api/fhir',                 resourceType: 'patient'              },
];

// Non-PHI paths that match prefixes above — exclude
const EXCLUDE_EXACT = new Set([
  '/api/health',
  '/api/patients/count',
]);

export function phiAuditMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Only log GETs; mutations are logged by route handlers individually
  if (req.method !== 'GET') { next(); return; }

  const path = req.path;
  if (EXCLUDE_EXACT.has(path)) { next(); return; }

  const match = PHI_ROUTES.find(r => path.startsWith(r.prefix));
  if (!match) { next(); return; }

  // Extract patient_id from query string if present (best-effort)
  const patientIdRaw = (req.query.patientId ?? req.query.patient_id) as string | undefined;

  // Extract resource_id from the path segment after the prefix
  const tail = path.slice(match.prefix.length);
  const uuidRe = /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const uuidMatch = uuidRe.exec(tail);
  const resourceId = uuidMatch?.[1] ?? undefined;

  // Fire-and-forget — never await, never throw
  void (async () => {
    try {
      let userId: string | null = null;
      let userEmail: string | null = null;

      const authHeader = req.headers?.authorization;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const { data } = await sb().auth.getUser(authHeader.slice(7));
        if (data?.user) {
          userId    = data.user.id;
          userEmail = data.user.email ?? null;
        }
      }

      const forwarded = req.headers?.['x-forwarded-for'];
      const ipAddress: string | null =
        (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : null)
        ?? (req as unknown as { socket?: { remoteAddress?: string } }).socket?.remoteAddress
        ?? null;

      const uuidRe2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      await sb().from('audit_log').insert({
        user_id:       userId,
        user_email:    userEmail,
        action:        'view',
        resource_type: match.resourceType,
        resource_id:   resourceId && uuidRe2.test(resourceId) ? resourceId : null,
        patient_id:    patientIdRaw && uuidRe2.test(patientIdRaw) ? patientIdRaw : null,
        details:       { path, query: req.query },
        ip_address:    ipAddress,
        user_agent:    (req.headers?.['user-agent'] as string | undefined) ?? null,
        mode:          process.env.MODE ?? null,
      });
    } catch (err) {
      logger.debug({ err }, '[phi-audit] log failed (non-fatal)');
    }
  })();

  next();
}
