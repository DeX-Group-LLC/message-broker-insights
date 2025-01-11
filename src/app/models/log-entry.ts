export interface LogEntry {
    timestamp: Date;
    level: string;
    module: string;
    message: string;
    meta?: any;
}