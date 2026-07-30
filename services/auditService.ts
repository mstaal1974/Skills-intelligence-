
import { AuditLogEntry } from '../types';

class AuditService {
    private logs: AuditLogEntry[] = [];
    private currentUser = 'HR Manager'; // Mock logged-in user

    constructor() {
        // Add some initial mock logs
        this.log('create', 'System', 'Init', 'System initialized');
    }

    log(
        action: 'create' | 'update' | 'delete',
        entityType: string,
        entityId: string | number,
        details: string,
        changes?: { field: string; oldValue: any; newValue: any }[]
    ) {
        const entry: AuditLogEntry = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            user: this.currentUser,
            action,
            entityType,
            entityId,
            details,
            changes
        };
        // Add to beginning of array
        this.logs.unshift(entry);
        console.log(`[Audit] ${action} ${entityType}: ${details}`);
    }

    getLogs(filter?: string): AuditLogEntry[] {
        if (!filter) return this.logs;
        const lowerFilter = filter.toLowerCase();
        return this.logs.filter(log => 
            log.user.toLowerCase().includes(lowerFilter) ||
            log.entityType.toLowerCase().includes(lowerFilter) ||
            log.details.toLowerCase().includes(lowerFilter)
        );
    }

    exportLogs(): void {
        const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details', 'Changes'];
        const csvContent = [
            headers.join(','),
            ...this.logs.map(log => {
                const changesStr = log.changes ? JSON.stringify(log.changes).replace(/"/g, '""') : '';
                return [
                    log.timestamp,
                    log.user,
                    log.action,
                    log.entityType,
                    log.entityId,
                    `"${log.details}"`,
                    `"${changesStr}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

export const auditService = new AuditService();
