export type LogEntry = {
    id: string;
    type: 'log' | 'info' | 'warn' | 'error' | 'eval_result';
    timestamp: Date;
    args: any[];
};

export type NetHistoryEntry = {
    id: string;
    status: number | string;
    timestamp: Date;
    duration?: number;
    requestBody?: any;
    responseBody?: any;
    requestSize?: number;
    responseSize?: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
};

export type NetEntry = {
    id: string;
    method: string;
    url: string;
    status: number | string;
    timestamp: Date;
    duration?: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: any;
    responseBody?: any;
    requestSize?: number;
    responseSize?: number;
    fromConsole?: boolean;
    count?: number;
    history?: NetHistoryEntry[];
};
