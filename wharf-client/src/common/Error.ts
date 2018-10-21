export type ErrorCode
    = "failed-to-get-server-config"
    ;

export class WharfError extends Error {
    readonly errorCode: ErrorCode;
    readonly error: any;

    constructor(errorCode: ErrorCode, error?: any, message?: string) {
        super(message);
        this.errorCode = errorCode;
        this.error = error;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export function isError(error: any, errorCode: ErrorCode) {
    return error instanceof WharfError && error.errorCode == errorCode;
}
