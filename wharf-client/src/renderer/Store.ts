import { createHashHistory } from "history";
import { applyMiddleware, compose, createStore, AnyAction } from "redux";
import { connectRouter, routerMiddleware } from "connected-react-router";
import { Settings } from "../common/Settings";

export const history = createHashHistory();

export interface BootstrapFormState {
    serverConfigUrlError: boolean;
}

export interface SynchronizationState {
    downloaded: number;
    toBeDownloaded: number;
    fileBeingDownloaded: string;
    isDownloading: boolean;
    isStopping: boolean;
}

export interface SettingsState extends Settings {
}

export interface StoreState {
    bootstrapForm: BootstrapFormState;
    synchronization: SynchronizationState;
    settings: SettingsState;
}

const initialState: StoreState = {
    bootstrapForm: {
        serverConfigUrlError: false
    },
    synchronization: {
        downloaded: 0,
        toBeDownloaded: 0,
        fileBeingDownloaded: "",
        isDownloading: false,
        isStopping: false
    },
    settings: {
        lastConfigPath: "",
        extraMods: [],
        extraStartupParams: [],
    }
};

const store = createStore(
    connectRouter(history)(reducer),
    initialState,
    compose(
        applyMiddleware(
            routerMiddleware(history)
        )
    )
);

function reducer(state: StoreState | undefined, action: AnyAction): StoreState {
    if (!state) {
        return initialState
    };
    switch (action.type) {
        case "settings-loaded": {
            return {
                ...state,
                settings: action.settings
            };
        }

        case "start-synchronization":
            return {
                ...state,
                synchronization: {
                    ...state.synchronization,
                    toBeDownloaded: <number>action.toBeDownloaded
                }
            };
        case "download-progress":
            return {
                ...state,
                synchronization: {
                    ...state.synchronization,
                    downloaded: <number>action.downloaded,
                    fileBeingDownloaded: <string>action.file
                }
            };

        case "download-finished":
            return {
                ...state,
                synchronization: {
                    ...state.synchronization,
                    isDownloading: false
                }
            };

        case "update-last-config-path":
            return {
                ...state,
                settings: {
                    ...state.settings,
                    lastConfigPath: action.lastConfigPath
                }
            };

        case "add-extra-mod":
            return {
                ...state,
                settings: {
                    ...state.settings,
                    extraMods: state.settings.extraMods.concat(action.mod)
                }
            };
        case "remove-extra-mod":
            return {
                ...state,
                settings: {
                    ...state.settings,
                    extraMods: state.settings.extraMods.filter(mod => mod != action.mod)
                }
            };

        case "add-extra-startup-param":
            return {
                ...state,
                settings: {
                    ...state.settings,
                    extraStartupParams: state.settings.extraStartupParams.concat(action.param)
                }
            };
        case "remove-extra-startup-param":
            return {
                ...state,
                settings: {
                    ...state.settings,
                    extraStartupParams: state.settings.extraStartupParams.filter(param => param != action.param)
                }
            };

        default: return state;
    }
}

export default store;
