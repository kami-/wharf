import { createHashHistory } from "history";
import { applyMiddleware, compose, createStore, AnyAction } from "redux";
import { connectRouter, routerMiddleware } from "connected-react-router";

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

export interface StoreState {
    bootstrapForm: BootstrapFormState;
    synchronization: SynchronizationState;
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
        case "download-progress":
            return {
                ...state,
                synchronization: {
                    ...state.synchronization,
                    downloaded: <number>action.bytes,
                    fileBeingDownloaded: <string>action.name
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

        default: return state;
    }
}

export default store;
