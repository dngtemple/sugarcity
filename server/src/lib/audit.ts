import AuditLog from '../models/AuditLog.model';
import User from '../models/User.model';

interface LogParams {
  actorId?: string;
  action: string;
  entity: string;
  entityId?: string;
  meta?: Record<string, any>;
}

export async function logAudit({ actorId, action, entity, entityId, meta }: LogParams) {
  try {
    let actorName = '';
    let actorRole = '';
    if (actorId) {
      const actor = await User.findById(actorId).select('name role').lean();
      if (actor) {
        actorName = actor.name || '';
        actorRole = actor.role || '';
      }
    }
    await AuditLog.create({ actorId, actorName, actorRole, action, entity, entityId, meta });
  } catch (err) {
    console.error('[audit] failed to log', { action, entity, err });
  }
}
