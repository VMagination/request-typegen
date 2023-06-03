import { Buffer } from 'buffer';

type TypeGenRequestFn = (...args: any[]) => Promise<any>;

type Fn = TypeGenRequestFn;

export type TGWrapperFn = <
  T extends TypeGenRequestFn,
  A extends any[],
  RT extends Promise<any>>(
  request: T & ((...args: A) => RT),
  config?: TypeGenConfig
) => {
  [K in keyof T]: T[K]
} & WrappedWithTypeGen<T, A, RT>

const getSpaces = (depth: number) => '  '.repeat(depth);

const getType = (v: any) => {
  if (v === null) return 'null';
  if (typeof v === 'function') return 'Function';
  return typeof v;
};

const getTypeMapFromObj = (o: any, ignoreConstructors: boolean) => {
  if (!o || typeof o !== 'object') return getType(o);
  if (Array.isArray(o)) {
    return o.map((v) => getTypeMapFromObj(v, ignoreConstructors));
  }
  return Object.entries(o).reduce(
    (accum, [key, val]) => ({
      ...accum,
      [key]: !val || typeof val !== 'object' ? getType(val) : (ignoreConstructors || val.constructor === Object || val.constructor === Array) ? getTypeMapFromObj(val, ignoreConstructors) : 'any',
    }),
    {}
  );
}

const arrayTypeIndicator = 'typeArray';

const typeMapToString = (o: any, depth = 0) => {
  if (Array.isArray(o)) {
    const nonObjects = o.filter((v) => typeof v !== 'object');
    const allKeys = [...new Set(o.reduce((accum, val) => typeof val === 'object' ? [...accum, ...Object.keys(val)] : accum, []))] as string[];
    let mergedOStr = '';
    if (allKeys.length) {
      const mergedO = allKeys.reduce((accum, key) => {
        const allValues = o.filter((v) => typeof v === 'object').map((v) => Array.isArray(v[key]) ? typeMapToString(v[key], depth + 1) : v[key] || 'undefined');
        return {...accum, [key]: typeMapToString([...allValues, arrayTypeIndicator], depth + 1)};
      }, {});
      mergedOStr = typeMapToString(mergedO, depth);
    }
    const valuesSet = [...new Set(nonObjects), mergedOStr];
    const result = valuesSet.filter((v) => v && v !== arrayTypeIndicator).join(' | ');
    return valuesSet.includes(arrayTypeIndicator) ? result : `Array<${result}>`;
  }
  return `${Object.entries(o).reduce(
    (accum, [key, val]) =>
      `${accum}${getSpaces((depth + 1) * 2)}${wrapKey(key)}: ${
        !val || typeof val !== 'object' ? val : typeMapToString(val, depth + 1)
      };\n`,
    `{\n`
  )}${getSpaces((depth) * 2)}}`;
}

const state = {
  process: Promise.resolve(),
  url: null as string | null,
}

export const setTypeGenFileServerUrl = (url: string | null) => {
  state.url = url;
}


const wrapKey = (key: string) => /^[a-zA-Z0-9_]+$/.test(`${key}`) ? key : `'${key}'`;

const addToTypeGen = async ({
  key,
  readable,
  config,
  fieldIsFn,
  fieldName,
} : {
  key: string;
  readable: any;
  config: TypeGenConfig;
  fieldIsFn: boolean;
  fieldName: string;
}) => {
  await state.process;
  const fn = async () => {
    let hasFile: any = false;
    let fileName = 'typeGen.d.ts';
    try {
      fileName = process.cwd().replace(/\/$/, '') + '/typeGen.d.ts';
    } catch {
      /* noop */
    }
    try {
      hasFile = await config.fileExists(fileName);
    } catch {
      /* noop */
    }
    const prevFile = hasFile ? Buffer.from(await config.readFile(fileName)).toString('utf-8') : '';
    const prev = prevFile.split('// TypeGen Separator').filter((v) => !v.includes(`${wrapKey(key)}: `)).join('// TypeGen Separator');
    await config.writeFile(
      fileName,
      prev +
      `${prev && prev.includes('export {};') ? '' : 'export {};\n'}// TypeGen Separator\ndeclare global {\n    interface TypeGenMain {\n        ${wrapKey(key)}: {\n          ${wrapKey(fieldName)}:${fieldIsFn ? '() => ' : ''}${typeMapToString(getTypeMapFromObj(readable, config.ignoreConstructors || false), 3)}\n      }\n    }\n}\n`,
    );
  }
  state.process = fn();
}

type OverrideOriginalResponse<O extends Promise<any>, T> = [never] extends T ? [never] extends Awaited<O> ? any : Awaited<O> : Omit<Awaited<O>, keyof T> & T

type GetTypeOptions<T extends string, SRC> = {
  [K in keyof SRC]: K extends T ? SRC[K] : never;
}[keyof SRC];

type TypeGenReturnType<Key extends string, SRC, RT> = GetTypeOptions<Key, SRC> extends never ? RT : GetTypeOptions<Key, SRC> & {};

export type TGVariant1<Params extends any[], RT extends Promise<any>> = <K extends string>(key: K, ...args: Params) => Promise<OverrideOriginalResponse<RT, TypeGenReturnType<K, TypeGenMain, RT>> & {}>;
export type TGVariant3<Params extends any[], RT extends Promise<any>> = <K extends string>(...args: [...Params, K]) => Promise<OverrideOriginalResponse<RT, TypeGenReturnType<K, TypeGenMain, RT>> & {}>;

export type WrappedWithTypeGen<T extends Fn, A extends any[], RT extends Promise<any>> = T & {
  withTypeGen: <K extends string>(key: K) => {
    call: (...args: A) => Promise<OverrideOriginalResponse<RT, TypeGenReturnType<K, TypeGenMain, RT>> & {}>
  };
  callWithTypeGenKey: TGVariant1<A, RT>;
  tg: <K extends string>(key: K) => {
    call: (...args: A) => Promise<OverrideOriginalResponse<RT, TypeGenReturnType<K, TypeGenMain, RT>> & {}>
  };
  tgS: TGVariant1<A, RT>;
  tgE: TGVariant3<A, RT>;
};

const genTypeInternal = async (callable: Fn, key: string, config: TypeGenConfig, ...args) => {
  const fsUrl = config?.fsUrl || state.url || 'http://127.0.0.1:4832';
  const conf = {
    fileExists: (name) => fetch(`${fsUrl}/fileExists?fileName=${name}`).then(d => d.text()),
    readFile: (name) => fetch(`${fsUrl}/readFile?fileName=${name}`).then(d => d.text()),
    writeFile: (name, data) => fetch(`${fsUrl}/writeFile?fileName=${name}`, {method: 'POST', body:data})
      .then(d => d.text()),
    ...config,
  }
  const ogResponse = await callable(...args);
  let response = ogResponse;
  let usedFieldName = null as null | string;
  let usedFieldsIsFn = false;
  if ('clone' in response && typeof response.clone === 'function') {
    response = await response.clone();
  }
  let readable = ogResponse;
  try {
    if (conf?.focusField && response?.[conf.focusField]) {
      const fField = response?.[conf.focusField];
      usedFieldName = conf.focusField;
      usedFieldsIsFn = typeof fField === 'function';
      readable = await (typeof fField === 'function' ? fField() : fField);
    } else {
      if ('json' in response && typeof response.json === 'function') {
        try {
          readable = await response.json();
          usedFieldName = 'json';
          usedFieldsIsFn = true;
        } catch {
          // noop
        }
      } else if ('data' in response && typeof response.data !== 'function') {
        usedFieldName = 'data';
        usedFieldsIsFn = false;
        readable = response.data;
      }
    }
  } catch {
    // some bad shit happened proly should log an error here but mb later *shrugs*
  }
  if (
    usedFieldName &&
    conf?.fileExists &&
    conf?.readFile &&
    conf?.writeFile &&
    (typeof conf?.enabled === 'undefined' || conf?.enabled) &&
    key &&
    readable !== undefined)
      addToTypeGen({
        key,
        readable,
        config: conf,
        fieldName: usedFieldName,
        fieldIsFn: usedFieldsIsFn
      });
  return ogResponse;
}

export type TypeGenConfig = {
  enabled?: boolean;
  ignoreConstructors?: boolean;
  writeFile?: (path: string, content: string) => any | Promise<any>;
  readFile?: (path: string) => any | Promise<any>;
  fileExists?: (path: string) => any | Promise<any>;
  fsUrl?: string;
  focusField?: string;
}

export const typeGenWrapper: TGWrapperFn = (
    request,
    config
) => {
  return Object.assign(request, {
    withTypeGen: (key: string) => ({
      call: (...args: string[]) => genTypeInternal(request, key, config, ...args)
    }),
    callWithTypeGenKey: (key: string, ...args: string[]) => genTypeInternal(request, key, config, ...args),
    tg: (key: string) => ({
      call: (...args: string[]) => genTypeInternal(request, key, config, ...args)
    }),
    tgS: (key: string, ...args: string[]) => genTypeInternal(request, key, config, ...args),
    tgE: (...args: string[]) => {
      const argsToPass = [...args];
      const key = argsToPass.pop();
      return genTypeInternal(request, key, config, ...argsToPass)
    },
  });
}
