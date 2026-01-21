import { useCallback, useEffect, useRef } from 'react';

interface VSCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

let vscodeApi: VSCodeApi | null = null;

function getVSCodeApi(): VSCodeApi {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

export interface ImageInitMessage {
  type: 'init';
  body: {
    imageData: string;
    fileName: string;
  };
}

export type VSCodeMessage = ImageInitMessage;

export function useVSCodeApi() {
  const api = useRef(getVSCodeApi());

  const postMessage = useCallback((message: unknown) => {
    api.current.postMessage(message);
  }, []);

  const onMessage = useCallback((handler: (message: VSCodeMessage) => void) => {
    const listener = (event: MessageEvent<VSCodeMessage>) => {
      handler(event.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  const notifyReady = useCallback(() => {
    postMessage({ type: 'ready' });
  }, [postMessage]);

  const sendEdit = useCallback((imageData: string, editType: string) => {
    postMessage({
      type: 'edit',
      body: { imageData, editType },
    });
  }, [postMessage]);

  const requestSave = useCallback(() => {
    postMessage({ type: 'requestSave' });
  }, [postMessage]);

  return {
    postMessage,
    onMessage,
    notifyReady,
    sendEdit,
    requestSave,
  };
}
