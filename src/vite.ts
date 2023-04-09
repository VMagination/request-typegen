import './../typeGen-placeholder.d.ts';
import fs from 'vite-plugin-fs/browser';

type Fn = (...args: any[]) => Promise<any>;

const getSpaces = (depth: number) => '  '.repeat(depth);

const getType = (v: any) => {
  if (v === null) return 'null';
  if (typeof v === 'function') return 'Function';
  return typeof v;
};

const getTypeMapFromObj = (o: any) => {
  if (!o || typeof o !== 'object') return getType(o);
  if (Array.isArray(o)) {
    return o.map(getTypeMapFromObj);
  }
  return Object.entries(o).reduce(
    (accum, [key, val]) =>({
      ...accum,
      [key]: !val || typeof val !== 'object' ? getType(val) : getTypeMapFromObj(val),
    }),
    {}
  );
}

const arrayTypeIndicator = 'typeArray';

const typeMapToString = (o: any, depth = 0) => {
  if (Array.isArray(o)) {
    const nonObjects = o.filter((v) => typeof v !== 'object');
    const allKeys= [...new Set(o.reduce((accum, val) => typeof val === 'object' ? [...accum,...Object.keys(val)] : accum, []))] as string[];
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
      `${accum}${getSpaces((depth+1)*2)}${wrapKey(key)}: ${
        !val || typeof val !== 'object' ? val : typeMapToString(val, depth + 1)
      };\n`,
    `{\n`
  )}${getSpaces((depth)*2)}}`;
}

const state = {
  process: Promise.resolve(),
}

const wrapKey = (key: string) => /^[a-zA-Z0-9_]+$/.test(key) ? key : `'${key}'`;

const addToTypeGen = async (key: string, readable: any) => {
  await state.process;
  const fn = async () => {
    const hasFile = await fs.stat('TypeGen.ts').catch(() => null);
    const prevFile = hasFile ? await fs.readFile('TypeGen.ts') : '';
    const prev = prevFile.split('// TypeGen Separator').filter((v) => !v.includes(`${wrapKey(key)}: `)).join('// TypeGen Separator');
    await fs.writeFile(
      'TypeGen.ts',
      prev + `${prev ? '\n' : ''}// TypeGen Separator\nexport interface TypeGenMain {\n    ${wrapKey(key)}: ${typeMapToString(getTypeMapFromObj(readable), 1)}\n}`,
    );
    await fs.writeFile(
      'typeGen.d.ts',
      `declare global {\n  import { TypeGenMain as TypeG } from './TypeGen';\n  interface TypeGenMain extends TypeG {}\n}\nexport * from './TypeGen';\n`,
    );
  }
  state.process = fn();
}

type GetTypeOptions<T extends string, SRC> = {
  [K in keyof SRC]: K extends T  ? SRC[K] : never;
}[keyof SRC];
type TypeGenReturnType<Key extends string, SRC> = GetTypeOptions<Key, SRC> extends never ?  any : GetTypeOptions<Key, SRC> & {};

type TGVariant1<Params extends any[]> = <K extends string>(key: K, ...args: Params) => Promise<TypeGenReturnType<K, TypeGenMain>>;
type TGVariant3<Params extends any[]> = <K extends string>(...args: [...Params, K]) => Promise<TypeGenReturnType<K, TypeGenMain>>;

type TGVariant2<T extends Fn> = T & {
  withTypeGen: <K extends string>( key: K) => {
    call: (...args: Parameters<T>) => Promise<TypeGenReturnType<K, TypeGenMain>>
  };
  callWithTypeGenKey: TGVariant1<Parameters<T>>;
  tg: <K extends string>( key: K) => {
    call: (...args: Parameters<T>) => Promise<TypeGenReturnType<K, TypeGenMain>>
  };
  tgS: TGVariant1<Parameters<T>>;
  tgE: TGVariant3<Parameters<T>>;
};

type OverrideUnknown<T> = unknown extends T ? any : T;

const genTypeInternal = async (callable: Fn, key: string, config: TypeGenConfig<Fn, Promise<any>>, ...args) => {
  const ogResponse = await callable(...args);
  let response = ogResponse;
  if ('clone' in response && typeof response.clone === 'function') {
    response = await response.clone();
  }
  let readable;
  try {
    if (config?.getReadableResponse) {
      readable = await config?.getReadableResponse?.(response, ...args);
    } else {
      if ('json' in response && typeof response.json === 'function') {
        try {
          readable = await response.json();
        } catch {
          if ('text' in response && typeof response.text === 'function') {
            readable = await response.text();
          }
        }
      } else if ('text' in response && typeof response.text === 'function') {
        readable = await response.text();
      }
    }
  } catch {
    // some bad shit happened proly should log a error here but mb later *shrugs*
  }
  if (key && readable !== undefined) addToTypeGen(key, readable);
  return readable || ogResponse;
}

type TypeGenConfig<T extends Fn, RT extends Promise<any>> = {
  isDev?: boolean;
  getReadableResponse?: (res: OverrideUnknown<Awaited<ReturnType<T>>>, ...args: Parameters<T>) => RT;
}

export const typeGenWrapper = <T extends Fn, RT extends Promise<any> = ReturnType<T>>(request: T, config: TypeGenConfig<T, RT> = {}): TGVariant2<T> => {
  return Object.assign(request, {
    withTypeGen: (key: string) => ({
      call: (...args: Parameters<T>) => genTypeInternal(request, key, config, ...args)
    }),
    callWithTypeGenKey: (key: string, ...args) => genTypeInternal(request, key, config, ...args),
    tg: (key: string) => ({
      call: (...args: Parameters<T>) => genTypeInternal(request, key, config, ...args)
    }),
    tgS: (key: string, ...args) => genTypeInternal(request, key, config, ...args),
    tgE: (...args) => {
      const argsToPass = [...args];
      const key = argsToPass.pop();
      return genTypeInternal(request, key, config, ...argsToPass)
    },
  });
}
