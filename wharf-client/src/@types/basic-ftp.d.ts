declare module "basic-ftp" {
    import { Writable } from "stream";

    export interface AccessConfig {
        host: string;
        port?: number;
        user: string;
        password: string;
        secure?: boolean;
    }

    export interface TrackingInfo {
        name: string,
        bytes: number;
        bytesOverall: number;
    }

    export interface FTPContext {
        verbose: boolean;
    }

    export class Client {
        ftp: FTPContext;
        trackProgress: (handler: (info: TrackingInfo) => void) => void;
        close(): void;
        access(config: AccessConfig): Promise<Response>;
        cd(remotePath: string): Promise<Response>;
        download(writableStream: Writable, remoteFilename: string, startAt?: number): Promise<Response>;
        downloadDir(localDirPath: string): Promise<Response>;
    }
}
