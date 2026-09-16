import { createClient } from 'npm:@supabase/supabase-js@2';

const FORBIDDEN_META_KEYS = new Set([
  'password',
  'temp_password',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'api_key',
  'private_key',
  'service_role',
  'authorization',
  'jwt',
]);

export function sanitizeAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeAuditMetadata(item));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce((acc, [key, item]) => {
      if (FORBIDDEN_META_KEYS.has(key.toLowerCase())) return acc;
      acc[key] = sanitizeAuditMetadata(item);
      return acc;
    }, {} as Record<string, unknown>);
  }

  return value;
}

export type AuditInsert = {
  acteur_profile_id: string | null;
  acteur_email?: string | null;
  entreprise_id?: string | null;
  action: string;
  type_cible: string;
  cible_id?: string | null;
  description: string;
  metadonnees?: Record<string, unknown> | null;
  adresse_ip?: string | null;
  user_agent?: string | null;
};

export async function recordAuditEvent(supabase: ReturnType<typeof createClient>, insert: AuditInsert) {
  const payload = {
    acteur_profile_id: insert.acteur_profile_id,
    acteur_email: insert.acteur_email || null,
    entreprise_id: insert.entreprise_id || null,
    action: insert.action,
    type_cible: insert.type_cible,
    cible_id: insert.cible_id || null,
    description: insert.description,
    metadonnees: sanitizeAuditMetadata(insert.metadonnees || {}),
    adresse_ip: insert.adresse_ip || null,
    user_agent: insert.user_agent || null,
  }

  const { error } = await supabase.rpc('record_audit_event', payload)
  if (error) {
    console.error('audit_record_failed', error)
    return false
  }
  return true
}
