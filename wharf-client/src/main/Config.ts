import { Config, FtpConfig } from "wharf-common";

export interface LocalConfig extends Config {
    serverConfigUrl: string;
    ftp: FtpConfig;
}
