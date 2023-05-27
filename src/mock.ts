import {typeGenWrapper as typeGenWMain, TypeGenConfig, TGVariant2, TypeGenRequestFn} from "./index";

export const typeGenWrapper = <T extends TypeGenRequestFn, RT extends Promise<any> = ReturnType<T>>(request: T, config: Partial<TypeGenConfig<T, RT>> = {}): TGVariant2<T> => {
  return typeGenWMain(request, {
    getReadableResponse: config.getReadableResponse
  } as any); // fs requirements check will prevent anything related to type gen from happening
}
