import {typeGenWrapper as typeGenWMain, TypeGenConfig, TGVariant2, TypeGenRequestFn} from "./index";

type Config<T extends TypeGenRequestFn, RT extends Promise<any> = ReturnType<T>> = Partial<TypeGenConfig<T, RT>> & { fsUrl?: string }

const state = {
  url: null as string | null,
}

export const setTypeGenFSUrl = (url: string | null) => {
  state.url = url;
}

export const typeGenWrapper = <T extends TypeGenRequestFn, RT extends Promise<any> = ReturnType<T>>(request: T, config: Config<T, RT> = {}): TGVariant2<T> => {
  const fsUrl = config?.fsUrl || state.url || 'http://127.0.0.1:4832';
  return typeGenWMain(request, {
    fileExists: (name) => fetch(`${fsUrl}/fileExists?fileName=${name}`).then(d => d.text()),
    readFile: (name) => fetch(`${fsUrl}/readFile?fileName=${name}`).then(d => d.text()),
    writeFile: (name, data) => fetch(`${fsUrl}/writeFile?fileName=${name}`, {method: 'POST', body:data})
      .then(d => d.text()),
    ...config,
  } as any);
}
